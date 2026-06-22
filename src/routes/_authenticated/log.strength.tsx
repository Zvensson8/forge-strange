import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getExercisesAndTemplates, logStrengthOrCircuit } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/forge/Stepper";
import { ArrowLeft, Plus, X, Weight } from "lucide-react";
import { toast } from "sonner";
import { todayISO, isBodyweightCategory } from "@/lib/forge-utils";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/log/strength")({
  component: () => <LogStrengthOrCircuit kind="styrka" title="Styrkepass" />,
});

type SetRow = { weight: number | null; reps: number };

export function LogStrengthOrCircuit({ kind, title }: { kind: "styrka" | "cirkel"; title: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getEx = useServerFn(getExercisesAndTemplates);
  const logFn = useServerFn(logStrengthOrCircuit);

  const { data } = useQuery({ queryKey: ["exercises"], queryFn: () => getEx() });
  const [templateId, setTemplateId] = useState<string | "custom">("custom");
  const [picked, setPicked] = useState<{ exercise_id: string; sets: SetRow[] }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const templates = useMemo(
    () => (data?.templates ?? []).filter((t: any) => t.session_type === kind),
    [data, kind],
  );

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (id === "custom") {
      setPicked([]);
      return;
    }
    const tpl = data?.template_exercises.filter((te: any) => te.template_id === id) ?? [];
    setPicked(
      tpl.map((te: any) => {
        const ex = data?.exercises.find((e: any) => e.id === te.exercise_id);
        const bw = isBodyweightCategory(ex?.category);
        return {
          exercise_id: te.exercise_id,
          sets: Array.from({ length: te.target_sets }, () => ({ weight: bw ? null : 40, reps: te.target_reps })),
        };
      }),
    );
  }

  function addExercise(exId: string) {
    if (picked.find((p) => p.exercise_id === exId)) return;
    const ex = data?.exercises.find((e: any) => e.id === exId);
    const bw = isBodyweightCategory(ex?.category);
    setPicked([
      ...picked,
      {
        exercise_id: exId,
        // Default: 1 set
        sets: [{ weight: bw ? null : (ex?.category === "Underkropp" ? 40 : 20), reps: ex?.default_reps ?? 10 }],
      },
    ]);
  }

  function removeExercise(exId: string) {
    setPicked(picked.filter((p) => p.exercise_id !== exId));
  }

  async function submit() {
    if (picked.length === 0) {
      toast.error("Lägg till minst en övning");
      return;
    }
    setSubmitting(true);
    try {
      const setsPayload = picked.flatMap((p) =>
        p.sets.map((s, i) => ({
          exercise_id: p.exercise_id,
          set_index: i + 1,
          weight: s.weight,
          reps: s.reps,
        })),
      );
      const res = await logFn({
        data: {
          date: todayISO(),
          template_id: templateId === "custom" ? null : templateId,
          sets: setsPayload,
          session_type: kind,
        },
      });
      qc.invalidateQueries();
      toast.success(`+${res.xp_gained} XP · Streak ${res.streak} 🔥`, {
        description:
          (res.prs.length > 0 ? "Nytt PR! " : "") + (res.leveled_up ? `Du nådde Forge Level ${res.new_level}!` : ""),
      });
      for (const a of res.unlocked_achievements) {
        toast(a.name, { description: "Märke upplåst" });
      }
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte spara");
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) return <div className="py-20 text-center text-muted-foreground">Laddar…</div>;

  const exById = new Map(data.exercises.map((e: any) => [e.id, e]));
  const available = data.exercises.filter((e: any) => !picked.find((p) => p.exercise_id === e.id));

  return (
    <div className="space-y-4 pb-32">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate({ to: "/log" })} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{title}</h1>
      </header>

      <Card className="border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mall</p>
        <div className="flex flex-wrap gap-2">
          <TplChip active={templateId === "custom"} onClick={() => applyTemplate("custom")}>
            Custom
          </TplChip>
          {templates.map((t: any) => (
            <TplChip key={t.id} active={templateId === t.id} onClick={() => applyTemplate(t.id)}>
              {t.name}
            </TplChip>
          ))}
        </div>
      </Card>

      {picked.map((p, pi) => {
        const ex: any = exById.get(p.exercise_id);
        const bw = isBodyweightCategory(ex?.category);
        return (
          <Card key={p.exercise_id} className="border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold">{ex?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ex?.category}
                  {bw ? " · kroppsvikt" : ""}
                </p>
              </div>
              <button onClick={() => removeExercise(p.exercise_id)} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {p.sets.map((s, si) => {
                const hasWeight = s.weight !== null;
                return (
                  <div key={si} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-center font-mono text-sm text-muted-foreground">{si + 1}.</span>
                      <Stepper
                        value={s.reps}
                        onChange={(v) => {
                          const next = [...picked];
                          next[pi].sets[si].reps = v;
                          setPicked(next);
                        }}
                        suffix="reps"
                        className="flex-1"
                      />
                      {hasWeight ? (
                        <Stepper
                          value={s.weight ?? 0}
                          step={2.5}
                          onChange={(v) => {
                            const next = [...picked];
                            next[pi].sets[si].weight = v;
                            setPicked(next);
                          }}
                          suffix="kg"
                          className="flex-1"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...picked];
                            next[pi].sets[si].weight = bw ? 5 : 20;
                            setPicked(next);
                          }}
                          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                        >
                          <Weight className="h-3.5 w-3.5" /> + Vikt
                        </button>
                      )}
                      {hasWeight && bw && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...picked];
                            next[pi].sets[si].weight = null;
                            setPicked(next);
                          }}
                          className="text-[10px] uppercase text-muted-foreground hover:text-destructive"
                          aria-label="Ta bort vikt"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => {
                  const next = [...picked];
                  const last = p.sets[p.sets.length - 1] ?? { weight: bw ? null : 20, reps: 10 };
                  next[pi].sets.push({ ...last });
                  setPicked(next);
                }}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus className="h-3 w-3" /> Lägg till set
              </button>
            </div>
          </Card>
        );
      })}

      {available.length > 0 && (
        <Card className="border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lägg till övning</p>
          <div className="flex flex-wrap gap-2">
            {available.map((e: any) => (
              <button
                key={e.id}
                onClick={() => addExercise(e.id)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
              >
                + {e.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-xl">
          <Button
            onClick={submit}
            disabled={submitting || picked.length === 0}
            className="h-14 w-full forge-gradient text-base font-bold text-primary-foreground ember-glow hover:opacity-90"
          >
            {submitting ? "Sparar…" : "Spara pass"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TplChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
