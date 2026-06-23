/**
 * Shared app types + Zod schemas.
 *
 * Single source of truth for forms (RHF) and server-function validators.
 * Importing this file is safe in both client and server modules — no
 * server-only side effects.
 */

import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

type Tables = Database["public"]["Tables"];

export type WorkoutRow = Tables["workouts"]["Row"];
export type WorkoutInsert = Tables["workouts"]["Insert"];
export type SetRow = Tables["sets"]["Row"];
export type SetInsert = Tables["sets"]["Insert"];
export type RunningSessionRow = Tables["running_sessions"]["Row"];
export type GoalRow = Tables["goals"]["Row"];
export type GoalInsert = Tables["goals"]["Insert"];
export type ExerciseRow = Tables["exercises"]["Row"];
export type AchievementRow = Tables["achievements"]["Row"];
export type UserStatsRow = Tables["user_stats"]["Row"];
export type WeeklyQuestRow = Tables["weekly_quests"]["Row"];
export type ProfileRow = Tables["profiles"]["Row"];
export type WorkoutTemplateRow = Tables["workout_templates"]["Row"];
export type TemplateExerciseRow = Tables["template_exercises"]["Row"];

// Convenience aliases preferred by app code
export type Workout = WorkoutRow & { running_sessions?: RunningSessionRow[] | null };
export type WorkoutWithDetails = WorkoutRow & {
  running_sessions?: RunningSessionRow[] | null;
  sets?: (SetRow & { exercises?: ExerciseRow | null })[] | null;
};
export type Goal = GoalRow;
export type Exercise = ExerciseRow;

// ---------------------------------------------------------------------------
// Enums + shared primitives
// ---------------------------------------------------------------------------

export const SESSION_TYPES = ["styrka", "cirkel", "löpning", "cykling", "promenad"] as const;
export const DISTANCE_SESSION_TYPES = ["löpning", "cykling", "promenad"] as const;
export const GOAL_TYPES = ["strength", "distance", "sessions", "event", "process"] as const;
export const PROCESS_PERIODS = ["week", "month"] as const;
export const PROCESS_METRICS = ["sessions", "km"] as const;

export type SessionType = (typeof SESSION_TYPES)[number];
export type DistanceType = (typeof DISTANCE_SESSION_TYPES)[number];
export type GoalType = (typeof GOAL_TYPES)[number];
export type ProcessPeriod = (typeof PROCESS_PERIODS)[number];
export type ProcessMetric = (typeof PROCESS_METRICS)[number];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isoDateSchema = z.string().regex(ISO_DATE_RE, "Måste vara YYYY-MM-DD");

// Coerce empty strings / NaN safely to a number. RHF + <Input type="number">
// can emit "" which Number() turns into 0 but parseFloat into NaN — z.coerce
// alone is brittle, so we normalize before parsing.
const numberFromInput = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  return v;
}, z.number());

// ---------------------------------------------------------------------------
// Goal schema (mirrors server validator)
// ---------------------------------------------------------------------------

export const goalSchema = z.object({
  title: z.string().min(1, "Titel saknas").max(120),
  goal_type: z.enum(GOAL_TYPES),
  target_value: numberFromInput.refine((n) => n >= 0, "Måste vara ≥ 0"),
  target_unit: z.string().min(1).max(20),
  target_reps: numberFromInput.int().positive().nullable().optional(),
  exercise_id: z.string().uuid().nullable().optional(),
  session_type: z.enum(SESSION_TYPES).nullable().optional(),
  target_date: isoDateSchema.nullable().optional(),
  start_date: isoDateSchema.optional(),
  reminder_enabled: z.boolean().default(false),
  reminder_cadence: z.enum(["daily", "weekly"]).default("weekly"),
  notes: z.string().optional(),
  parent_goal_id: z.string().uuid().nullable().optional(),
  process_period: z.enum(PROCESS_PERIODS).nullable().optional(),
  process_target_count: numberFromInput.positive().nullable().optional(),
  process_metric: z.enum(PROCESS_METRICS).nullable().optional(),
});

export type GoalInput = z.infer<typeof goalSchema>;

// ---------------------------------------------------------------------------
// Workout / log schemas
// ---------------------------------------------------------------------------

export const strengthSetSchema = z.object({
  exercise_id: z.string().uuid(),
  set_index: z.number().int().min(1),
  weight: z.number().nullable().optional(),
  reps: z.number().int().nullable().optional(),
  rpe: z.number().nullable().optional(),
});

export const logStrengthSchema = z.object({
  date: isoDateSchema,
  template_id: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  duration_minutes: z.number().int().nullable().optional(),
  sets: z.array(strengthSetSchema).min(1, "Lägg till minst en övning"),
  session_type: z.enum(["styrka", "cirkel"]).default("styrka"),
});
export type LogStrengthInput = z.infer<typeof logStrengthSchema>;

export const logDistanceSchema = z.object({
  date: isoDateSchema,
  session_type: z.enum(DISTANCE_SESSION_TYPES).default("löpning"),
  distance_km: numberFromInput.positive("Distans måste vara > 0"),
  duration_minutes: numberFromInput.positive("Tid måste vara > 0"),
  effort_level: z.number().int().min(1).max(10).optional(),
  route_notes: z.string().optional(),
});
export type LogDistanceInput = z.infer<typeof logDistanceSchema>;

export const logQuickSchema = z.object({
  date: isoDateSchema,
  session_type: z.enum(["styrka", "cirkel", "löpning"]),
  duration_minutes: z.number().int().min(5).max(60).default(15),
  energy_level: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
});
export type LogQuickInput = z.infer<typeof logQuickSchema>;

// Server returns this for every log mutation
export type LogResult = {
  workout_id: string;
  xp_gained: number;
  total_xp: number;
  new_level: number;
  leveled_up: boolean;
  streak: number;
  prs: string[];
  unlocked_achievements: { code: string; name: string }[];
};
