import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { logRunning } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/forge/Stepper";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { todayISO, formatPace, type DistanceType } from "@/lib/forge-utils";

export const Route = createFileRoute("/_authenticated/log/running")({
  component: () => <LogDistance kind="löpning" title="Löprunda" />,
});

const COPY: Record<DistanceType, { paceLabel: string; placeholder: string; saveLabel: string }> = {
  löpning: { paceLabel: "Snitt pace", placeholder: "Hur kändes det? Rutt, väder…", saveLabel: "Spara löprunda" },
  cykling: { paceLabel: "Snitt km/h", placeholder: "Rutt, terräng, väder…", saveLabel: "Spara cykeltur" },
  promenad: { paceLabel: "Snitt pace", placeholder: "Var gick du? Hur kändes det?", saveLabel: "Spara promenad" },
};

export function LogDistance({ kind, title }: { kind: DistanceType; title: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(logRunning);
  const defaults = kind === "löpning" ? { d: 5, m: 30 } : kind === "cykling" ? { d: 15, m: 45 } : { d: 3, m: 30 };
  const [distance, setDistance] = useState(defaults.d);
  const [minutes, setMinutes] = useState(defaults.m);
  const [seconds, setSeconds] = useState(0);
  const [effort, setEffort] = useState(kind === "promenad" ? 3 : 6);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totalDur = minutes + seconds / 60;
  const paceSec = distance > 0 ? Math.round((totalDur * 60) / distance) : 0;
  const speedKmh = totalDur > 0 ? (distance / (totalDur / 60)) : 0;

  async function submit() {
    if (distance <= 0 || totalDur <= 0) {
      toast.error("Fyll i distans och tid");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fn({
        data: {
          date: todayISO(),
          session_type: kind,
          distance_km: distance,
          duration_minutes: totalDur,
          effort_level: effort,
          route_notes: notes || undefined,
        },
      });
      qc.invalidateQueries();
      navigate({ to: "/log/success", search: { id: res.workout_id, leveled_up: res.leveled_up } });
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte spara");
    } finally {
      setSubmitting(false);
    }
  }

  const copy = COPY[kind];

  return (
    <div className="space-y-4 pb-32">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate({ to: "/log" })} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{title}</h1>
      </header>

      <Card className="space-y-4 border-border bg-card p-5">
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Distans</Label>
          <Stepper value={distance} step={kind === "cykling" ? 1 : 0.5} onChange={setDistance} suffix="km" />
        </div>
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Tid</Label>
          <div className="flex gap-2">
            <Stepper value={minutes} onChange={setMinutes} suffix="min" className="flex-1" />
            <Stepper value={seconds} step={5} onChange={(v) => setSeconds(Math.max(0, Math.min(59, v)))} suffix="sek" className="flex-1" />
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{copy.paceLabel}</p>
          <p className="font-mono text-2xl font-bold text-primary">
            {kind === "cykling" ? `${speedKmh.toFixed(1)} km/h` : `${formatPace(paceSec)} / km`}
          </p>
        </div>
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Effort <span className="font-mono text-primary">{effort}/10</span>
          </Label>
          <Slider value={[effort]} min={1} max={10} step={1} onValueChange={(v) => setEffort(v[0])} />
        </div>
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Anteckning</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={copy.placeholder} rows={3} />
        </div>
      </Card>

      <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-xl">
          <Button
            onClick={submit}
            disabled={submitting}
            className="h-14 w-full forge-gradient text-base font-bold text-primary-foreground ember-glow hover:opacity-90"
          >
            {submitting ? "Sparar…" : copy.saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
