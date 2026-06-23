import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { z } from "zod";
import { getExercisesAndTemplates } from "@/lib/workout.functions";
import { useCreateGoalMutation } from "@/lib/goal-mutations";
import { goalSchema, SESSION_TYPES, type GoalInput, type GoalType, type SessionType } from "@/lib/types";
import { qk } from "@/lib/query-keys";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Dumbbell, Footprints, Timer, CalendarClock, Repeat } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/forge-utils";

// ---------------------------------------------------------------------------
// Route + form schema
// ---------------------------------------------------------------------------

const goalFormSchema = goalSchema
  .extend({
    process_count_str: z.string().optional(), // text-input bridge for processCount
    sub_goals: z
      .array(
        z.object({
          title: z.string(),
          target_value: z.string(),
          goal_type: z.enum(["distance", "sessions"]),
          session_type: z.enum(SESSION_TYPES),
        }),
      )
      .default([]),
  })
  .superRefine((v, ctx) => {
    if (v.goal_type === "strength" && !v.exercise_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["exercise_id"], message: "Välj en övning" });
    }
    if (v.goal_type === "event" && !v.target_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["target_date"], message: "Välj måldatum" });
    }
    if (v.goal_type === "process") {
      if (!v.process_target_count || v.process_target_count <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["process_target_count"],
          message: "Ange antal per period",
        });
      }
    } else if (!v.target_value || v.target_value <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["target_value"], message: "Ange ett värde > 0" });
    }
  });

type FormValues = z.input<typeof goalFormSchema>;

export const Route = createFileRoute("/_authenticated/goals/new")({
  component: NewGoal,
  validateSearch: (s: Record<string, unknown>) => ({
    type: (s.type as GoalType) || undefined,
    value: typeof s.value === "string" ? s.value : undefined,
    unit: typeof s.unit === "string" ? s.unit : undefined,
    period: (s.period as "week" | "month") || undefined,
  }),
});

const TYPE_META: Record<GoalType, { label: string; icon: any; hint: string }> = {
  strength: { label: "Styrka", icon: Dumbbell, hint: "Lyft en viss vikt × reps på en övning" },
  distance: { label: "Distans", icon: Footprints, hint: "Total distans inom en period" },
  sessions: { label: "Antal pass", icon: Timer, hint: "Logga ett antal pass av en viss typ" },
  event: { label: "Evenemang", icon: CalendarClock, hint: "Träna mot en deadline – lopp, race" },
  process: { label: "Återkommande", icon: Repeat, hint: "T.ex. 3 pass eller 20 km per vecka – håll vanan" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function NewGoal() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const getEx = useServerFn(getExercisesAndTemplates);
  const ex = useQuery({ queryKey: qk.exercises, queryFn: () => getEx() });
  const createMut = useCreateGoalMutation();

  const form = useForm<FormValues>({
    resolver: zodResolver(goalFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      title: "",
      goal_type: search.type ?? "strength",
      target_value: search.value ? Number(search.value) : 0,
      target_unit: "kg",
      target_reps: 5,
      exercise_id: null,
      session_type: "löpning",
      target_date: null,
      start_date: todayISO(),
      reminder_enabled: false,
      reminder_cadence: "weekly",
      process_period: search.period ?? "week",
      process_target_count:
        search.type === "process" && search.value ? Number(search.value) : 3,
      process_metric: search.unit === "km" ? "km" : "sessions",
      sub_goals: [],
    },
  });

  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const type = watch("goal_type");
  const sessionType = watch("session_type") as SessionType;
  const processMetric = watch("process_metric") as "sessions" | "km";
  const exerciseId = watch("exercise_id");
  const targetValue = watch("target_value");
  const targetReps = watch("target_reps");
  const processCount = watch("process_target_count");

  const { fields: subFields, append, remove } = useFieldArray({ control, name: "sub_goals" });

  const weightExercises = useMemo(
    () => (ex.data?.exercises ?? []).filter((e: any) => !["Cirkel", "Core"].includes(e.category)),
    [ex.data],
  );

  function autoTitle(v: FormValues) {
    if (v.goal_type === "strength") {
      const exName = ex.data?.exercises.find((e: any) => e.id === v.exercise_id)?.name ?? "Styrka";
      return `${exName} ${v.target_value} kg × ${v.target_reps}`;
    }
    if (v.goal_type === "distance") return `${v.target_value} km ${v.session_type}`;
    if (v.goal_type === "sessions") return `${v.target_value} ${v.session_type}-pass`;
    if (v.goal_type === "process") {
      const m = v.process_metric === "km" ? "km" : v.session_type + "-pass";
      return `${v.process_target_count} ${m} per ${v.process_period === "month" ? "månad" : "vecka"}`;
    }
    return `Evenemang ${v.target_date}`;
  }

  async function onSubmit(values: FormValues) {
    const unit =
      values.goal_type === "strength"
        ? "kg"
        : values.goal_type === "distance" || values.goal_type === "event"
          ? "km"
          : values.goal_type === "process"
            ? values.process_metric === "km"
              ? "km"
              : "pass"
            : "pass";

    const payload: GoalInput = {
      title: values.title || autoTitle(values),
      goal_type: values.goal_type,
      target_value:
        values.goal_type === "process"
          ? Number(values.process_target_count ?? 0)
          : Number(values.target_value ?? 0),
      target_unit: unit,
      target_reps: values.goal_type === "strength" ? Number(values.target_reps) : null,
      exercise_id: values.goal_type === "strength" ? values.exercise_id || null : null,
      session_type: values.goal_type === "strength" ? null : values.session_type,
      target_date: values.target_date || null,
      start_date: todayISO(),
      reminder_enabled: values.reminder_enabled,
      reminder_cadence: values.reminder_cadence,
      process_period: values.goal_type === "process" ? values.process_period : null,
      process_target_count:
        values.goal_type === "process" ? Number(values.process_target_count) : null,
      process_metric: values.goal_type === "process" ? values.process_metric : null,
    };

    try {
      const parent = await createMut.mutateAsync(payload);
      // Sub-goals (sequential, share parent_goal_id)
      for (const sg of values.sub_goals) {
        if (!sg.title || !sg.target_value) continue;
        const sgUnit = sg.goal_type === "distance" ? "km" : "pass";
        await createMut.mutateAsync({
          title: sg.title,
          goal_type: sg.goal_type as GoalType,
          target_value: Number(sg.target_value),
          target_unit: sgUnit,
          target_reps: null,
          exercise_id: null,
          session_type: sg.goal_type === "distance" || sg.goal_type === "sessions" ? sg.session_type : null,
          target_date: values.target_date || null,
          start_date: todayISO(),
          reminder_enabled: false,
          reminder_cadence: "weekly",
          parent_goal_id: (parent as any).id,
        });
      }
      toast.success("Mål skapat – nu smider vi mot det");
      navigate({ to: "/goals" });
    } catch {
      /* error toast already raised in mutation */
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-32">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/goals" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">Nytt mål</h1>
      </header>

      {/* Type picker */}
      <Card className="border-border bg-card p-4">
        <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Typ av mål</Label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(TYPE_META) as GoalType[]).map((t) => {
            const Icon = TYPE_META[t].icon;
            const active = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setValue("goal_type", t, { shouldValidate: true })}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-bold">{TYPE_META[t].label}</span>
                <span className="text-[11px] leading-snug opacity-80">{TYPE_META[t].hint}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-4 border-border bg-card p-4">
        <div>
          <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Titel (valfri)</Label>
          <Input placeholder="t.ex. Halvmaraton sub 1:55" {...register("title")} />
        </div>

        {type === "strength" && (
          <>
            <div>
              <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Övning</Label>
              <select
                value={exerciseId ?? ""}
                onChange={(e) => setValue("exercise_id", e.target.value || null, { shouldValidate: true })}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Välj övning…</option>
                {weightExercises.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <FieldError msg={formState.errors.exercise_id?.message as string | undefined} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Mål-vikt (kg)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="100"
                  {...register("target_value", { valueAsNumber: true })}
                />
                <FieldError msg={formState.errors.target_value?.message as string | undefined} />
              </div>
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Reps</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  {...register("target_reps", { valueAsNumber: true })}
                />
              </div>
            </div>
          </>
        )}

        {type !== "strength" && (
          <div>
            <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Passtyp</Label>
            <div className="flex flex-wrap gap-2">
              {SESSION_TYPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValue("session_type", s, { shouldValidate: true })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize",
                    sessionType === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {(type === "distance" || type === "sessions" || type === "event") && (
          <div>
            <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
              {type === "sessions" ? "Antal pass" : "Mål-distans (km)"}
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder={type === "sessions" ? "12" : "21.1"}
              {...register("target_value", { valueAsNumber: true })}
            />
            <FieldError msg={formState.errors.target_value?.message as string | undefined} />
          </div>
        )}

        {type === "process" && (
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Mätning</Label>
              <div className="flex gap-2">
                {([
                  { v: "sessions", label: "Antal pass" },
                  { v: "km", label: "Total distans (km)" },
                ] as const).map((m) => (
                  <button
                    key={m.v}
                    type="button"
                    onClick={() => setValue("process_metric", m.v, { shouldValidate: true })}
                    className={cn(
                      "flex-1 rounded-full border px-3 py-1.5 text-xs font-semibold",
                      processMetric === m.v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                  {processMetric === "km" ? "Mål-km" : "Antal pass"}
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder={processMetric === "km" ? "20" : "3"}
                  {...register("process_target_count", { valueAsNumber: true })}
                />
                <FieldError msg={formState.errors.process_target_count?.message as string | undefined} />
              </div>
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Per</Label>
                <Controller
                  control={control}
                  name="process_period"
                  render={({ field }) => (
                    <div className="flex gap-2">
                      {(["week", "month"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => field.onChange(p)}
                          className={cn(
                            "flex-1 rounded-full border px-3 py-1.5 text-xs font-semibold",
                            field.value === p
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground",
                          )}
                        >
                          {p === "week" ? "Vecka" : "Månad"}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>
            </div>
          </div>
        )}

        {(type === "event" || type === "distance" || type === "sessions") && (
          <div>
            <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
              {type === "event" ? "Måldatum (deadline)" : "Måldatum (valfritt)"}
            </Label>
            <Input type="date" {...register("target_date")} />
            <FieldError msg={formState.errors.target_date?.message as string | undefined} />
          </div>
        )}

        <Controller
          control={control}
          name="reminder_enabled"
          render={({ field: rem }) => (
            <Controller
              control={control}
              name="reminder_cadence"
              render={({ field: cad }) => (
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Påminnelser</p>
                      <p className="text-xs text-muted-foreground">In-app banner när du öppnar appen.</p>
                    </div>
                    <Switch checked={!!rem.value} onCheckedChange={rem.onChange} />
                  </div>
                  {rem.value && (
                    <div className="flex gap-2 pt-1">
                      {(["daily", "weekly"] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => cad.onChange(c)}
                          className={cn(
                            "flex-1 rounded-full border px-3 py-1.5 text-xs font-semibold",
                            cad.value === c
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground",
                          )}
                        >
                          {c === "daily" ? "Dagligen" : "Veckovis"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            />
          )}
        />
      </Card>

      {/* Sub-goals */}
      {type !== "process" && (
        <Card className="space-y-3 border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Delmål (valfritt)</p>
              <p className="text-xs text-muted-foreground">Bryt ner stora mål – t.ex. "10 km sub 55 min" mot halvmaraton</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append({ title: "", target_value: "", goal_type: "distance", session_type: "löpning" })}
            >
              + Lägg till
            </Button>
          </div>
          {subFields.map((sg, i) => (
            <div key={sg.id} className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <Input placeholder="Delmål-titel" {...register(`sub_goals.${i}.title` as const)} />
              <div className="grid grid-cols-2 gap-2">
                <select
                  {...register(`sub_goals.${i}.goal_type` as const)}
                  className="h-10 rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="distance">Distans (km)</option>
                  <option value="sessions">Antal pass</option>
                </select>
                <Input
                  type="number"
                  placeholder="Mål"
                  {...register(`sub_goals.${i}.target_value` as const)}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Ta bort
              </button>
            </div>
          ))}
        </Card>
      )}

      <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-xl">
          {!formState.isValid && formState.isSubmitted && (
            <p className="mb-2 rounded-md bg-card/95 px-3 py-2 text-center text-xs font-semibold text-amber-300 shadow-md">
              Fyll i fälten ovan för att kunna spara
            </p>
          )}
          <Button
            type="submit"
            disabled={createMut.isPending}
            className="h-14 w-full forge-gradient text-base font-bold text-primary-foreground ember-glow hover:opacity-90 disabled:opacity-50"
          >
            {createMut.isPending ? "Sparar…" : "Skapa mål"}
          </Button>
        </div>
      </div>

      {/* Hidden silenced warnings: read of these prevents tree-shaking warnings */}
      <span className="hidden">{String(targetValue)}{String(targetReps)}{String(processCount)}</span>
    </form>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-[11px] font-semibold text-destructive">{msg}</p>;
}
