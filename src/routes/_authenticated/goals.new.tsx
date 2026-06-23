import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { createGoal } from "@/lib/goals.functions";
import { getExercisesAndTemplates } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Dumbbell, Footprints, Timer, CalendarClock, Repeat } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/forge-utils";

export const Route = createFileRoute("/_authenticated/goals/new")({
  component: NewGoal,
  validateSearch: (s: Record<string, unknown>) => ({
    type: (s.type as GoalType) || undefined,
    value: typeof s.value === "string" ? s.value : undefined,
    unit: typeof s.unit === "string" ? s.unit : undefined,
    period: (s.period as "week" | "month") || undefined,
  }),
});

type GoalType = "strength" | "distance" | "sessions" | "event" | "process";

const TYPE_META: Record<GoalType, { label: string; icon: any; hint: string }> = {
  strength: { label: "Styrka", icon: Dumbbell, hint: "Lyft en viss vikt × reps på en övning" },
  distance: { label: "Distans", icon: Footprints, hint: "Total distans inom en period" },
  sessions: { label: "Antal pass", icon: Timer, hint: "Logga ett antal pass av en viss typ" },
  event: { label: "Evenemang", icon: CalendarClock, hint: "Träna mot en deadline – lopp, race" },
  process: { label: "Återkommande", icon: Repeat, hint: "T.ex. 3 pass eller 20 km per vecka – håll vanan" },
};

const SESSION_TYPES = ["styrka", "cirkel", "löpning", "cykling", "promenad"] as const;
type SessionType = typeof SESSION_TYPES[number];

function NewGoal() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getEx = useServerFn(getExercisesAndTemplates);
  const fn = useServerFn(createGoal);
  const ex = useQuery({ queryKey: ["exercises"], queryFn: () => getEx() });

  const search = Route.useSearch();
  const [type, setType] = useState<GoalType>(search.type ?? "strength");
  const [title, setTitle] = useState("");
  const [exerciseId, setExerciseId] = useState<string>("");
  const [targetValue, setTargetValue] = useState<string>(search.value ?? "");
  const [targetReps, setTargetReps] = useState<string>("5");
  const [sessionType, setSessionType] = useState<SessionType>("löpning");
  const [targetDate, setTargetDate] = useState<string>("");
  const [reminder, setReminder] = useState(false);
  const [cadence, setCadence] = useState<"daily" | "weekly">("weekly");
  const [processPeriod, setProcessPeriod] = useState<"week" | "month">(search.period ?? "week");
  const [processCount, setProcessCount] = useState<string>(search.type === "process" ? (search.value ?? "3") : "3");
  const [processMetric, setProcessMetric] = useState<"sessions" | "km">(search.unit === "km" ? "km" : "sessions");
  // Subgoals (created in second pass)
  const [subGoals, setSubGoals] = useState<{ title: string; target_value: string; goal_type: GoalType; session_type: SessionType }[]>([]);

  const weightExercises = useMemo(
    () => (ex.data?.exercises ?? []).filter((e: any) => !["Cirkel", "Core"].includes(e.category)),
    [ex.data],
  );

  const mut = useMutation({
    mutationFn: async () => {
      const unit =
        type === "strength" ? "kg" :
        type === "distance" || type === "event" ? "km" :
        type === "process" ? (processMetric === "km" ? "km" : "pass") :
        "pass";
      const tv = type === "process" ? Number(processCount) : Number(targetValue);
      const created = await fn({
        data: {
          title: title || autoTitle(),
          goal_type: type,
          target_value: tv,
          target_unit: unit,
          target_reps: type === "strength" ? Number(targetReps) : null,
          exercise_id: type === "strength" ? exerciseId || null : null,
          session_type: type === "strength" ? null : sessionType,
          target_date: targetDate || null,
          start_date: todayISO(),
          reminder_enabled: reminder,
          reminder_cadence: cadence,
          process_period: type === "process" ? processPeriod : null,
          process_target_count: type === "process" ? Number(processCount) : null,
          process_metric: type === "process" ? processMetric : null,
        },
      });
      // Create sub-goals
      for (const sg of subGoals) {
        if (!sg.title || !sg.target_value) continue;
        const sgUnit = sg.goal_type === "strength" ? "kg" : sg.goal_type === "distance" ? "km" : "pass";
        await fn({
          data: {
            title: sg.title,
            goal_type: sg.goal_type,
            target_value: Number(sg.target_value),
            target_unit: sgUnit,
            target_reps: null,
            exercise_id: null,
            session_type: sg.goal_type === "strength" ? null : sg.session_type,
            target_date: targetDate || null,
            start_date: todayISO(),
            reminder_enabled: false,
            reminder_cadence: "weekly",
            parent_goal_id: (created as any).id,
          },
        });
      }
      return created;
    },
    onSuccess: () => {
      toast.success("Mål skapat – nu smider vi mot det");
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate({ to: "/goals" });
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte spara"),
  });

  function autoTitle() {
    if (type === "strength") {
      const exName = ex.data?.exercises.find((e: any) => e.id === exerciseId)?.name ?? "Styrka";
      return `${exName} ${targetValue} kg × ${targetReps}`;
    }
    if (type === "distance") return `${targetValue} km ${sessionType}`;
    if (type === "sessions") return `${targetValue} ${sessionType}-pass`;
    if (type === "process") return `${processCount} ${processMetric === "km" ? "km" : sessionType + "-pass"} per ${processPeriod === "month" ? "månad" : "vecka"}`;
    return `Evenemang ${targetDate}`;
  }

  const canSave =
    (type === "process" ? Number(processCount) > 0 : Number(targetValue) > 0) &&
    (type !== "strength" || !!exerciseId) &&
    (type !== "event" || !!targetDate);

  const disabledReason = !canSave
    ? type === "strength" && !exerciseId
      ? "Välj en övning"
      : type === "strength" && !(Number(targetValue) > 0)
        ? "Ange mål-vikt"
        : type === "event" && !targetDate
          ? "Välj måldatum"
          : type === "process" && !(Number(processCount) > 0)
            ? "Ange antal/distans per period"
            : !(Number(targetValue) > 0)
              ? type === "sessions" ? "Ange antal pass" : "Ange mål-distans"
              : "Fyll i fälten ovan"
    : null;

  return (
    <div className="space-y-4 pb-32">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/goals" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">Nytt mål</h1>
      </header>

      <Card className="border-border bg-card p-4">
        <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Typ av mål</Label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(TYPE_META) as GoalType[]).map((t) => {
            const Icon = TYPE_META[t].icon;
            const active = type === t;
            return (
              <button
                key={t}
                onClick={() => setType(t)}
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
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="t.ex. Halvmaraton sub 1:55" />
        </div>

        {type === "strength" && (
          <>
            <div>
              <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Övning</Label>
              <select
                value={exerciseId}
                onChange={(e) => setExerciseId(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Välj övning…</option>
                {weightExercises.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Mål-vikt (kg)</Label>
                <Input type="number" inputMode="decimal" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="100" />
              </div>
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Reps</Label>
                <Input type="number" inputMode="numeric" value={targetReps} onChange={(e) => setTargetReps(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {(type !== "strength") && (
          <div>
            <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Passtyp</Label>
            <div className="flex flex-wrap gap-2">
              {SESSION_TYPES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSessionType(s)}
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
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={type === "sessions" ? "12" : "21.1"}
            />
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
                    onClick={() => setProcessMetric(m.v)}
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
              {processMetric === "km" && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Räknar distans från loggade {sessionType === "styrka" || sessionType === "cirkel" ? "löp-/cykel-/promenadpass" : sessionType + "spass"}.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                  {processMetric === "km" ? "Mål-km" : "Antal pass"}
                </Label>
                <Input type="number" inputMode="decimal" value={processCount} onChange={(e) => setProcessCount(e.target.value)} placeholder={processMetric === "km" ? "20" : "3"} />
              </div>
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Per</Label>
                <div className="flex gap-2">
                  {(["week", "month"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setProcessPeriod(p)}
                      className={cn(
                        "flex-1 rounded-full border px-3 py-1.5 text-xs font-semibold",
                        processPeriod === p
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground",
                      )}
                    >
                      {p === "week" ? "Vecka" : "Månad"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {(type === "event" || type === "distance" || type === "sessions") && (
          <div>
            <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
              {type === "event" ? "Måldatum (deadline)" : "Måldatum (valfritt)"}
            </Label>
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
        )}

        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Påminnelser</p>
              <p className="text-xs text-muted-foreground">In-app banner när du öppnar appen.</p>
            </div>
            <Switch checked={reminder} onCheckedChange={setReminder} />
          </div>
          {reminder && (
            <div className="flex gap-2 pt-1">
              {(["daily", "weekly"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCadence(c)}
                  className={cn(
                    "flex-1 rounded-full border px-3 py-1.5 text-xs font-semibold",
                    cadence === c
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
              size="sm"
              variant="outline"
              onClick={() =>
                setSubGoals([...subGoals, { title: "", target_value: "", goal_type: "distance", session_type: "löpning" }])
              }
            >
              + Lägg till
            </Button>
          </div>
          {subGoals.map((sg, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <Input
                placeholder="Delmål-titel"
                value={sg.title}
                onChange={(e) => {
                  const next = [...subGoals];
                  next[i].title = e.target.value;
                  setSubGoals(next);
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={sg.goal_type}
                  onChange={(e) => {
                    const next = [...subGoals];
                    next[i].goal_type = e.target.value as GoalType;
                    setSubGoals(next);
                  }}
                  className="h-10 rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="distance">Distans (km)</option>
                  <option value="sessions">Antal pass</option>
                </select>
                <Input
                  type="number"
                  placeholder="Mål"
                  value={sg.target_value}
                  onChange={(e) => {
                    const next = [...subGoals];
                    next[i].target_value = e.target.value;
                    setSubGoals(next);
                  }}
                />
              </div>
              <button
                onClick={() => setSubGoals(subGoals.filter((_, j) => j !== i))}
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
          <Button
            onClick={() => mut.mutate()}
            disabled={!canSave || mut.isPending}
            className="h-14 w-full forge-gradient text-base font-bold text-primary-foreground ember-glow hover:opacity-90"
          >
            {mut.isPending ? "Sparar…" : "Skapa mål"}
          </Button>
        </div>
      </div>
    </div>
  );
}
