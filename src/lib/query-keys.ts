/**
 * Centralized React Query key factory. Always reference these from
 * components, loaders, and mutations so cache invalidation stays in sync.
 */

export const qk = {
  dashboard: ["dashboard"] as const,
  goals: ["goals"] as const,
  exercises: ["exercises"] as const,
  achievements: ["achievements"] as const,
  history: (filter: string = "alla") => ["history", filter] as const,
  historyAll: ["history"] as const,
  workout: (id: string) => ["workout", id] as const,
  celebration: (id: string) => ["celebration", id] as const,
  weeklyReview: ["weekly-review"] as const,
  monthlyReview: ["monthly-review"] as const,
};
