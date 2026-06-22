import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkoutDetail } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { formatDateSv, formatPace, sessionTypeLabel } from "@/lib/forge-utils";

export const Route = createFileRoute("/_authenticated/history/$id")({
  component: WorkoutDetail,
});

function WorkoutDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fn = useServerFn(getWorkoutDetail);
  const { data: w } = useQuery({ queryKey: ["workout", id], queryFn: () => fn({ data: { id } }) });

  if (!w) return <div className="py-20 text-center text-muted-foreground">Laddar…</div>;

  // Group sets per exercise
  const setsByEx = new Map<string, any[]>();
  for (const s of (w as any).sets ?? []) {
    const key = s.exercises?.name ?? s.exercise_id;
    if (!setsByEx.has(key)) setsByEx.set(key, []);
    setsByEx.get(key)!.push(s);
  }
  const run = (w as any).running_sessions?.[0];

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate({ to: "/history" })} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{sessionTypeLabel(w.session_type)}</h1>
          <p className="text-xs text-muted-foreground">{formatDateSv(w.date)}</p>
        </div>
      </header>

      <Card className="border-border bg-card p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="XP" value={`+${w.xp_awarded}`} />
          <Stat label="Tid" value={`${w.duration_minutes ?? "?"} min`} />
          <Stat label="PR" value={w.had_pr ? "🏆" : "—"} />
        </div>
      </Card>

      {run && (
        <Card className="border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Löpning</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Distans" value={`${run.distance_km} km`} />
            <Stat label="Pace" value={`${formatPace(run.avg_pace_seconds)}/km`} />
            <Stat label="Effort" value={`${run.effort_level ?? "—"}/10`} />
          </div>
          {run.route_notes && <p className="mt-3 text-sm text-muted-foreground">{run.route_notes}</p>}
        </Card>
      )}

      {Array.from(setsByEx.entries()).map(([name, sets]) => (
        <Card key={name} className="border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">{name}</h2>
          <div className="space-y-1">
            {sets.map((s) => (
              <div key={s.id} className="flex justify-between font-mono text-sm">
                <span className="text-muted-foreground">Set {s.set_index}</span>
                <span>
                  {s.weight ? `${s.weight} kg × ` : ""}
                  {s.reps} reps
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {w.notes && (
        <Card className="border-border bg-card p-4">
          <p className="text-sm">{w.notes}</p>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono font-bold">{value}</p>
    </div>
  );
}
