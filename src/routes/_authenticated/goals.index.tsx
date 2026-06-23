import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGoalsWithProgress } from "@/lib/goals.functions";
import { GoalCard, type GoalWithProgress } from "@/components/forge/GoalCard";
import { Card } from "@/components/ui/card";
import { Plus, Target, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/goals/")({
  component: GoalsList,
});

function GoalsList() {
  const fn = useServerFn(listGoalsWithProgress);
  const q = useQuery({ queryKey: ["goals"], queryFn: () => fn() });

  const goals = (q.data ?? []) as GoalWithProgress[];
  const topLevel = goals.filter((g) => !(g as any).parent_goal_id);
  const subsByParent = new Map<string, GoalWithProgress[]>();
  for (const g of goals) {
    const pid = (g as any).parent_goal_id;
    if (pid) {
      if (!subsByParent.has(pid)) subsByParent.set(pid, []);
      subsByParent.get(pid)!.push(g);
    }
  }
  const active = topLevel.filter((g) => !g.completed);
  const completed = topLevel.filter((g) => g.completed);
  const urgent = active.filter(
    (g) => g.goal_type === "event" && g.weeks_left !== null && g.weeks_left <= 6,
  );

  return (
    <div className="space-y-5 pb-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Mål</p>
          <h1 className="text-2xl font-bold">Vad smider du mot?</h1>
        </div>
        <Link
          to="/goals/new"
          className="flex h-11 items-center gap-2 rounded-full forge-gradient px-4 text-sm font-bold text-primary-foreground ember-glow"
        >
          <Plus className="h-4 w-4" />
          Nytt mål
        </Link>
      </header>

      {urgent.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-bold text-amber-200">
                {urgent.length} mål med deadline inom 6 veckor
              </p>
              <p className="text-xs text-amber-300/80">
                Dessa är markerade nedan – prioritera de pass som driver dem framåt.
              </p>
            </div>
          </div>
        </Card>
      )}

      {q.isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Laddar mål…</p>}

      {!q.isLoading && goals.length === 0 && (
        <Card className="border-dashed border-border bg-card/40 p-8 text-center">
          <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">Inga mål än</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sätt ett konkret mål – styrka, distans, antal pass eller ett evenemang. Smedjan följer takten åt dig.
          </p>
          <Link
            to="/goals/new"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-full forge-gradient px-4 text-sm font-bold text-primary-foreground ember-glow"
          >
            <Plus className="h-4 w-4" /> Skapa ditt första mål
          </Link>
        </Card>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aktiva</p>
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Klart</p>
          {completed.map((g) => (
            <GoalCard key={g.id} goal={g} compact />
          ))}
        </div>
      )}
    </div>
  );
}
