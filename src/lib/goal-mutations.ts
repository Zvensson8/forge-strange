/**
 * Optimistic mutations for goal CRUD. All mutations write to the shared
 * `qk.goals` cache so the goals list and dashboard react instantly.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createGoal, deleteGoal, updateGoal } from "@/lib/goals.functions";
import { qk } from "@/lib/query-keys";
import type { Goal, GoalInput } from "@/lib/types";

type GoalsCache = (Goal & Record<string, unknown>)[];

export function useCreateGoalMutation() {
  const qc = useQueryClient();
  const fn = useServerFn(createGoal);
  return useMutation<Goal, Error, GoalInput, { prev: GoalsCache | undefined }>({
    mutationFn: (data) => fn({ data }) as Promise<Goal>,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.goals });
      const prev = qc.getQueryData<GoalsCache>(qk.goals);
      const optimistic = {
        id: `optimistic-${crypto.randomUUID()}`,
        user_id: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "active",
        progress_pct: 0,
        current_value: 0,
        current_label: "—",
        pace: "on_track",
        trend: [],
        weekly_buckets: [],
        ...vars,
      } as unknown as GoalsCache[number];
      qc.setQueryData<GoalsCache>(qk.goals, prev ? [optimistic, ...prev] : [optimistic]);
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(qk.goals, ctx.prev);
      toast.error(err.message || "Kunde inte spara mål");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.goals });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUpdateGoalMutation() {
  const qc = useQueryClient();
  const fn = useServerFn(updateGoal);
  return useMutation<
    { ok: boolean },
    Error,
    { id: string; patch: Partial<Goal> & Record<string, unknown> },
    { prev: GoalsCache | undefined }
  >({
    mutationFn: (vars) => fn({ data: vars as any }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.goals });
      const prev = qc.getQueryData<GoalsCache>(qk.goals);
      if (prev) {
        qc.setQueryData<GoalsCache>(
          qk.goals,
          prev.map((g) => (g.id === vars.id ? { ...g, ...vars.patch } : g)),
        );
      }
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(qk.goals, ctx.prev);
      toast.error(err.message || "Kunde inte uppdatera mål");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.goals });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useDeleteGoalMutation() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteGoal);
  return useMutation<
    { ok: boolean },
    Error,
    { id: string },
    { prev: GoalsCache | undefined }
  >({
    mutationFn: (vars) => fn({ data: vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.goals });
      const prev = qc.getQueryData<GoalsCache>(qk.goals);
      if (prev) {
        qc.setQueryData<GoalsCache>(qk.goals, prev.filter((g) => g.id !== vars.id));
      }
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(qk.goals, ctx.prev);
      toast.error(err.message || "Kunde inte ta bort mål");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.goals });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}
