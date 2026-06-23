import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { logQuickSession } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/forge/Stepper";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Zap, Dumbbell, Timer, Footprints } from "lucide-react";
import { toast } from "sonner";
import { todayISO } from "@/lib/forge-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/log/quick")({
  component: LogQuick,
});

type Kind = "styrka" | "cirkel" | "löpning";

function LogQuick() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(logQuickSession);
  const [kind, setKind] = useState<Kind>("styrka");
  const [minutes, setMinutes] = useState(15);
  const [energy, setEnergy] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fn({
        data: {
          date: todayISO(),
          session_type: kind,
          duration_minutes: minutes,
          energy_level: energy,
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

  const opts: { k: Kind; icon: any; label: string }[] = [
    { k: "styrka", icon: Dumbbell, label: "Styrka" },
    { k: "cirkel", icon: Timer, label: "Cirkel" },
    { k: "löpning", icon: Footprints, label: "Löpning" },
  ];

  return (
    <div className="space-y-4 pb-32">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Snabblogg</p>
          <h1 className="text-xl font-bold">Minipass</h1>
        </div>
      </header>

      <Card className="border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Zap className="h-5 w-5" />
          </span>
          <p className="text-sm text-muted-foreground">
            Kort, snabbt och räknas. <span className="text-foreground">Full streak och halva XP:n</span> – perfekt på dagar
            med låg motivation eller tid.
          </p>
        </div>
      </Card>

      <Card className="space-y-5 border-border bg-card p-5">
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Typ</Label>
          <div className="grid grid-cols-3 gap-2">
            {opts.map((o) => {
              const Icon = o.icon;
              const active = kind === o.k;
              return (
                <button
                  key={o.k}
                  onClick={() => setKind(o.k)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-semibold">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Tid</Label>
          <Stepper value={minutes} step={5} onChange={(v) => setMinutes(Math.max(5, Math.min(60, v)))} suffix="min" />
        </div>

        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Energinivå <span className="font-mono text-primary">{energy}/10</span>
          </Label>
          <Slider value={[energy]} min={1} max={10} step={1} onValueChange={(v) => setEnergy(v[0])} />
        </div>
      </Card>

      <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-xl">
          <Button
            onClick={submit}
            disabled={submitting}
            className="h-14 w-full forge-gradient text-base font-bold text-primary-foreground ember-glow hover:opacity-90"
          >
            {submitting ? "Sparar…" : "Spara minipass"}
          </Button>
        </div>
      </div>
    </div>
  );
}
