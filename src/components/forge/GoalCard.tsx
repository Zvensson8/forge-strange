import { Link } from "@tanstack/react-router";
import { Dumbbell, Footprints, Timer, CalendarClock, ChevronRight, AlertTriangle, Repeat, GitBranch } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type GoalWithProgress = {
  id: string;
  title: string;
  goal_type: "strength" | "distance" | "sessions" | "event" | "process";
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
  parent_goal_id?: string | null;
  process_buckets?: { key: string; count: number; hit: boolean }[];
  process_target_per_period?: number;
  process_period?: "week" | "month" | null;
  required_per_week?: number | null;
  current_per_week?: number | null;
  trend?: { date: string; value: number }[];
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
  if (type === "process") return <Repeat className="h-4 w-4" />;
  return <Timer className="h-4 w-4" />;
}

function Sparkline({ data }: { data: { date: string; value: number }[] }) {
  if (data.length < 2) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 80;
    const y = 18 - ((v - min) / range) * 16;
    return `${x},${y}`;
  });
  return (
    <svg viewBox="0 0 80 20" className="h-5 w-20" preserveAspectRatio="none">
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function GoalCard({
  goal,
  compact = false,
  subGoals = [],
}: {
  goal: GoalWithProgress;
  compact?: boolean;
  subGoals?: GoalWithProgress[];
}) {
  const pct = goal.progress_pct;
  const targetLabel =
    goal.goal_type === "strength"
      ? `${goal.target_value} kg${goal.target_reps ? ` × ${goal.target_reps}` : ""}`
      : goal.goal_type === "process"
        ? `${goal.process_target_per_period ?? goal.target_value} pass/${goal.process_period === "month" ? "mån" : "v"}`
        : `${goal.target_value} ${goal.target_unit}`;

  const urgent =
    goal.goal_type === "event" && goal.weeks_left !== null && goal.weeks_left <= 6 && !goal.completed;
  const atRisk = (goal.pace === "behind" || goal.pace === "danger") && !goal.completed;

  return (
    <Link to="/goals/$id" params={{ id: goal.id }} className="block">
      <Card
        className={cn(
          "relative overflow-hidden border-border bg-card p-4 transition-all hover:border-primary/50",
          urgent && "border-amber-500/50",
          atRisk && goal.pace === "danger" && "border-red-500/50",
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
              {subGoals.length > 0 && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                  <GitBranch className="h-3 w-3" /> {subGoals.length} delmål
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
          {goal.trend && goal.trend.length > 1 && goal.goal_type !== "process" && (
            <div className={cn("mt-2 shrink-0", PACE_TEXT[goal.pace])}>
              <Sparkline data={goal.trend.slice(-12)} />
            </div>
          )}
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        {goal.goal_type === "process" && goal.process_buckets ? (
          <div className="mt-3">
            <div className="flex gap-1">
              {goal.process_buckets.map((b) => (
                <div
                  key={b.key}
                  className={cn(
                    "h-7 flex-1 rounded-md text-center text-[10px] leading-7 font-mono font-bold",
                    b.hit
                      ? "bg-primary/80 text-primary-foreground"
                      : b.count > 0
                        ? "bg-primary/25 text-primary"
                        : "bg-muted/60 text-muted-foreground",
                  )}
                  title={`${b.key}: ${b.count}/${goal.process_target_per_period ?? "?"}`}
                >
                  {b.count}
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Senaste {goal.process_buckets.length} {goal.process_period === "month" ? "mån" : "veckor"} – grönt = mål uppnått
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
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
        )}

        {atRisk && goal.required_per_week !== null && goal.required_per_week !== undefined && goal.current_per_week !== null && goal.current_per_week !== undefined && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Öka från <span className="font-mono">{goal.current_per_week}</span> till{" "}
              <span className="font-mono font-bold">{goal.required_per_week} {goal.target_unit}/v</span> för att hinna i tid.
            </span>
          </div>
        )}

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
          </div>
        )}

        {!compact && subGoals.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-border pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Delmål</p>
            {subGoals.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", s.completed ? "bg-emerald-400" : PACE_COLOR[s.pace])} />
                <span className="flex-1 truncate text-xs">{s.title}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{s.progress_pct}%</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Link>
  );
}
