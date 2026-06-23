import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceDot } from "recharts";
import { TrendingUp, AlertTriangle, ChevronRight, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalWithProgress } from "./GoalCard";

type Trajectory = GoalWithProgress & {
  trend?: { date: string; value: number }[];
  required_series?: { date: string; value: number }[] | null;
  required_per_week?: number | null;
  current_per_week?: number | null;
  projection_12w?: number | null;
  today_iso?: string;
};

export function TrajectoryCard({ goal }: { goal: Trajectory }) {
  const trend = goal.trend ?? [];
  const required = goal.required_series ?? [];

  // Merge serier på date
  const dateMap = new Map<string, { date: string; actual?: number; required?: number }>();
  for (const r of required) dateMap.set(r.date, { date: r.date, required: r.value });
  for (const t of trend) {
    const cur = dateMap.get(t.date) ?? { date: t.date };
    cur.actual = t.value;
    dateMap.set(t.date, cur);
  }
  const today = goal.today_iso;
  if (today && !dateMap.has(today)) {
    const lastActual = trend.length ? trend[trend.length - 1].value : 0;
    dateMap.set(today, { date: today, actual: lastActual });
  }
  const data = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const tone =
    goal.pace === "ahead"
      ? "text-emerald-400"
      : goal.pace === "on_track"
        ? "text-primary"
        : goal.pace === "behind"
          ? "text-amber-400"
          : "text-red-400";

  const paceLabel =
    goal.pace === "ahead"
      ? "Före plan"
      : goal.pace === "on_track"
        ? "På rätt spår"
        : goal.pace === "behind"
          ? "Öka takten"
          : "Risk att missa";

  const unit = goal.target_unit ?? "";
  const required_per_week = goal.required_per_week ?? null;
  const current_per_week = goal.current_per_week ?? null;
  const deficit = required_per_week !== null && current_per_week !== null ? required_per_week - current_per_week : null;

  return (
    <Link to="/goals/$id" params={{ id: goal.id }} className="block">
      <Card className="overflow-hidden border-primary/40 bg-card p-5 transition-all hover:border-primary hover:ember-glow">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Trajectory</p>
            </div>
            <p className="truncate text-base font-bold">{goal.title}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono text-foreground">{goal.current_label}</span> / <span className="font-mono">{goal.target_value} {unit}</span>
              {goal.weeks_left !== null && ` · ${goal.weeks_left} v kvar`}
            </p>
          </div>
          <span className={cn("shrink-0 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-bold", tone)}>
            {paceLabel}
          </span>
        </div>

        {data.length > 1 ? (
          <div className="-mx-2 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -28 }}>
                <XAxis dataKey="date" hide />
                <YAxis tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} width={40} />
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: any, k: any) => [`${Number(v).toFixed(1)} ${unit}`, k === "actual" ? "Faktiskt" : "Krävd takt"]}
                />
                <Line type="monotone" dataKey="required" stroke="var(--color-muted-foreground)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="actual" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 2, fill: "var(--color-primary)" }} isAnimationActive={false} />
                {goal.today_iso && (
                  <ReferenceDot x={goal.today_iso} y={data.find((d) => d.date === goal.today_iso)?.actual ?? 0} r={5} fill="var(--color-primary)" stroke="var(--color-background)" strokeWidth={2} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-md bg-muted/40 text-xs text-muted-foreground">
            Logga relevant träning så ritas trajectory upp
          </div>
        )}

        {deficit !== null && required_per_week !== null && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-md bg-muted/40 p-2">
              <p className="uppercase tracking-wider text-muted-foreground">Krävd takt</p>
              <p className="font-mono text-sm font-bold">{required_per_week} {unit}/v</p>
            </div>
            <div className="rounded-md bg-muted/40 p-2">
              <p className="uppercase tracking-wider text-muted-foreground">Din takt nu</p>
              <p className="font-mono text-sm font-bold">{current_per_week} {unit}/v</p>
            </div>
          </div>
        )}

        {deficit !== null && deficit > 0.1 && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Öka med <span className="font-mono font-bold">+{deficit.toFixed(1)} {unit}/v</span> för att hinna i tid.
            </span>
          </div>
        )}

        {goal.projection_12w !== null && goal.projection_12w !== undefined && goal.current_per_week && goal.current_per_week > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span>
              Med nuvarande takt: <span className="font-mono font-semibold text-foreground">~{goal.projection_12w} {unit}</span> om 12 veckor.
            </span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-end text-xs font-semibold text-primary">
          Öppna mål <ChevronRight className="h-3 w-3" />
        </div>
      </Card>
    </Link>
  );
}
