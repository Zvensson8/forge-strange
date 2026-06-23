import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getHistory } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Dumbbell, Timer, Footprints, Bike, Trees, ChevronRight, History as HistoryIcon } from "lucide-react";
import { EmptyState } from "@/components/forge/EmptyState";
import { formatDateSv, sessionTypeLabel } from "@/lib/forge-utils";

export const Route = createFileRoute("/_authenticated/history/")({
  component: HistoryPage,
});

type Filter = "alla" | "styrka" | "cirkel" | "löpning" | "cykling" | "promenad";
const FILTERS: Filter[] = ["alla", "styrka", "cirkel", "löpning", "cykling", "promenad"];

function weekKey(d: Date): string {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

function weekLabel(iso: string): string {
  const start = new Date(iso);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const today = new Date();
  const thisWeek = weekKey(today);
  if (iso === thisWeek) return "Denna vecka";
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  if (iso === weekKey(lastWeek)) return "Förra veckan";
  const fmt = (d: Date) => d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function HistoryPage() {
  const [filter, setFilter] = useState<Filter>("alla");
  const fn = useServerFn(getHistory);
  const { data } = useQuery({ queryKey: ["history", filter], queryFn: () => fn({ data: { filter } }) });

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const w of data ?? []) {
      const k = weekKey(new Date(w.date));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(w);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [data]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Historik</h1>
        <p className="text-sm text-muted-foreground">Alla dina pass, grupperade per vecka.</p>
      </header>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
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
      {data && data.length === 0 && (
        <EmptyState
          icon={HistoryIcon}
          title="Inga pass än"
          description="Dina loggade pass dyker upp här."
          ctaLabel="Logga första passet"
          ctaTo="/log"
        />
      )}
      <div className="space-y-5">
        {grouped.map(([wk, items]) => (
          <div key={wk}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {weekLabel(wk)} · {items.length} pass
            </p>
            <div className="space-y-2">
              {items.map((w: any) => (
                <Link key={w.id} to="/history/$id" params={{ id: w.id }}>
                  <Card className="flex items-center gap-3 border-border bg-card p-3 transition-colors hover:border-primary/40">
                    <TypeIcon t={w.session_type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{sessionTypeLabel(w.session_type)}</p>
                      <p className="truncate text-xs text-muted-foreground">
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
        ))}
      </div>
    </div>
  );
}

function TypeIcon({ t }: { t: string }) {
  const Icon =
    t === "styrka" ? Dumbbell :
    t === "cirkel" ? Timer :
    t === "cykling" ? Bike :
    t === "promenad" ? Trees :
    Footprints;
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
      <Icon className="h-5 w-5" strokeWidth={2.5} />
    </span>
  );
}

