import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { deleteGoal, listGoalsWithProgress, updateGoal } from "@/lib/goals.functions";
import { GoalCard, type GoalWithProgress } from "@/components/forge/GoalCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, CheckCircle2, Archive } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { formatDateSv } from "@/lib/forge-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals/$id")({
  component: GoalDetail,
});

function GoalDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(listGoalsWithProgress);
  const updFn = useServerFn(updateGoal);
  const delFn = useServerFn(deleteGoal);

  const q = useQuery({ queryKey: ["goals"], queryFn: () => fn() });
  const goal = useMemo(
    () => ((q.data ?? []) as (GoalWithProgress & { trend: { date: string; value: number }[] })[]).find((g) => g.id === id),
    [q.data, id],
  );

  const completeMut = useMutation({
    mutationFn: () => updFn({ data: { id, patch: { status: "completed" } } }),
    onSuccess: () => {
      toast.success("Mål markerat som klart!");
      qc.invalidateQueries({ queryKey: ["goals"] });
      navigate({ to: "/goals" });
    },
  });

  const archiveMut = useMutation({
    mutationFn: () => updFn({ data: { id, patch: { status: "archived" } } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      navigate({ to: "/goals" });
    },
  });

  const delMut = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      navigate({ to: "/goals" });
    },
  });

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

      <GoalCard goal={goal} />

      {/* Trend */}
      <Card className="border-border bg-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Utveckling mot mål
        </p>
        {goal.trend && goal.trend.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={goal.trend} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={36} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(l) => formatDateSv(l as string)}
                  formatter={(v: any) => `${v} ${goal.target_unit}`}
                />
                <ReferenceLine
                  y={Number(goal.target_value)}
                  stroke="var(--color-primary)"
                  strokeDasharray="4 4"
                  label={{ value: "Mål", fill: "var(--color-primary)", fontSize: 10, position: "right" }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--color-primary)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Logga relevant träning så dyker trenden upp här.
          </p>
        )}
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          onClick={() => completeMut.mutate()}
          disabled={completeMut.isPending}
          className="flex-col gap-1 py-6 text-emerald-400 hover:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-[11px]">Klart</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => archiveMut.mutate()}
          disabled={archiveMut.isPending}
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
          disabled={delMut.isPending}
          className="flex-col gap-1 py-6 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-[11px]">Ta bort</span>
        </Button>
      </div>
    </div>
  );
}
