import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/forge/Stepper";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft } from "lucide-react";
import { todayISO, formatPace, type DistanceType } from "@/lib/forge-utils";
import { logDistanceSchema, type LogDistanceInput } from "@/lib/types";
import { useLogDistanceMutation } from "@/lib/log-mutations";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/log/running")({
  component: () => <LogDistance kind="löpning" title="Löprunda" />,
});

const COPY: Record<DistanceType, { paceLabel: string; placeholder: string; saveLabel: string }> = {
  löpning: { paceLabel: "Snitt pace", placeholder: "Hur kändes det? Rutt, väder…", saveLabel: "Spara löprunda" },
  cykling: { paceLabel: "Snitt km/h", placeholder: "Rutt, terräng, väder…", saveLabel: "Spara cykeltur" },
  promenad: { paceLabel: "Snitt pace", placeholder: "Var gick du? Hur kändes det?", saveLabel: "Spara promenad" },
};

// Add seconds bridge field, then derive duration_minutes on submit.
const formSchema = logDistanceSchema.extend({
  minutes: z.number().min(0).default(30),
  seconds: z.number().min(0).max(59).default(0),
});
type FormValues = z.input<typeof formSchema>;

export function LogDistance({ kind, title }: { kind: DistanceType; title: string }) {
  const navigate = useNavigate();
  const mut = useLogDistanceMutation();
  const defaults = kind === "löpning" ? { d: 5, m: 30 } : kind === "cykling" ? { d: 15, m: 45 } : { d: 3, m: 30 };

  const { control, handleSubmit, watch, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    mode: "onChange",
    defaultValues: {
      date: todayISO(),
      session_type: kind,
      distance_km: defaults.d,
      duration_minutes: defaults.m,
      effort_level: kind === "promenad" ? 3 : 6,
      route_notes: "",
      minutes: defaults.m,
      seconds: 0,
    },
  });

  const distance = Number(watch("distance_km") ?? 0);
  const minutes = Number(watch("minutes") ?? 0);
  const seconds = Number(watch("seconds") ?? 0);
  const effort = Number(watch("effort_level") ?? 5);
  const totalDur = minutes + seconds / 60;
  const paceSec = distance > 0 ? Math.round((totalDur * 60) / distance) : 0;
  const speedKmh = totalDur > 0 ? distance / (totalDur / 60) : 0;

  // Keep duration_minutes in sync for the validator
  setValue("duration_minutes", totalDur, { shouldValidate: false });

  async function onSubmit(values: FormValues) {
    const payload: LogDistanceInput = {
      date: values.date,
      session_type: values.session_type ?? kind,
      distance_km: Number(values.distance_km),
      duration_minutes: totalDur,
      effort_level: values.effort_level,
      route_notes: values.route_notes || undefined,
    };
    try {
      const res = await mut.mutateAsync(payload);
      navigate({ to: "/log/success", search: { id: res.workout_id, leveled_up: res.leveled_up } });
    } catch {
      /* toast in mutation */
    }
  }

  const copy = COPY[kind];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-32">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/log" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{title}</h1>
      </header>

      <Card className="space-y-4 border-border bg-card p-5">
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Distans</Label>
          <Controller
            control={control}
            name="distance_km"
            render={({ field }) => (
              <Stepper
                value={Number(field.value ?? 0)}
                step={kind === "cykling" ? 1 : 0.5}
                onChange={field.onChange}
                suffix="km"
              />
            )}
          />
          {formState.errors.distance_km && (
            <p className="mt-1 text-[11px] font-semibold text-destructive">
              {String(formState.errors.distance_km.message)}
            </p>
          )}
        </div>

        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Tid</Label>
          <div className="flex gap-2">
            <Controller
              control={control}
              name="minutes"
              render={({ field }) => (
                <Stepper
                  value={Number(field.value ?? 0)}
                  onChange={field.onChange}
                  suffix="min"
                  className="flex-1"
                />
              )}
            />
            <Controller
              control={control}
              name="seconds"
              render={({ field }) => (
                <Stepper
                  value={Number(field.value ?? 0)}
                  step={5}
                  onChange={(v) => field.onChange(Math.max(0, Math.min(59, v)))}
                  suffix="sek"
                  className="flex-1"
                />
              )}
            />
          </div>
          {formState.errors.duration_minutes && (
            <p className="mt-1 text-[11px] font-semibold text-destructive">
              {String(formState.errors.duration_minutes.message)}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{copy.paceLabel}</p>
          <p className="font-mono text-2xl font-bold text-primary">
            {kind === "cykling" ? `${speedKmh.toFixed(1)} km/h` : `${formatPace(paceSec)} / km`}
          </p>
        </div>

        <Controller
          control={control}
          name="effort_level"
          render={({ field }) => (
            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
                Effort <span className="font-mono text-primary">{effort}/10</span>
              </Label>
              <Slider
                value={[Number(field.value ?? 5)]}
                min={1}
                max={10}
                step={1}
                onValueChange={(v) => field.onChange(v[0])}
              />
            </div>
          )}
        />

        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Anteckning</Label>
          <Controller
            control={control}
            name="route_notes"
            render={({ field }) => (
              <Textarea
                value={field.value ?? ""}
                onChange={field.onChange}
                placeholder={copy.placeholder}
                rows={3}
              />
            )}
          />
        </div>
      </Card>

      <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-xl">
          <Button
            type="submit"
            disabled={mut.isPending}
            className="h-14 w-full forge-gradient text-base font-bold text-primary-foreground ember-glow hover:opacity-90 disabled:opacity-50"
          >
            {mut.isPending ? "Sparar…" : copy.saveLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
