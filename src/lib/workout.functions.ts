import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function levelFromXp(xp: number) {
  return Math.floor(Math.sqrt(xp / 80));
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weekStartISO(d: Date = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return isoDate(date);
}

// ---------- Types ----------

type LogResult = {
  workout_id: string;
  xp_gained: number;
  total_xp: number;
  new_level: number;
  leveled_up: boolean;
  streak: number;
  prs: string[];
  unlocked_achievements: { code: string; name: string }[];
};

// ---------- Helpers shared inside handler ----------

async function updateStatsAndAchievements(
  supabase: any,
  userId: string,
  payload: {
    session_type: "styrka" | "cirkel" | "löpning";
    date: string;
    had_pr: boolean;
    xp_base: number;
    distance_km?: number;
  },
): Promise<{
  xp_gained: number;
  total_xp: number;
  new_level: number;
  leveled_up: boolean;
  streak: number;
  unlocked: { code: string; name: string }[];
}> {
  // Fetch or init stats
  const { data: statsRow } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const stats = statsRow ?? {
    user_id: userId,
    total_sessions: 0,
    current_streak: 0,
    longest_streak: 0,
    total_xp: 0,
    current_level: 0,
    last_workout_date: null as string | null,
  };

  // Streak
  let newStreak = stats.current_streak;
  if (stats.last_workout_date === payload.date) {
    // same day - no change
    newStreak = Math.max(stats.current_streak, 1);
  } else {
    const yesterday = new Date(payload.date);
    yesterday.setDate(yesterday.getDate() - 1);
    const ydISO = isoDate(yesterday);
    if (stats.last_workout_date === ydISO) {
      newStreak = stats.current_streak + 1;
    } else {
      newStreak = 1;
    }
  }
  const longest = Math.max(stats.longest_streak, newStreak);

  // XP
  const xpGained = payload.xp_base + (payload.had_pr ? 25 : 0);
  const totalXp = stats.total_xp + xpGained;
  const newLevel = levelFromXp(totalXp);
  const leveledUp = newLevel > stats.current_level;
  const totalSessions = stats.total_sessions + 1;

  await supabase
    .from("user_stats")
    .upsert({
      user_id: userId,
      total_sessions: totalSessions,
      current_streak: newStreak,
      longest_streak: longest,
      total_xp: totalXp,
      current_level: newLevel,
      last_workout_date: payload.date,
    });

  // Weekly quest
  const wk = weekStartISO(new Date(payload.date));
  const { data: existingQ } = await supabase
    .from("weekly_quests")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", wk)
    .maybeSingle();
  if (existingQ) {
    const prog = existingQ.progress + 1;
    await supabase
      .from("weekly_quests")
      .update({ progress: prog, completed: prog >= existingQ.target })
      .eq("id", existingQ.id);
  } else {
    await supabase
      .from("weekly_quests")
      .insert({ user_id: userId, week_start: wk, description: "Genomför 3 pass denna vecka", target: 3, progress: 1, completed: false });
  }

  // Achievements
  const { data: allAch } = await supabase.from("achievements").select("*");
  const { data: ua } = await supabase
    .from("user_achievements")
    .select("achievement_id, unlocked_at")
    .eq("user_id", userId);
  const unlockedIds = new Set((ua ?? []).filter((u: any) => u.unlocked_at).map((u: any) => u.achievement_id));

  // Distinct session types
  const { data: typeRows } = await supabase
    .from("workouts")
    .select("session_type")
    .eq("user_id", userId);
  const distinctTypes = new Set<string>((typeRows ?? []).map((r: any) => r.session_type));
  distinctTypes.add(payload.session_type);

  // Total run distance
  const { data: runRows } = await supabase
    .from("running_sessions")
    .select("distance_km, workout_id, workouts!inner(user_id)")
    .eq("workouts.user_id", userId);
  const totalDistance = (runRows ?? []).reduce((s: number, r: any) => s + Number(r.distance_km || 0), 0);

  // PR count
  const { data: prRows } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", userId)
    .eq("had_pr", true);
  const prCount = (prRows ?? []).length;

  const unlocked: { code: string; name: string }[] = [];
  for (const ach of allAch ?? []) {
    if (unlockedIds.has(ach.id)) continue;
    let pass = false;
    switch (ach.criteria_type) {
      case "total_sessions":
        pass = totalSessions >= ach.criteria_value;
        break;
      case "streak_days":
        pass = newStreak >= ach.criteria_value;
        break;
      case "first_run":
        pass = payload.session_type === "löpning";
        break;
      case "total_distance":
        pass = totalDistance >= ach.criteria_value;
        break;
      case "pr_count":
        pass = prCount >= ach.criteria_value;
        break;
      case "level":
        pass = newLevel >= ach.criteria_value;
        break;
      case "all_types":
        pass = ["styrka", "cirkel", "löpning"].every((t) => distinctTypes.has(t));
        break;
    }
    if (pass) {
      await supabase
        .from("user_achievements")
        .upsert(
          { user_id: userId, achievement_id: ach.id, unlocked_at: new Date().toISOString(), progress: 1 },
          { onConflict: "user_id,achievement_id" },
        );
      unlocked.push({ code: ach.code, name: ach.name });
    }
  }

  return { xp_gained: xpGained, total_xp: totalXp, new_level: newLevel, leveled_up: leveledUp, streak: newStreak, unlocked };
}

// ---------- Server functions ----------

const StrengthSet = z.object({
  exercise_id: z.string().uuid(),
  set_index: z.number().int().min(1),
  weight: z.number().nullable().optional(),
  reps: z.number().int().nullable().optional(),
  rpe: z.number().nullable().optional(),
});

const LogStrengthInput = z.object({
  date: z.string().regex(ISO_DATE_RE),
  template_id: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  duration_minutes: z.number().int().nullable().optional(),
  sets: z.array(StrengthSet).min(1),
  session_type: z.enum(["styrka", "cirkel"]).default("styrka"),
});

export const logStrengthOrCircuit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LogStrengthInput.parse(d))
  .handler(async ({ data, context }): Promise<LogResult> => {
    const { supabase, userId } = context;

    // PR detection: per exercise compare best weight*reps to history
    const exerciseIds = Array.from(new Set(data.sets.map((s) => s.exercise_id)));
    const { data: prevSets } = await supabase
      .from("sets")
      .select("exercise_id, weight, reps, workouts!inner(user_id)")
      .in("exercise_id", exerciseIds)
      .eq("workouts.user_id", userId);
    const prevBest = new Map<string, number>();
    for (const s of prevSets ?? []) {
      const v = Number(s.weight ?? 0) * Number(s.reps ?? 0);
      const cur = prevBest.get(s.exercise_id) ?? 0;
      if (v > cur) prevBest.set(s.exercise_id, v);
    }
    const prs: string[] = [];
    const newBest = new Map<string, number>();
    for (const s of data.sets) {
      const v = Number(s.weight ?? 0) * Number(s.reps ?? 0);
      const cur = newBest.get(s.exercise_id) ?? 0;
      if (v > cur) newBest.set(s.exercise_id, v);
    }
    for (const [eid, v] of newBest) {
      const prev = prevBest.get(eid) ?? 0;
      if (v > 0 && v > prev) prs.push(eid);
    }

    // Insert workout
    const { data: workout, error: wErr } = await supabase
      .from("workouts")
      .insert({
        user_id: userId,
        date: data.date,
        session_type: data.session_type,
        template_id: data.template_id ?? null,
        notes: data.notes ?? null,
        duration_minutes: data.duration_minutes ?? null,
        had_pr: prs.length > 0,
        xp_awarded: 0,
      })
      .select()
      .single();
    if (wErr || !workout) throw new Error(wErr?.message ?? "Kunde inte spara pass");

    const setsRows = data.sets.map((s) => ({
      workout_id: workout.id,
      exercise_id: s.exercise_id,
      set_index: s.set_index,
      weight: s.weight ?? null,
      reps: s.reps ?? null,
      rpe: s.rpe ?? null,
    }));
    await supabase.from("sets").insert(setsRows);

    const xpBase = data.session_type === "cirkel" ? 60 : 50;
    const stats = await updateStatsAndAchievements(supabase, userId, {
      session_type: data.session_type,
      date: data.date,
      had_pr: prs.length > 0,
      xp_base: xpBase,
    });

    await supabase.from("workouts").update({ xp_awarded: stats.xp_gained }).eq("id", workout.id);

    return {
      workout_id: workout.id,
      xp_gained: stats.xp_gained,
      total_xp: stats.total_xp,
      new_level: stats.new_level,
      leveled_up: stats.leveled_up,
      streak: stats.streak,
      prs,
      unlocked_achievements: stats.unlocked,
    };
  });

const LogRunningInput = z.object({
  date: z.string().regex(ISO_DATE_RE),
  distance_km: z.number().positive(),
  duration_minutes: z.number().positive(),
  effort_level: z.number().int().min(1).max(10).optional(),
  route_notes: z.string().optional(),
});

export const logRunning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LogRunningInput.parse(d))
  .handler(async ({ data, context }): Promise<LogResult> => {
    const { supabase, userId } = context;

    // PR: compare distance, duration, pace vs history
    const { data: prevRuns } = await supabase
      .from("running_sessions")
      .select("distance_km, duration_minutes, avg_pace_seconds, workouts!inner(user_id)")
      .eq("workouts.user_id", userId);
    const prevMaxDist = (prevRuns ?? []).reduce((m: number, r: any) => Math.max(m, Number(r.distance_km)), 0);
    const prevBestPace = (prevRuns ?? []).reduce(
      (m: number, r: any) => (m === 0 ? Number(r.avg_pace_seconds) : Math.min(m, Number(r.avg_pace_seconds))),
      0,
    );

    const avgPaceSeconds = Math.round((data.duration_minutes * 60) / data.distance_km);
    const prs: string[] = [];
    if (data.distance_km > prevMaxDist) prs.push("distance");
    if (prevBestPace > 0 && avgPaceSeconds < prevBestPace) prs.push("pace");

    const { data: workout, error: wErr } = await supabase
      .from("workouts")
      .insert({
        user_id: userId,
        date: data.date,
        session_type: "löpning",
        duration_minutes: Math.round(data.duration_minutes),
        had_pr: prs.length > 0,
        xp_awarded: 0,
      })
      .select()
      .single();
    if (wErr || !workout) throw new Error(wErr?.message ?? "Kunde inte spara löprunda");

    await supabase.from("running_sessions").insert({
      workout_id: workout.id,
      distance_km: data.distance_km,
      duration_minutes: data.duration_minutes,
      avg_pace_seconds: avgPaceSeconds,
      effort_level: data.effort_level ?? null,
      route_notes: data.route_notes ?? null,
    });

    const stats = await updateStatsAndAchievements(supabase, userId, {
      session_type: "löpning",
      date: data.date,
      had_pr: prs.length > 0,
      xp_base: 50,
      distance_km: data.distance_km,
    });

    await supabase.from("workouts").update({ xp_awarded: stats.xp_gained }).eq("id", workout.id);

    return {
      workout_id: workout.id,
      xp_gained: stats.xp_gained,
      total_xp: stats.total_xp,
      new_level: stats.new_level,
      leveled_up: stats.leveled_up,
      streak: stats.streak,
      prs,
      unlocked_achievements: stats.unlocked,
    };
  });

// ---------- Reads ----------

export const getExercisesAndTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: exercises }, { data: templates }, { data: tplExercises }] = await Promise.all([
      supabase.from("exercises").select("*").order("category").order("name"),
      supabase.from("workout_templates").select("*").order("name"),
      supabase.from("template_exercises").select("*").order("order_index"),
    ]);
    return { exercises: exercises ?? [], templates: templates ?? [], template_exercises: tplExercises ?? [] };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Ensure stats row exists
    await supabase.from("user_stats").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

    const [{ data: stats }, { data: profile }, { data: heatmapRows }, { data: latestAch }, { data: quest }] =
      await Promise.all([
        supabase.from("user_stats").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("workouts")
          .select("date, session_type")
          .eq("user_id", userId)
          .gte("date", isoDate(new Date(Date.now() - 42 * 86400000))),
        supabase
          .from("user_achievements")
          .select("unlocked_at, achievements(*)")
          .eq("user_id", userId)
          .not("unlocked_at", "is", null)
          .order("unlocked_at", { ascending: false })
          .limit(3),
        supabase
          .from("weekly_quests")
          .select("*")
          .eq("user_id", userId)
          .eq("week_start", weekStartISO())
          .maybeSingle(),
      ]);

    // Strength chart: best weight*reps per workout for top exercise (Knäböj if exists, else first)
    const { data: setRows } = await supabase
      .from("sets")
      .select("weight, reps, exercise_id, workouts!inner(date, user_id)")
      .eq("workouts.user_id", userId)
      .order("workouts(date)", { ascending: true });

    const strengthSeries: { date: string; value: number }[] = [];
    const squatId = "11111111-0000-0000-0000-000000000001";
    const bestPerDate = new Map<string, number>();
    for (const s of setRows ?? []) {
      if (s.exercise_id !== squatId) continue;
      const d = (s.workouts as any).date;
      const v = Number(s.weight ?? 0);
      bestPerDate.set(d, Math.max(bestPerDate.get(d) ?? 0, v));
    }
    for (const [d, v] of Array.from(bestPerDate.entries()).sort()) strengthSeries.push({ date: d, value: v });

    // Running series
    const { data: runs } = await supabase
      .from("running_sessions")
      .select("distance_km, avg_pace_seconds, workouts!inner(date, user_id)")
      .eq("workouts.user_id", userId)
      .order("workouts(date)", { ascending: true });
    const runningSeries = (runs ?? []).map((r: any) => ({
      date: r.workouts.date,
      distance: Number(r.distance_km),
      pace: Number(r.avg_pace_seconds),
    }));

    // Senaste 7 dagar – sammanfattning per typ
    const sevenAgo = isoDate(new Date(Date.now() - 7 * 86400000));
    const last7Rows = (heatmapRows ?? []).filter((r: any) => r.date >= sevenAgo);
    const last7 = {
      total: last7Rows.length,
      styrka: last7Rows.filter((r: any) => r.session_type === "styrka").length,
      cirkel: last7Rows.filter((r: any) => r.session_type === "cirkel").length,
      löpning: last7Rows.filter((r: any) => r.session_type === "löpning").length,
    };

    return {
      stats: stats ?? {
        total_sessions: 0,
        current_streak: 0,
        longest_streak: 0,
        total_xp: 0,
        current_level: 0,
        last_workout_date: null,
      },
      profile,
      heatmap: heatmapRows ?? [],
      recent_achievements: (latestAch ?? []).map((u: any) => u.achievements),
      quest,
      strength_series: strengthSeries,
      running_series: runningSeries,
      last7,
    };
  });


export const getHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ filter: z.enum(["alla", "styrka", "cirkel", "löpning"]).default("alla") }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("workouts").select("*, running_sessions(*)").eq("user_id", userId).order("date", { ascending: false });
    if (data.filter !== "alla") q = q.eq("session_type", data.filter);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const getWorkoutDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: w } = await supabase
      .from("workouts")
      .select("*, running_sessions(*), sets(*, exercises(*))")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    return w;
  });

export const getAchievements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: all }, { data: ua }] = await Promise.all([
      supabase.from("achievements").select("*"),
      supabase.from("user_achievements").select("*").eq("user_id", userId),
    ]);
    const map = new Map((ua ?? []).map((u: any) => [u.achievement_id, u]));
    return (all ?? []).map((a: any) => ({ ...a, unlocked_at: map.get(a.id)?.unlocked_at ?? null }));
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ display_name: z.string().min(1).max(50), units_weight: z.enum(["kg", "lb"]), units_distance: z.enum(["km", "mi"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("profiles").upsert({ id: userId, ...data });
    return { ok: true };
  });

// ---------- Demo seed ----------

export const seedDemoIfEmpty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: stats } = await supabase.from("user_stats").select("total_sessions").eq("user_id", userId).maybeSingle();
    if (stats && stats.total_sessions > 0) return { seeded: false };

    const today = new Date();
    // 14 sessions across last 6 weeks - mostly compact recent
    const offsets = [1, 2, 4, 6, 8, 10, 12, 14, 17, 20, 22, 25, 28, 32];
    const squatId = "11111111-0000-0000-0000-000000000001";
    const dlId = "11111111-0000-0000-0000-000000000002";
    const pushId = "11111111-0000-0000-0000-000000000004";
    const pullId = "11111111-0000-0000-0000-000000000007";
    const burpeeId = "11111111-0000-0000-0000-00000000000c";
    const swingId = "11111111-0000-0000-0000-00000000000f";
    const passA = "22222222-0000-0000-0000-000000000001";
    const passB = "22222222-0000-0000-0000-000000000002";
    const cirkel = "22222222-0000-0000-0000-000000000003";

    let squatWeight = 70;
    let totalXp = 0;
    let totalSessions = 0;
    let lastDate: string | null = null;
    let streak = 0;
    let longest = 0;

    // Iterate from oldest to newest
    const ordered = [...offsets].sort((a, b) => b - a);

    for (const off of ordered) {
      const d = new Date(today);
      d.setDate(d.getDate() - off);
      const dISO = isoDate(d);
      const r = off % 3;
      let type: "styrka" | "cirkel" | "löpning";
      let template_id: string | null = null;
      if (r === 0) {
        type = "styrka";
        template_id = passA;
      } else if (r === 1) {
        type = "cirkel";
        template_id = cirkel;
      } else {
        type = "löpning";
      }
      if (off === 4 || off === 8) {
        type = "styrka";
        template_id = passB;
      }

      const xpBase = type === "cirkel" ? 60 : 50;
      const xp = xpBase;

      const { data: w } = await supabase
        .from("workouts")
        .insert({
          user_id: userId,
          date: dISO,
          session_type: type,
          template_id,
          duration_minutes: type === "löpning" ? 32 : type === "cirkel" ? 22 : 48,
          xp_awarded: xp,
          had_pr: false,
        })
        .select()
        .single();

      if (w) {
        if (type === "styrka") {
          if (template_id === passA) {
            for (let i = 1; i <= 4; i++) {
              await supabase.from("sets").insert({ workout_id: w.id, exercise_id: squatId, set_index: i, weight: squatWeight, reps: 8 });
              await supabase.from("sets").insert({ workout_id: w.id, exercise_id: pushId, set_index: i, weight: 0, reps: 12 });
            }
            squatWeight += 2.5;
          } else {
            for (let i = 1; i <= 4; i++) {
              await supabase.from("sets").insert({ workout_id: w.id, exercise_id: dlId, set_index: i, weight: 90, reps: 6 });
              await supabase.from("sets").insert({ workout_id: w.id, exercise_id: pullId, set_index: i, weight: 0, reps: 8 });
            }
          }
        } else if (type === "cirkel") {
          for (let i = 1; i <= 4; i++) {
            await supabase.from("sets").insert({ workout_id: w.id, exercise_id: burpeeId, set_index: i, weight: 0, reps: 10 });
            await supabase.from("sets").insert({ workout_id: w.id, exercise_id: swingId, set_index: i, weight: 16, reps: 15 });
          }
        } else {
          const dist = 4 + Math.random() * 3;
          const dur = dist * (5.5 + Math.random() * 0.7);
          await supabase.from("running_sessions").insert({
            workout_id: w.id,
            distance_km: Number(dist.toFixed(2)),
            duration_minutes: Number(dur.toFixed(1)),
            avg_pace_seconds: Math.round((dur * 60) / dist),
            effort_level: 6,
          });
        }
      }

      // Streak calc
      if (lastDate) {
        const prev = new Date(lastDate);
        prev.setDate(prev.getDate() + 1);
        streak = isoDate(prev) === dISO ? streak + 1 : 1;
      } else {
        streak = 1;
      }
      longest = Math.max(longest, streak);
      lastDate = dISO;
      totalXp += xp;
      totalSessions += 1;
    }

    // Streak as-of today: only "current" if last workout was today or yesterday
    const todayISO = isoDate(today);
    let currentStreak = streak;
    if (lastDate !== todayISO) {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      if (lastDate !== isoDate(yest)) currentStreak = 0;
    }

    const level = levelFromXp(totalXp);
    await supabase.from("user_stats").upsert({
      user_id: userId,
      total_sessions: totalSessions,
      current_streak: currentStreak,
      longest_streak: longest,
      total_xp: totalXp,
      current_level: level,
      last_workout_date: lastDate,
    });

    // Unlock a few achievements
    const { data: ach } = await supabase.from("achievements").select("*");
    const codesToUnlock = ["first_session", "streak_3", "first_run", "first_pr"];
    for (const a of ach ?? []) {
      if (codesToUnlock.includes(a.code)) {
        await supabase
          .from("user_achievements")
          .upsert(
            { user_id: userId, achievement_id: a.id, unlocked_at: new Date().toISOString(), progress: 1 },
            { onConflict: "user_id,achievement_id" },
          );
      }
    }

    // Weekly quest
    const wk = weekStartISO();
    await supabase
      .from("weekly_quests")
      .upsert(
        { user_id: userId, week_start: wk, description: "Genomför 3 pass denna vecka", target: 3, progress: 1, completed: false },
        { onConflict: "user_id,week_start" },
      );

    return { seeded: true };
  });

// ---------- Quick minimum session (low-motivation days) ----------

const LogQuickInput = z.object({
  date: z.string().regex(ISO_DATE_RE),
  session_type: z.enum(["styrka", "cirkel", "löpning"]),
  duration_minutes: z.number().int().min(5).max(60).default(15),
  energy_level: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
});

export const logQuickSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LogQuickInput.parse(d))
  .handler(async ({ data, context }): Promise<LogResult> => {
    const { supabase, userId } = context;

    const { data: workout, error: wErr } = await supabase
      .from("workouts")
      .insert({
        user_id: userId,
        date: data.date,
        session_type: data.session_type,
        duration_minutes: data.duration_minutes,
        energy_level: data.energy_level ?? null,
        notes: data.notes ?? "Minipass",
        had_pr: false,
        xp_awarded: 0,
      })
      .select()
      .single();
    if (wErr || !workout) throw new Error(wErr?.message ?? "Kunde inte spara minipass");

    if (data.session_type === "löpning") {
      const distance = Math.max(1, Math.round((data.duration_minutes / 6) * 10) / 10);
      const avgPace = Math.round((data.duration_minutes * 60) / distance);
      await supabase.from("running_sessions").insert({
        workout_id: workout.id,
        distance_km: distance,
        duration_minutes: data.duration_minutes,
        avg_pace_seconds: avgPace,
        effort_level: 4,
      });
    }

    // Minipass: halverad XP men full streak
    const stats = await updateStatsAndAchievements(supabase, userId, {
      session_type: data.session_type,
      date: data.date,
      had_pr: false,
      xp_base: 25,
    });

    await supabase.from("workouts").update({ xp_awarded: stats.xp_gained }).eq("id", workout.id);

    return {
      workout_id: workout.id,
      xp_gained: stats.xp_gained,
      total_xp: stats.total_xp,
      new_level: stats.new_level,
      leveled_up: stats.leveled_up,
      streak: stats.streak,
      prs: [],
      unlocked_achievements: stats.unlocked,
    };
  });

// ---------- AI weekly review ----------

export const getWeeklyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const wkStart = weekStartISO();
    const wkEnd = new Date(wkStart);
    wkEnd.setDate(wkEnd.getDate() + 7);
    const wkEndISO = isoDate(wkEnd);

    // 14 dagar tillbaka för AI-kontext
    const ctx14Start = isoDate(new Date(Date.now() - 14 * 86400000));

    const [{ data: weekRows }, { data: ctxRows }, { data: stats }, goalsResult] = await Promise.all([
      supabase
        .from("workouts")
        .select("*, running_sessions(*), sets(weight, reps, exercises(name, category))")
        .eq("user_id", userId)
        .gte("date", wkStart)
        .lt("date", wkEndISO)
        .order("date"),
      supabase
        .from("workouts")
        .select("date, session_type, duration_minutes, energy_level, had_pr, running_sessions(distance_km, avg_pace_seconds)")
        .eq("user_id", userId)
        .gte("date", ctx14Start)
        .order("date"),
      supabase.from("user_stats").select("*").eq("user_id", userId).maybeSingle(),
      (async () => {
        const { listGoalsWithProgress } = await import("@/lib/goals.functions");
        // Call internally with same context (re-using middleware-bound supabase)
        try {
          const { data: goals } = await supabase
            .from("goals")
            .select("id, title, goal_type, target_value, target_unit, target_date, session_type, status")
            .eq("user_id", userId)
            .eq("status", "active");
          return goals ?? [];
        } catch {
          return [];
        }
      })(),
    ]);

    const workouts = weekRows ?? [];

    // Lyftvolym (sum of weight*reps) för veckan
    let totalVolume = 0;
    for (const w of workouts) {
      for (const s of (w as any).sets ?? []) {
        totalVolume += Number(s.weight ?? 0) * Number(s.reps ?? 0);
      }
    }

    const totalDistance = workouts.reduce(
      (s: number, w: any) => s + (w.running_sessions?.[0]?.distance_km ? Number(w.running_sessions[0].distance_km) : 0),
      0,
    );

    const distinctDays = new Set(workouts.map((w: any) => w.date));
    const prCount = workouts.filter((w: any) => w.had_pr).length;
    const prList = workouts
      .filter((w: any) => w.had_pr)
      .map((w: any) => ({
        date: w.date,
        type: w.session_type,
        detail:
          w.session_type === "löpning"
            ? `${w.running_sessions?.[0]?.distance_km ?? "?"} km`
            : ((w.sets ?? [])
                .map((s: any) => `${s.exercises?.name ?? ""} ${s.weight ?? 0}×${s.reps ?? 0}`)
                .slice(0, 2)
                .join(", ")),
      }));

    const energyVals = workouts
      .map((w: any) => w.energy_level)
      .filter((e: any) => typeof e === "number") as number[];
    const energyAvg = energyVals.length ? energyVals.reduce((a, b) => a + b, 0) / energyVals.length : null;
    const energyTrend = energyVals.length >= 2 ? energyVals[energyVals.length - 1] - energyVals[0] : 0;

    const summary = {
      total: workouts.length,
      strength: workouts.filter((w: any) => w.session_type === "styrka").length,
      circuit: workouts.filter((w: any) => w.session_type === "cirkel").length,
      running: workouts.filter((w: any) => w.session_type === "löpning").length,
      total_distance: totalDistance,
      total_volume_kg: Math.round(totalVolume),
      days_trained: distinctDays.size,
      pr_count: prCount,
      prs: prList,
      current_streak: stats?.current_streak ?? 0,
      energy_avg: energyAvg,
      energy_trend: energyTrend,
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    let insights = "";
    if (apiKey) {
      try {
        const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
        const { generateText } = await import("ai");
        const gateway = createLovableAiGatewayProvider(apiKey);

        const dayName = (d: string) =>
          new Date(d).toLocaleDateString("sv-SE", { weekday: "short" });
        const compact = (ctxRows ?? []).map((w: any) => ({
          date: w.date,
          dag: dayName(w.date),
          typ: w.session_type,
          min: w.duration_minutes,
          energi: w.energy_level,
          pr: w.had_pr,
          km: w.running_sessions?.[0]?.distance_km ?? null,
          pace_s: w.running_sessions?.[0]?.avg_pace_seconds ?? null,
        }));

        const { text } = await generateText({
          model: gateway("google/gemini-3-flash-preview"),
          prompt:
            "Du är en rak, klok svensk träningscoach för en småbarnsförälder med begränsad tid. " +
            "Användaren tränar styrka, cirkel och löpning hemma. Fokus är consistency, inte perfektion.\n\n" +
            "Data senaste 14 dagar (JSON):\n" +
            JSON.stringify(compact) +
            "\n\nDenna veckas sammanfattning:\n" +
            JSON.stringify({
              pass: summary.total,
              styrka: summary.strength,
              cirkel: summary.circuit,
              löpning: summary.running,
              dagar_med_träning: summary.days_trained,
              streak: summary.current_streak,
              total_volym_kg: summary.total_volume_kg,
              total_km: Math.round(summary.total_distance * 10) / 10,
              pr_antal: summary.pr_count,
              snitt_energi: summary.energy_avg,
            }) +
            "\n\nGe EXAKT 3 punkter på svenska, varje punkt 1–2 meningar. " +
            "Var konkret och personlig: hänvisa till specifika veckodagar, mönster, kombinationer av passtyper eller energinivåer. " +
            "Undvik generiska råd som 'bra jobbat', 'fortsätt så' eller 'kom ihåg att vila'. " +
            "Föreslå EN konkret handling per punkt (t.ex. 'flytta ett kort styrkepass till lördag', 'kombinera löpning med cirkel på onsdag'). " +
            "Format: bara tre punkter med '- ' framför. Ingen rubrik, ingen disclaimer.",
        });
        insights = text.trim();
      } catch (e) {
        console.error(e);
      }
    }

    if (!insights) {
      insights = summary.total === 0
        ? "- Veckan är fortfarande öppen – ett 15-minuters minipass idag håller din streak vid liv.\n- Lägg ett kort cirkelpass på lunchen för att bryta stillasittande.\n- Plocka en löprunda på 20 min i kväll om vädret tillåter."
        : `- Du har ${summary.total} pass och ${summary.days_trained} träningsdagar – bygg vidare med ett kort pass till innan veckan tar slut.\n- Balansen ${summary.strength}/${summary.circuit}/${summary.running} (styrka/cirkel/löpning) ser ${summary.strength === 0 ? "tunn ut på styrka – lägg ett kort styrkepass" : "stabil ut"}.\n- Streak: ${summary.current_streak} dagar. Skydda den med ett minipass på lågmotivationsdagar.`;
    }

    return { summary, insights };
  });

