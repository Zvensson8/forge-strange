import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/forge/Stepper";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Zap, Dumbbell, Timer, Footprints } from "lucide-react";
import { todayISO } from "@/lib/forge-utils";
import { cn } from "@/lib/utils";
import { logQuickSchema, type LogQuickInput } from "@/lib/types";
import { useLogQuickMutation } from "@/lib/log-mutations";

export const Route = createFileRoute("/_authenticated/log/quick")({
  component: LogQuick,
});

type Kind = "styrka" | "cirkel" | "löpning";

function LogQuick() {
  const navigate = useNavigate();
  const mut = useLogQuickMutation();
  const { control, handleSubmit, watch, setValue, formState } = useForm<LogQuickInput>({
    resolver: zodResolver(logQuickSchema) as any,
    defaultValues: {
      date: todayISO(),
      session_type: "styrka",
      duration_minutes: 15,
      energy_level: 5,
    },
  });
  const kind = watch("session_type");

  const opts: { k: Kind; icon: any; label: string }[] = [
    { k: "styrka", icon: Dumbbell, label: "Styrka" },
    { k: "cirkel", icon: Timer, label: "Cirkel" },
    { k: "löpning", icon: Footprints, label: "Löpning" },
  ];

  async function onSubmit(values: LogQuickInput) {
    try {
      const res = await mut.mutateAsync(values);
      navigate({ to: "/log/success", search: { id: res.workout_id, leveled_up: res.leveled_up } });
    } catch {
      /* toast in mutation */
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-32">
      <header className="flex items-center gap-3">
        <button
          type="button"
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
                  type="button"
                  onClick={() => setValue("session_type", o.k, { shouldValidate: true })}
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
          <Controller
            control={control}
            name="duration_minutes"
            render={({ field }) => (
              <Stepper
                value={field.value ?? 15}
                step={5}
                onChange={(v) => field.onChange(Math.max(5, Math.min(60, v)))}
                suffix="min"
              />
            )}
          />
          {formState.errors.duration_minutes && (
            <p className="mt-1 text-[11px] font-semibold text-destructive">
              {formState.errors.duration_minutes.message}
            </p>
          )}
        </div>

        <Controller
          control={control}
          name="energy_level"
          render={({ field }) => (
            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
                Energinivå <span className="font-mono text-primary">{field.value ?? 5}/10</span>
              </Label>
              <Slider
                value={[field.value ?? 5]}
                min={1}
                max={10}
                step={1}
                onValueChange={(v) => field.onChange(v[0])}
              />
            </div>
          )}
        />
      </Card>

      <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-xl">
          <Button
            type="submit"
            disabled={mut.isPending}
            className="h-14 w-full forge-gradient text-base font-bold text-primary-foreground ember-glow hover:opacity-90 disabled:opacity-50"
          >
            {mut.isPending ? "Sparar…" : "Spara minipass"}
          </Button>
        </div>
      </div>
    </form>
  );
}
