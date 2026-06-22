import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { deleteWorkout, getWorkoutDetail, updateWorkout } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, Save } from "lucide-react";
import { formatDateSv, formatPace, sessionTypeLabel } from "@/lib/forge-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/history/$id")({
  component: WorkoutDetail,
});

function WorkoutDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(getWorkoutDetail);
  const delFn = useServerFn(deleteWorkout);
  const updFn = useServerFn(updateWorkout);
  const { data: w } = useQuery({ queryKey: ["workout", id], queryFn: () => fn({ data: { id } }) });

  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (w) {
      setNotes((w as any).notes ?? "");
      setDuration((w as any).duration_minutes != null ? String((w as any).duration_minutes) : "");
    }
  }, [w]);

  if (!w) return <div className="py-20 text-center text-muted-foreground">Laddar…</div>;

  const setsByEx = new Map<string, any[]>();
  for (const s of (w as any).sets ?? []) {
    const key = s.exercises?.name ?? s.exercise_id;
    if (!setsByEx.has(key)) setsByEx.set(key, []);
    setsByEx.get(key)!.push(s);
  }
  const run = (w as any).running_sessions?.[0];

  async function save() {
    setSaving(true);
    try {
      const dur = duration.trim() === "" ? null : parseInt(duration, 10);
      await updFn({ data: { id, notes: notes || null, duration_minutes: Number.isFinite(dur as number) ? (dur as number) : null } });
      await qc.invalidateQueries();
      toast.success("Uppdaterat");
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte uppdatera");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await delFn({ data: { id } });
      await qc.invalidateQueries();
      toast.success("Passet är borta. Stats uppdaterade.");
      navigate({ to: "/history" });
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte ta bort");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 pb-32">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate({ to: "/history" })} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{sessionTypeLabel(w.session_type)}</h1>
          <p className="text-xs text-muted-foreground">{formatDateSv(w.date)}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-destructive"
              aria-label="Ta bort pass"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ta bort passet?</AlertDialogTitle>
              <AlertDialogDescription>
                Detta tar bort passet permanent och räknar om XP, level och streak.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={remove} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? "Tar bort…" : "Ta bort"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {sessionTypeLabel(w.session_type)}
          </h2>
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

      <Card className="space-y-3 border-border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Redigera</h2>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Tid (min)</Label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm"
            placeholder="t.ex. 45"
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Anteckning</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Hur kändes passet?" />
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Sparar…" : "Spara ändringar"}
        </Button>
      </Card>
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
