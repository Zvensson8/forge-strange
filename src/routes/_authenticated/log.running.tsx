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
import { todayISO, formatPace } from "@/lib/forge-utils";

export const Route = createFileRoute("/_authenticated/log/running")({
  component: LogRunning,
});

function LogRunning() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(logRunning);
  const [distance, setDistance] = useState(5);
  const [minutes, setMinutes] = useState(30);
  const [seconds, setSeconds] = useState(0);
  const [effort, setEffort] = useState(6);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totalDur = minutes + seconds / 60;
  const pace = distance > 0 ? Math.round((totalDur * 60) / distance) : 0;

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
          distance_km: distance,
          duration_minutes: totalDur,
          effort_level: effort,
          route_notes: notes || undefined,
        },
      });
      qc.invalidateQueries();
      toast.success(`+${res.xp_gained} XP · Streak ${res.streak} 🔥`, {
        description:
          (res.prs.includes("distance") ? "Längsta löprundan! " : "") +
          (res.prs.includes("pace") ? "Snabbaste pace! " : "") +
          (res.leveled_up ? `Forge Level ${res.new_level}!` : ""),
      });
      for (const a of res.unlocked_achievements) toast(a.name, { description: "Märke upplåst" });
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte spara");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 pb-32">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate({ to: "/dashboard" })} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">Löprunda</h1>
      </header>

      <Card className="space-y-4 border-border bg-card p-5">
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Distans</Label>
          <Stepper value={distance} step={0.5} onChange={setDistance} suffix="km" />
        </div>
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Tid</Label>
          <div className="flex gap-2">
            <Stepper value={minutes} onChange={setMinutes} suffix="min" className="flex-1" />
            <Stepper value={seconds} step={5} onChange={(v) => setSeconds(Math.max(0, Math.min(59, v)))} suffix="sek" className="flex-1" />
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Snitt pace</p>
          <p className="font-mono text-2xl font-bold text-primary">{formatPace(pace)} / km</p>
        </div>
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Effort <span className="font-mono text-primary">{effort}/10</span>
          </Label>
          <Slider value={[effort]} min={1} max={10} step={1} onValueChange={(v) => setEffort(v[0])} />
        </div>
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Anteckning</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hur kändes det? Rutt, väder…" rows={3} />
        </div>
      </Card>

      <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-xl">
          <Button
            onClick={submit}
            disabled={submitting}
            className="h-14 w-full forge-gradient text-base font-bold text-primary-foreground ember-glow hover:opacity-90"
          >
            {submitting ? "Sparar…" : "Spara löprunda"}
          </Button>
        </div>
      </div>
    </div>
  );
}
