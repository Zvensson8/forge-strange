import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listGoalsWithProgress } from "@/lib/goals.functions";
import { useDeleteGoalMutation, useUpdateGoalMutation } from "@/lib/goal-mutations";
import { qk } from "@/lib/query-keys";
import { GoalCard, type GoalWithProgress } from "@/components/forge/GoalCard";
import { TrajectoryCard } from "@/components/forge/TrajectoryCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, CheckCircle2, Archive, TrendingUp } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateSv } from "@/lib/forge-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals/$id")({
  component: GoalDetail,
});

function GoalDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fn = useServerFn(listGoalsWithProgress);

  const q = useQuery({ queryKey: qk.goals, queryFn: () => fn() });
  const all = (q.data ?? []) as (GoalWithProgress & {
    trend: { date: string; value: number }[];
    weekly_buckets?: { week: string; value: number }[];
    required_per_week?: number | null;
    current_per_week?: number | null;
    projection_12w?: number | null;
    required_series?: { date: string; value: number }[] | null;
    today_iso?: string;
  })[];
  const goal = useMemo(() => all.find((g) => g.id === id), [all, id]);
  const subGoals = useMemo(() => all.filter((g) => (g as any).parent_goal_id === id), [all, id]);
  const hasTrajectory = goal && (goal.target_date || (goal.required_series && goal.required_series.length > 0));

  const updateMut = useUpdateGoalMutation();
  const deleteMut = useDeleteGoalMutation();

  const completeMut = {
    mutate: () =>
      updateMut.mutate(
        { id, patch: { status: "completed" } },
        {
          onSuccess: () => {
            toast.success("Mål markerat som klart!");
            navigate({ to: "/goals" });
          },
        },
      ),
  };
  const archiveMut = {
    mutate: () =>
      updateMut.mutate(
        { id, patch: { status: "archived" } },
        { onSuccess: () => navigate({ to: "/goals" }) },
      ),
  };
  const delMut = {
    mutate: () => deleteMut.mutate({ id }, { onSuccess: () => navigate({ to: "/goals" }) }),
  };

  if (q.isLoading) return <p className="py-20 text-center text-muted-foreground">Laddar…</p>;
  if (!goal) return <p className="py-20 text-center text-muted-foreground">Målet hittades inte.</p>;

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/goals" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">Måldetaljer</h1>
      </header>

      <GoalCard goal={goal} subGoals={subGoals} />

      {/* Trajectory */}
      {hasTrajectory && <TrajectoryCard goal={goal as any} />}

      {/* Compounding card */}
      {goal.current_per_week !== null && goal.current_per_week !== undefined && goal.current_per_week > 0 && goal.projection_12w !== null && goal.projection_12w !== undefined && (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div className="text-sm">
              <p className="font-bold">1%-effekten</p>
              <p className="mt-1 text-muted-foreground">
                Med nuvarande takt på <span className="font-mono text-foreground">{goal.current_per_week} {goal.target_unit}/v</span> är du
                vid <span className="font-mono font-bold text-foreground">~{goal.projection_12w} {goal.target_unit}</span> om 12 veckor.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Veckovis bidrag */}
      {goal.weekly_buckets && goal.weekly_buckets.length > 0 && (
        <Card className="border-border bg-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bidrag per vecka
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={goal.weekly_buckets} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} width={32} />
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }}
                  labelFormatter={(l) => `Vecka ${formatDateSv(l as string)}`}
                  formatter={(v: any) => `${v} ${goal.target_unit}`}
                />
                <Bar dataKey="value" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          onClick={() => completeMut.mutate()}
          disabled={updateMut.isPending}
          className="flex-col gap-1 py-6 text-emerald-400 hover:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-[11px]">Klart</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => archiveMut.mutate()}
          disabled={updateMut.isPending}
          className="flex-col gap-1 py-6"
        >
          <Archive className="h-4 w-4" />
          <span className="text-[11px]">Arkivera</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (confirm("Ta bort målet?")) delMut.mutate();
          }}
          disabled={deleteMut.isPending}
          className="flex-col gap-1 py-6 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-[11px]">Ta bort</span>
        </Button>
      </div>
    </div>
  );
}
