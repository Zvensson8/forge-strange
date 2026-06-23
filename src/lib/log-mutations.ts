/**
 * Shared mutation hooks for workout logging with optimistic cache updates.
 *
 * The pattern: write a "pending" workout into the history list + bump
 * dashboard stats immediately so the UI reacts the same frame the user
 * presses save. Roll back on error, then invalidate on settled to reconcile
 * with server truth (XP, achievements, PRs).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  logQuickSession,
  logRunning,
  logStrengthOrCircuit,
} from "@/lib/workout.functions";
import { qk } from "@/lib/query-keys";
import { todayISO } from "@/lib/forge-utils";
import type {
  LogDistanceInput,
  LogQuickInput,
  LogResult,
  LogStrengthInput,
  SessionType,
  Workout,
} from "@/lib/types";

type Ctx = {
  prevHistory: Map<unknown, unknown>;
  prevDashboard: unknown;
};

type OptimisticWorkout = Workout & { session_type: SessionType };

function applyOptimisticHistory(
  qc: ReturnType<typeof useQueryClient>,
  fake: OptimisticWorkout,
): Map<unknown, unknown> {
  const prev = new Map<unknown, unknown>();
  const queries = qc.getQueriesData<Workout[]>({ queryKey: qk.historyAll });
  for (const [key, data] of queries) {
    prev.set(key, data);
    if (!data) continue;
    const filter = (key as unknown[])[1] as string | undefined;
    if (filter && filter !== "alla" && filter !== fake.session_type) continue;
    qc.setQueryData<Workout[]>(key as readonly unknown[] as any, [fake, ...data]);
  }
  return prev;
}

function applyOptimisticDashboard(
  qc: ReturnType<typeof useQueryClient>,
  date: string,
  session_type: SessionType,
): unknown {
  const prev = qc.getQueryData<any>(qk.dashboard);
  if (!prev) return prev;
  const sameDay = prev.stats?.last_workout_date === date;
  const next = {
    ...prev,
    stats: {
      ...prev.stats,
      total_sessions: (prev.stats?.total_sessions ?? 0) + 1,
      last_workout_date: date,
      current_streak: sameDay
        ? Math.max(prev.stats?.current_streak ?? 0, 1)
        : (prev.stats?.current_streak ?? 0) + 1,
    },
    last7: prev.last7
      ? {
          ...prev.last7,
          total: (prev.last7.total ?? 0) + 1,
          [session_type]: (prev.last7[session_type] ?? 0) + 1,
        }
      : prev.last7,
  };
  qc.setQueryData(qk.dashboard, next);
  return prev;
}

function rollback(
  qc: ReturnType<typeof useQueryClient>,
  ctx: Ctx | undefined,
) {
  if (!ctx) return;
  for (const [key, data] of ctx.prevHistory) {
    qc.setQueryData(key as any, data);
  }
  if (ctx.prevDashboard !== undefined) qc.setQueryData(qk.dashboard, ctx.prevDashboard);
}

function settledInvalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: qk.historyAll });
  qc.invalidateQueries({ queryKey: qk.dashboard });
  qc.invalidateQueries({ queryKey: qk.goals });
  qc.invalidateQueries({ queryKey: qk.achievements });
}

function fakeWorkout(
  session_type: SessionType,
  date: string,
  extras: Partial<Workout> = {},
): OptimisticWorkout {
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    user_id: "",
    date,
    session_type,
    template_id: null,
    notes: null,
    duration_minutes: null,
    energy_level: null,
    had_pr: false,
    xp_awarded: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...extras,
  } as Workout;
}

// ---------------------------------------------------------------------------
// Strength / Circuit
// ---------------------------------------------------------------------------

export function useLogStrengthMutation() {
  const qc = useQueryClient();
  const fn = useServerFn(logStrengthOrCircuit);
  return useMutation<LogResult, Error, LogStrengthInput, Ctx>({
    mutationFn: (data) => fn({ data }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.historyAll });
      await qc.cancelQueries({ queryKey: qk.dashboard });
      const fake = fakeWorkout(vars.session_type, vars.date, {
        template_id: vars.template_id ?? null,
        notes: vars.notes ?? null,
      });
      const prevHistory = applyOptimisticHistory(qc, fake);
      const prevDashboard = applyOptimisticDashboard(qc, vars.date, vars.session_type);
      return { prevHistory, prevDashboard };
    },
    onError: (err, _v, ctx) => {
      rollback(qc, ctx);
      toast.error(err.message || "Kunde inte spara pass");
    },
    onSettled: () => settledInvalidate(qc),
  });
}

// ---------------------------------------------------------------------------
// Running / Cycling / Walking
// ---------------------------------------------------------------------------

export function useLogDistanceMutation() {
  const qc = useQueryClient();
  const fn = useServerFn(logRunning);
  return useMutation<LogResult, Error, LogDistanceInput, Ctx>({
    mutationFn: (data) => fn({ data }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.historyAll });
      await qc.cancelQueries({ queryKey: qk.dashboard });
      const fake = fakeWorkout(vars.session_type, vars.date, {
        notes: vars.route_notes ?? null,
        duration_minutes: Math.round(vars.duration_minutes),
      });
      // Attach a stub running_session so list rows that show distance render
      (fake as any).running_sessions = [
        {
          distance_km: vars.distance_km,
          duration_minutes: vars.duration_minutes,
          avg_pace_seconds:
            vars.distance_km > 0
              ? Math.round((vars.duration_minutes * 60) / vars.distance_km)
              : null,
          effort_level: vars.effort_level ?? null,
        },
      ];
      const prevHistory = applyOptimisticHistory(qc, fake);
      const prevDashboard = applyOptimisticDashboard(qc, vars.date, vars.session_type);
      return { prevHistory, prevDashboard };
    },
    onError: (err, _v, ctx) => {
      rollback(qc, ctx);
      toast.error(err.message || "Kunde inte spara pass");
    },
    onSettled: () => settledInvalidate(qc),
  });
}

// ---------------------------------------------------------------------------
// Quick (minipass)
// ---------------------------------------------------------------------------

export function useLogQuickMutation() {
  const qc = useQueryClient();
  const fn = useServerFn(logQuickSession);
  return useMutation<LogResult, Error, LogQuickInput, Ctx>({
    mutationFn: (data) => fn({ data: { ...data, date: data.date || todayISO() } }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.historyAll });
      await qc.cancelQueries({ queryKey: qk.dashboard });
      const fake = fakeWorkout(vars.session_type, vars.date, {
        duration_minutes: vars.duration_minutes,
        energy_level: vars.energy_level ?? null,
        notes: "Minipass",
      });
      const prevHistory = applyOptimisticHistory(qc, fake);
      const prevDashboard = applyOptimisticDashboard(qc, vars.date, vars.session_type);
      return { prevHistory, prevDashboard };
    },
    onError: (err, _v, ctx) => {
      rollback(qc, ctx);
      toast.error(err.message || "Kunde inte spara minipass");
    },
    onSettled: () => settledInvalidate(qc),
  });
}
