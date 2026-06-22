import { Link } from "@tanstack/react-router";
import { Dumbbell, Footprints, Timer, CalendarClock, ChevronRight, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type GoalWithProgress = {
  id: string;
  title: string;
  goal_type: "strength" | "distance" | "sessions" | "event";
  target_value: number;
  target_unit: string;
  target_reps: number | null;
  target_date: string | null;
  session_type: string | null;
  exercises?: { name: string } | null;
  current_value: number;
  current_label: string;
  progress_pct: number;
  pace: "ahead" | "on_track" | "behind" | "danger";
  days_left: number | null;
  weeks_left: number | null;
  expected_pct: number | null;
  completed: boolean;
};

const PACE_COLOR: Record<GoalWithProgress["pace"], string> = {
  ahead: "bg-emerald-500",
  on_track: "bg-primary",
  behind: "bg-amber-500",
  danger: "bg-red-500",
};

const PACE_LABEL: Record<GoalWithProgress["pace"], string> = {
  ahead: "Före plan",
  on_track: "På rätt spår",
  behind: "Behöver öka takten",
  danger: "Risk att missa",
};

const PACE_TEXT: Record<GoalWithProgress["pace"], string> = {
  ahead: "text-emerald-400",
  on_track: "text-primary",
  behind: "text-amber-400",
  danger: "text-red-400",
};

function GoalIcon({ type }: { type: GoalWithProgress["goal_type"] }) {
  if (type === "strength") return <Dumbbell className="h-4 w-4" />;
  if (type === "distance") return <Footprints className="h-4 w-4" />;
  if (type === "event") return <CalendarClock className="h-4 w-4" />;
  return <Timer className="h-4 w-4" />;
}

export function GoalCard({ goal, compact = false }: { goal: GoalWithProgress; compact?: boolean }) {
  const pct = goal.progress_pct;
  const targetLabel =
    goal.goal_type === "strength"
      ? `${goal.target_value} kg${goal.target_reps ? ` × ${goal.target_reps}` : ""}`
      : `${goal.target_value} ${goal.target_unit}`;

  const urgent =
    goal.goal_type === "event" && goal.weeks_left !== null && goal.weeks_left <= 6 && !goal.completed;

  return (
    <Link to="/goals/$id" params={{ id: goal.id }} className="block">
      <Card
        className={cn(
          "relative overflow-hidden border-border bg-card p-4 transition-all hover:border-primary/50",
          urgent && "border-amber-500/50",
          goal.completed && "border-emerald-500/50",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/60">
                <GoalIcon type={goal.goal_type} />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                {goal.exercises?.name ?? goal.session_type ?? goal.goal_type}
              </span>
              {goal.completed && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Klart
                </span>
              )}
            </div>
            <p className="truncate text-base font-bold">{goal.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-mono text-foreground">{goal.current_label}</span>
              <span className="mx-1.5">/</span>
              <span className="font-mono">{targetLabel}</span>
            </p>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
            {/* Expected marker for event goals */}
            {goal.expected_pct !== null && (
              <div
                className="absolute top-0 h-full w-px bg-foreground/60"
                style={{ left: `${goal.expected_pct}%` }}
                title="Förväntad takt"
              />
            )}
            <div
              className={cn("absolute inset-y-0 left-0 rounded-full transition-all", PACE_COLOR[goal.pace])}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className={cn("font-semibold", PACE_TEXT[goal.pace])}>{PACE_LABEL[goal.pace]}</span>
            <span className="font-mono text-muted-foreground">{pct}%</span>
          </div>
        </div>

        {/* Countdown */}
        {goal.target_date && goal.days_left !== null && !goal.completed && (
          <div
            className={cn(
              "mt-3 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs",
              urgent ? "bg-amber-500/10 text-amber-400" : "bg-muted/40 text-muted-foreground",
            )}
          >
            {urgent && <AlertTriangle className="h-3.5 w-3.5" />}
            <CalendarClock className="h-3.5 w-3.5" />
            <span>
              {goal.days_left === 0
                ? "Idag!"
                : goal.weeks_left! <= 2
                  ? `${goal.days_left} dagar kvar`
                  : `${goal.weeks_left} veckor kvar`}
            </span>
            {urgent && goal.pace !== "ahead" && (
              <span className="ml-auto font-semibold">
                {goal.pace === "danger" ? "Långt efter" : "Efter plan"}
              </span>
            )}
          </div>
        )}

        {!compact && goal.goal_type === "event" && urgent && (
          <p className="mt-2 text-xs leading-relaxed text-amber-300/90">
            Mindre än 6 veckor till deadline. Prioritera de pass som driver målet framåt.
          </p>
        )}
      </Card>
    </Link>
  );
}
