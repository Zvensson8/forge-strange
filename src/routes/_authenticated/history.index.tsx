import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getHistory } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Dumbbell, Timer, Footprints, ChevronRight } from "lucide-react";
import { formatDateSv, sessionTypeLabel } from "@/lib/forge-utils";

export const Route = createFileRoute("/_authenticated/history/")({
  component: HistoryPage,
});

type Filter = "alla" | "styrka" | "cirkel" | "löpning";

function HistoryPage() {
  const [filter, setFilter] = useState<Filter>("alla");
  const fn = useServerFn(getHistory);
  const { data } = useQuery({ queryKey: ["history", filter], queryFn: () => fn({ data: { filter } }) });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Historik</h1>
        <p className="text-sm text-muted-foreground">Alla dina pass i smedjan.</p>
      </header>
      <div className="flex gap-2 overflow-x-auto">
        {(["alla", "styrka", "cirkel", "löpning"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm capitalize ${
              filter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {data?.length === 0 && (
        <Card className="border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Inga pass än. Tänd elden från dashboarden.</p>
        </Card>
      )}
      <div className="space-y-2">
        {(data ?? []).map((w: any) => (
          <Link key={w.id} to="/history/$id" params={{ id: w.id }}>
            <Card className="flex items-center gap-3 border-border bg-card p-3 transition-colors hover:border-primary/40">
              <TypeIcon t={w.session_type} />
              <div className="flex-1">
                <p className="font-semibold">{sessionTypeLabel(w.session_type)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateSv(w.date)} · {w.duration_minutes ?? "?"} min
                  {w.running_sessions?.[0] ? ` · ${w.running_sessions[0].distance_km} km` : ""}
                  {w.had_pr ? " · 🏆 PR" : ""}
                </p>
              </div>
              <span className="font-mono text-xs text-primary">+{w.xp_awarded}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function TypeIcon({ t }: { t: string }) {
  const Icon = t === "styrka" ? Dumbbell : t === "cirkel" ? Timer : Footprints;
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-lg forge-gradient text-primary-foreground">
      <Icon className="h-5 w-5" strokeWidth={2.5} />
    </span>
  );
}
