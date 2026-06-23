import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const GoalInput = z.object({
  title: z.string().min(1).max(120),
  goal_type: z.enum(["strength", "distance", "sessions", "event", "process"]),
  target_value: z.number().nonnegative(),
  target_unit: z.string().min(1).max(20),
  target_reps: z.number().int().positive().nullable().optional(),
  exercise_id: z.string().uuid().nullable().optional(),
  session_type: z.enum(["styrka", "cirkel", "löpning", "cykling", "promenad"]).nullable().optional(),
  target_date: z.string().regex(ISO_DATE_RE).nullable().optional(),
  start_date: z.string().regex(ISO_DATE_RE).optional(),
  reminder_enabled: z.boolean().default(false),
  reminder_cadence: z.enum(["daily", "weekly"]).default("weekly"),
  notes: z.string().optional(),
  parent_goal_id: z.string().uuid().nullable().optional(),
  process_period: z.enum(["week", "month"]).nullable().optional(),
  process_target_count: z.number().positive().nullable().optional(),
  process_metric: z.enum(["sessions", "km"]).nullable().optional(),
});

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GoalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("goals")
      .insert({ ...data, user_id: userId } as any)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: GoalInput.partial().extend({
          status: z.enum(["active", "completed", "archived"]).optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("goals")
      .update(data.patch as any)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("goals").delete().eq("id", data.id).eq("user_id", userId);
    return { ok: true };
  });

export const listGoalsWithProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return computeGoalsWithProgress(context.supabase, context.userId);
  });

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weekStartISO(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return isoDate(date);
}

export async function computeGoalsWithProgress(supabase: any, userId: string) {
  const { data: goals } = await supabase
    .from("goals")
    .select("*, exercises(name)")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("status")
    .order("target_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!goals?.length) return [];

  const startDates = goals.map((g: any) => g.start_date);
  const minStart = startDates.sort()[0];

  const [{ data: workouts }, { data: setRows }, { data: runRows }] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, date, session_type")
      .eq("user_id", userId)
      .gte("date", minStart)
      .order("date"),
    supabase
      .from("sets")
      .select("weight, reps, exercise_id, workouts!inner(user_id, date)")
      .eq("workouts.user_id", userId)
      .gte("workouts.date", minStart),
    supabase
      .from("running_sessions")
      .select("distance_km, duration_minutes, avg_pace_seconds, workouts!inner(user_id, date, session_type)")
      .eq("workouts.user_id", userId)
      .gte("workouts.date", minStart),
  ]);

  const today = new Date();
  const todayISO = isoDate(today);

  return goals.map((g: any) => {
    let currentValue = 0;
    let currentLabel = "";
    const trend: { date: string; value: number }[] = [];
    const weeklyBuckets = new Map<string, number>(); // week_start -> increment

    if (g.goal_type === "strength" && g.exercise_id) {
      const byDate = new Map<string, { weight: number; reps: number }>();
      for (const s of setRows ?? []) {
        if (s.exercise_id !== g.exercise_id) continue;
        const d = (s.workouts as any).date as string;
        if (d < g.start_date) continue;
        const w = Number(s.weight ?? 0);
        const r = Number(s.reps ?? 0);
        if (w <= 0 || r <= 0) continue;
        const cur = byDate.get(d);
        if (!cur || w > cur.weight || (w === cur.weight && r > cur.reps)) {
          byDate.set(d, { weight: w, reps: r });
        }
      }
      const sorted = Array.from(byDate.entries()).sort();
      let runningBest = 0;
      for (const [d, v] of sorted) {
        if (v.weight > runningBest) {
          const delta = v.weight - runningBest;
          runningBest = v.weight;
          const wk = weekStartISO(new Date(d));
          weeklyBuckets.set(wk, (weeklyBuckets.get(wk) ?? 0) + delta);
        }
        trend.push({ date: d, value: runningBest });
      }
      const best = sorted.reduce<{ weight: number; reps: number } | null>((acc, [, v]) => {
        if (!acc || v.weight > acc.weight || (v.weight === acc.weight && v.reps > acc.reps)) return v;
        return acc;
      }, null);
      currentValue = best?.weight ?? 0;
      currentLabel = best ? `${best.weight} kg × ${best.reps}` : "—";
    } else if (g.goal_type === "distance") {
      let total = 0;
      const byDate = new Map<string, number>();
      for (const r of runRows ?? []) {
        if (g.session_type && (r.workouts as any).session_type !== g.session_type) continue;
        const d = (r.workouts as any).date as string;
        if (d < g.start_date) continue;
        const km = Number(r.distance_km);
        total += km;
        byDate.set(d, (byDate.get(d) ?? 0) + km);
        const wk = weekStartISO(new Date(d));
        weeklyBuckets.set(wk, (weeklyBuckets.get(wk) ?? 0) + km);
      }
      let running = 0;
      for (const [d, v] of Array.from(byDate.entries()).sort()) {
        running += v;
        trend.push({ date: d, value: Number(running.toFixed(2)) });
      }
      currentValue = Number(total.toFixed(2));
      currentLabel = `${currentValue} ${g.target_unit}`;
    } else if (g.goal_type === "sessions") {
      let count = 0;
      const byDate = new Map<string, number>();
      for (const w of workouts ?? []) {
        if (g.session_type && w.session_type !== g.session_type) continue;
        if (w.date < g.start_date) continue;
        count += 1;
        byDate.set(w.date, (byDate.get(w.date) ?? 0) + 1);
        const wk = weekStartISO(new Date(w.date));
        weeklyBuckets.set(wk, (weeklyBuckets.get(wk) ?? 0) + 1);
      }
      let running = 0;
      for (const [d, v] of Array.from(byDate.entries()).sort()) {
        running += v;
        trend.push({ date: d, value: running });
      }
      currentValue = count;
      currentLabel = `${count} pass`;
    } else if (g.goal_type === "event") {
      if (g.session_type === "löpning" || g.session_type === "cykling" || g.session_type === "promenad" || !g.session_type) {
        let total = 0;
        const byDate = new Map<string, number>();
        for (const r of runRows ?? []) {
          if (g.session_type && (r.workouts as any).session_type !== g.session_type) continue;
          const d = (r.workouts as any).date as string;
          if (d < g.start_date) continue;
          const km = Number(r.distance_km);
          total += km;
          byDate.set(d, (byDate.get(d) ?? 0) + km);
          const wk = weekStartISO(new Date(d));
          weeklyBuckets.set(wk, (weeklyBuckets.get(wk) ?? 0) + km);
        }
        let running = 0;
        for (const [d, v] of Array.from(byDate.entries()).sort()) {
          running += v;
          trend.push({ date: d, value: Number(running.toFixed(2)) });
        }
        currentValue = Number(total.toFixed(2));
        currentLabel = `${currentValue} km tränat`;
      } else {
        let count = 0;
        for (const w of workouts ?? []) {
          if (w.session_type !== g.session_type) continue;
          if (w.date < g.start_date) continue;
          count += 1;
        }
        currentValue = count;
        currentLabel = `${count} pass`;
      }
    } else if (g.goal_type === "process") {
      // Process goal: räkna pass (eller km) per vecka/månad av session_type (eller alla)
      const period: "week" | "month" = g.process_period === "month" ? "month" : "week";
      const metric: "sessions" | "km" = g.process_metric === "km" ? "km" : "sessions";
      const targetPer = Number(g.process_target_count ?? g.target_value ?? 0);
      const byBucket = new Map<string, number>();

      if (metric === "km") {
        for (const r of runRows ?? []) {
          const ws = (r.workouts as any);
          if (g.session_type && ws.session_type !== g.session_type) continue;
          if (ws.date < g.start_date) continue;
          const dt = new Date(ws.date);
          const key = period === "week" ? weekStartISO(dt) : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`;
          byBucket.set(key, (byBucket.get(key) ?? 0) + Number(r.distance_km ?? 0));
        }
      } else {
        for (const w of workouts ?? []) {
          if (g.session_type && w.session_type !== g.session_type) continue;
          if (w.date < g.start_date) continue;
          const dt = new Date(w.date);
          const key = period === "week" ? weekStartISO(dt) : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`;
          byBucket.set(key, (byBucket.get(key) ?? 0) + 1);
        }
      }
      // Bygg en lista över de senaste 8 buckets
      const buckets: { key: string; count: number; hit: boolean }[] = [];
      const now = new Date();
      for (let i = 7; i >= 0; i--) {
        const dt = new Date(now);
        if (period === "week") dt.setDate(dt.getDate() - i * 7);
        else dt.setMonth(dt.getMonth() - i);
        const key = period === "week" ? weekStartISO(dt) : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`;
        const raw = byBucket.get(key) ?? 0;
        const c = metric === "km" ? Number(raw.toFixed(1)) : raw;
        buckets.push({ key, count: c, hit: targetPer > 0 && c >= targetPer });
      }
      const currentBucket = buckets[buckets.length - 1];
      currentValue = currentBucket?.count ?? 0;
      const unit = metric === "km" ? "km" : "pass";
      currentLabel = `${currentValue}/${targetPer} ${unit} ${period === "week" ? "denna vecka" : "denna månad"}`;
      // För process används en specialvy
      (g as any).process_buckets = buckets;
      (g as any).process_target_per_period = targetPer;
      (g as any).process_metric = metric;
    }

    const targetVal = Number(g.target_value);
    const progressPct =
      g.goal_type === "process"
        ? (g as any).process_target_per_period > 0
          ? Math.min(100, Math.round((currentValue / (g as any).process_target_per_period) * 100))
          : 0
        : targetVal > 0
          ? Math.min(100, Math.round((currentValue / targetVal) * 100))
          : 0;

    let pace: "ahead" | "on_track" | "behind" | "danger" = "on_track";
    let days_left: number | null = null;
    let weeks_left: number | null = null;
    let expected_pct: number | null = null;
    let required_per_week: number | null = null;
    let current_per_week: number | null = null;
    let projection_12w: number | null = null;
    let required_series: { date: string; value: number }[] | null = null;

    if (g.target_date && g.goal_type !== "process") {
      const tgt = new Date(g.target_date);
      const start = new Date(g.start_date);
      const totalDays = Math.max(1, Math.round((tgt.getTime() - start.getTime()) / 86400000));
      const elapsed = Math.max(0, Math.round((today.getTime() - start.getTime()) / 86400000));
      days_left = Math.max(0, Math.round((tgt.getTime() - today.getTime()) / 86400000));
      weeks_left = Math.max(1, Math.ceil(days_left / 7));
      const timePct = Math.min(100, Math.round((elapsed / totalDays) * 100));
      expected_pct = timePct;
      const diff = progressPct - timePct;
      if (diff >= 5) pace = "ahead";
      else if (diff >= -10) pace = "on_track";
      else if (diff >= -25) pace = "behind";
      else pace = "danger";

      // Krävd takt = (mål - nu) / veckor kvar
      const remaining = Math.max(0, targetVal - currentValue);
      required_per_week = Number((remaining / weeks_left).toFixed(2));

      // Faktisk takt = senaste 4 veckorna
      const fourWeeksAgo = new Date(today);
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      let recent = 0;
      for (const [wk, v] of weeklyBuckets) {
        if (new Date(wk) >= fourWeeksAgo) recent += v;
      }
      current_per_week = Number((recent / 4).toFixed(2));

      // Required series (linjär)
      required_series = [];
      const weeks = Math.ceil(totalDays / 7);
      for (let i = 0; i <= weeks; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i * 7);
        required_series.push({ date: isoDate(d), value: Number(((targetVal * i) / weeks).toFixed(2)) });
      }
    } else if (progressPct >= 100) {
      pace = "ahead";
    }

    // Compounding: om vi har nuvarande takt och en bas → projicera 12 v
    if (current_per_week !== null && currentValue > 0) {
      const proj = currentValue + current_per_week * 12;
      projection_12w = Number(proj.toFixed(1));
    }

    const completed =
      g.goal_type !== "process" &&
      progressPct >= 100 &&
      (g.goal_type !== "strength" || currentValue >= targetVal);

    return {
      ...g,
      current_value: currentValue,
      current_label: currentLabel,
      progress_pct: progressPct,
      pace,
      days_left,
      weeks_left,
      expected_pct,
      trend,
      weekly_buckets: Array.from(weeklyBuckets.entries())
        .sort()
        .map(([k, v]) => ({ week: k, value: Number(v.toFixed(2)) })),
      required_per_week,
      current_per_week,
      projection_12w,
      required_series,
      completed,
      today_iso: todayISO,
    };
  });
}

/**
 * Beräknar hur mycket en specifik logg-aktivitet förflyttade mål.
 * Används direkt efter loggning för "+X % mot målet"-feedback.
 */
export async function computeGoalImpact(
  supabase: any,
  userId: string,
  workout: { id: string; date: string; session_type: string },
) {
  const goals = await computeGoalsWithProgress(supabase, userId);
  const active = (goals ?? []).filter((g: any) => !g.completed && g.status !== "archived");
  if (!active.length) return [];

  // För varje mål, räkna vad denna workout bidrog med
  const impact: { id: string; title: string; delta_pct: number; progress_pct: number; current_label: string }[] = [];

  // Hämta sets och running_sessions för just denna workout
  const [{ data: setsThis }, { data: runThis }] = await Promise.all([
    supabase.from("sets").select("exercise_id, weight, reps").eq("workout_id", workout.id),
    supabase.from("running_sessions").select("distance_km").eq("workout_id", workout.id),
  ]);

  for (const g of active) {
    let delta = 0;
    const targetVal = Number(g.target_value);
    if (targetVal <= 0) continue;

    if (g.goal_type === "strength" && g.exercise_id) {
      // Tog vi en ny "best" för denna övning?
      const bestThis = (setsThis ?? [])
        .filter((s: any) => s.exercise_id === g.exercise_id)
        .reduce((m: number, s: any) => Math.max(m, Number(s.weight ?? 0)), 0);
      if (bestThis > 0 && bestThis <= targetVal) {
        // Delta = hur mycket detta bidrog till "best ever" (positiv om PR)
        const prev = g.current_value - 0; // current_value redan inkluderar denna workout
        // approx: ta procent från (bestThis / target) om det är nya peak
        if (bestThis >= g.current_value) {
          delta = Math.max(0, Math.round((bestThis / targetVal) * 100) - Math.round((prev / targetVal) * 100));
        }
      }
    } else if (g.goal_type === "distance" || (g.goal_type === "event" && (!g.session_type || ["löpning", "cykling", "promenad"].includes(g.session_type)))) {
      if (g.session_type && workout.session_type !== g.session_type) continue;
      const km = (runThis ?? []).reduce((s: number, r: any) => s + Number(r.distance_km ?? 0), 0);
      if (km > 0) delta = Math.round((km / targetVal) * 100);
    } else if (g.goal_type === "sessions" || (g.goal_type === "event" && g.session_type && ["styrka", "cirkel"].includes(g.session_type))) {
      if (g.session_type && workout.session_type !== g.session_type) continue;
      delta = Math.round((1 / targetVal) * 100);
    } else if (g.goal_type === "process") {
      if (g.session_type && workout.session_type !== g.session_type) continue;
      const tgtPer = Number((g as any).process_target_per_period ?? 0);
      if (tgtPer > 0) delta = Math.round((1 / tgtPer) * 100);
    }

    if (delta > 0) {
      impact.push({
        id: g.id,
        title: g.title,
        delta_pct: delta,
        progress_pct: g.progress_pct,
        current_label: g.current_label,
      });
    }
  }

  return impact;
}
