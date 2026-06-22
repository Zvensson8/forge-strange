import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const GoalInput = z.object({
  title: z.string().min(1).max(120),
  goal_type: z.enum(["strength", "distance", "sessions", "event"]),
  target_value: z.number().positive(),
  target_unit: z.string().min(1).max(20),
  target_reps: z.number().int().positive().nullable().optional(),
  exercise_id: z.string().uuid().nullable().optional(),
  session_type: z.enum(["styrka", "cirkel", "löpning"]).nullable().optional(),
  target_date: z.string().regex(ISO_DATE_RE).nullable().optional(),
  start_date: z.string().regex(ISO_DATE_RE).optional(),
  reminder_enabled: z.boolean().default(false),
  reminder_cadence: z.enum(["daily", "weekly"]).default("weekly"),
  notes: z.string().optional(),
});

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GoalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("goals")
      .insert({ ...data, user_id: userId })
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
      .update(data.patch)
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

// Räkna ut progress för varje mål, inkl. trend-serie + status-färg
export const listGoalsWithProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return computeGoalsWithProgress(context.supabase, context.userId);
  });

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

    // Hämta all relevant historik i parallellt
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
    const todayISO = today.toISOString().slice(0, 10);

    return goals.map((g: any) => {
      let currentValue = 0;
      let currentLabel = "";
      const trend: { date: string; value: number }[] = [];

      if (g.goal_type === "strength" && g.exercise_id) {
        // Trend = best weight*reps per dag (eller bara vikt om target_reps satt)
        const byDate = new Map<string, { weight: number; reps: number }>();
        for (const s of setRows ?? []) {
          if (s.exercise_id !== g.exercise_id) continue;
          const d = (s.workouts as any).date as string;
          if (d < g.start_date) continue;
          const w = Number(s.weight ?? 0);
          const r = Number(s.reps ?? 0);
          if (w <= 0 || r <= 0) continue;
          const cur = byDate.get(d);
          // Bäst = störst weight, vid lika störst reps
          if (!cur || w > cur.weight || (w === cur.weight && r > cur.reps)) {
            byDate.set(d, { weight: w, reps: r });
          }
        }
        const sorted = Array.from(byDate.entries()).sort();
        for (const [d, v] of sorted) trend.push({ date: d, value: v.weight });
        const best = sorted.reduce<{ weight: number; reps: number } | null>((acc, [, v]) => {
          if (!acc || v.weight > acc.weight || (v.weight === acc.weight && v.reps > acc.reps)) return v;
          return acc;
        }, null);
        currentValue = best?.weight ?? 0;
        currentLabel = best ? `${best.weight} kg × ${best.reps}` : "—";
      } else if (g.goal_type === "distance") {
        // Total km i perioden
        let total = 0;
        const byDate = new Map<string, number>();
        for (const r of runRows ?? []) {
          if (g.session_type && (r.workouts as any).session_type !== g.session_type) continue;
          const d = (r.workouts as any).date as string;
          if (d < g.start_date) continue;
          const km = Number(r.distance_km);
          total += km;
          byDate.set(d, (byDate.get(d) ?? 0) + km);
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
        }
        let running = 0;
        for (const [d, v] of Array.from(byDate.entries()).sort()) {
          running += v;
          trend.push({ date: d, value: running });
        }
        currentValue = count;
        currentLabel = `${count} pass`;
      } else if (g.goal_type === "event") {
        // Event = total km (löpning) eller antal pass (om session_type styrka/cirkel)
        if (g.session_type === "löpning" || !g.session_type) {
          let total = 0;
          const byDate = new Map<string, number>();
          for (const r of runRows ?? []) {
            const d = (r.workouts as any).date as string;
            if (d < g.start_date) continue;
            const km = Number(r.distance_km);
            total += km;
            byDate.set(d, (byDate.get(d) ?? 0) + km);
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
      }

      const progressPct = g.target_value > 0 ? Math.min(100, Math.round((currentValue / Number(g.target_value)) * 100)) : 0;

      // Status-färg: jämför % av tid förbrukad vs % progress
      let pace: "ahead" | "on_track" | "behind" | "danger" = "on_track";
      let days_left: number | null = null;
      let weeks_left: number | null = null;
      let expected_pct: number | null = null;

      if (g.target_date) {
        const tgt = new Date(g.target_date);
        const start = new Date(g.start_date);
        const totalDays = Math.max(1, Math.round((tgt.getTime() - start.getTime()) / 86400000));
        const elapsed = Math.max(0, Math.round((today.getTime() - start.getTime()) / 86400000));
        days_left = Math.max(0, Math.round((tgt.getTime() - today.getTime()) / 86400000));
        weeks_left = Math.ceil(days_left / 7);
        const timePct = Math.min(100, Math.round((elapsed / totalDays) * 100));
        expected_pct = timePct;
        const diff = progressPct - timePct;
        if (diff >= 5) pace = "ahead";
        else if (diff >= -10) pace = "on_track";
        else if (diff >= -25) pace = "behind";
        else pace = "danger";
      } else if (progressPct >= 100) {
        pace = "ahead";
      }

      const completed = progressPct >= 100 && (g.goal_type !== "strength" || currentValue >= Number(g.target_value));

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
        completed,
        today_iso: todayISO,
      };
    });
  });
