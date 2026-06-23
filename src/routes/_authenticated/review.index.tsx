import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWeeklyReview, getDashboard } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Flame, Trophy, Dumbbell, Footprints, Timer, TrendingUp, TrendingDown, Minus, RefreshCw, CalendarDays, AlertTriangle, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDateSv } from "@/lib/forge-utils";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/review/")({
  component: ReviewPage,
});

function ReviewPage() {
  const navigate = useNavigate();
  const fn = useServerFn(getWeeklyReview);
  const m = useMutation({ mutationFn: () => fn() });

  const dashFn = useServerFn(getDashboard);
  const dashQ = useQuery({ queryKey: ["dashboard"], queryFn: () => dashFn() });
  const quest = (dashQ.data as any)?.quest;
  const stats = (dashQ.data as any)?.stats;
  const todayISO = new Date().toISOString().slice(0, 10);
  const trainedToday = stats?.last_workout_date === todayISO;

  // Reflektion sparas lokalt
  const reflectionKey = `forge-reflection-${todayISO}`;
  const [reflection, setReflection] = useState("");
  useEffect(() => {
    try {
      setReflection(localStorage.getItem(reflectionKey) ?? "");
    } catch { /* noop */ }
  }, [reflectionKey]);

  function saveReflection(v: string) {
    setReflection(v);
    try { localStorage.setItem(reflectionKey, v); } catch { /* noop */ }
  }

  useEffect(() => {
    m.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = m.data?.summary;

  // Parse insights into bullet points
  const bullets = (m.data?.insights ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.replace(/^[-•*]\s*/, ""));

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
          aria-label="Tillbaka"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Kvällsreflektion</p>
          <h1 className="truncate text-2xl font-semibold">Veckan & idag</h1>
        </div>
      </header>

      {/* IDAG */}
      <Card className="border-border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Idag</p>
        <p className="mt-1 text-base font-semibold">
          {trainedToday ? "Du loggade ett pass idag." : "Vilodag — det är också träning."}
        </p>
        <label htmlFor="reflect" className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          En mening om dagen (valfritt)
        </label>
        <textarea
          id="reflect"
          value={reflection}
          onChange={(e) => saveReflection(e.target.value)}
          placeholder="T.ex. Tunga ben men envis vilja…"
          rows={2}
          className="mt-1.5 w-full resize-none rounded-md border border-border bg-background p-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </Card>

      {/* Veckans uppdrag (flyttat hit) */}
      {quest && (
        <Card className="border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Veckans uppdrag</p>
              <p className="mt-1 font-semibold">{quest.description}</p>
            </div>
            <span className="font-mono text-lg font-semibold text-primary">
              {quest.progress}/{quest.target}
            </span>
          </div>
          <Progress value={(quest.progress / quest.target) * 100} className="mt-3 h-2" />
          {quest.completed && <p className="mt-2 text-xs font-semibold text-primary">Klar! Veckans glöd brinner stark.</p>}
        </Card>
      )}


      {/* Stora nyckeltal */}
      {s && (
        <div className="grid grid-cols-2 gap-3">
          <BigStat icon={Flame} label="Streak" value={`${s.current_streak}`} suffix="dagar" tone="primary" />
          <BigStat icon={Sparkles} label="Pass i veckan" value={`${s.total}`} suffix={`${s.days_trained} dagar`} />
          <BigStat
            icon={Dumbbell}
            label="Lyftvolym"
            value={s.total_volume_kg > 0 ? s.total_volume_kg.toLocaleString("sv-SE") : "—"}
            suffix="kg"
          />
          <BigStat
            icon={Footprints}
            label="Löpdistans"
            value={s.total_distance > 0 ? s.total_distance.toFixed(1) : "—"}
            suffix="km"
          />
        </div>
      )}

      {/* Fördelning per typ */}
      {s && (
        <Card className="border-border bg-card p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fördelning denna vecka
          </p>
          <div className="grid grid-cols-3 gap-2">
            <TypeCount icon={Dumbbell} label="Styrka" value={s.strength} />
            <TypeCount icon={Timer} label="Cirkel" value={s.circuit} />
            <TypeCount icon={Footprints} label="Löpning" value={s.running} />
          </div>
        </Card>
      )}

      {/* Energinivå */}
      {s && s.energy_avg !== null && (
        <Card className="border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Snittenergi</p>
              <p className="mt-1 font-mono text-2xl font-bold">{s.energy_avg.toFixed(1)}<span className="text-sm text-muted-foreground">/10</span></p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {s.energy_trend > 0 ? (
                <><TrendingUp className="h-5 w-5 text-primary" /><span className="font-semibold text-primary">Stigande</span></>
              ) : s.energy_trend < 0 ? (
                <><TrendingDown className="h-5 w-5 text-destructive" /><span className="font-semibold text-destructive">Sjunkande</span></>
              ) : (
                <><Minus className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground">Stabil</span></>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* PR:er */}
      {s && s.pr_count > 0 && (
        <Card className="border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {s.pr_count} {s.pr_count === 1 ? "PR" : "PR:er"} denna vecka
            </p>
          </div>
          <div className="space-y-2">
            {s.prs.map((pr: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-md bg-muted/40 p-2.5 text-sm">
                <span className="font-semibold capitalize">{pr.type}</span>
                <span className="text-muted-foreground">{pr.detail}</span>
                <span className="font-mono text-xs text-muted-foreground">{formatDateSv(pr.date)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Risk-goals direkt om de finns */}
      {s?.goals && s.goals.filter((g: any) => g.pace === "Behöver öka" || g.pace === "Risk att missa").length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <p className="text-xs font-bold uppercase tracking-wider text-amber-200">Mål i riskzon</p>
          </div>
          <div className="space-y-1.5">
            {s.goals
              .filter((g: any) => g.pace === "Behöver öka" || g.pace === "Risk att missa")
              .map((g: any) => (
                <Link key={g.id} to="/goals/$id" params={{ id: g.id }} className="block rounded-md bg-amber-500/10 p-2 text-xs hover:bg-amber-500/20">
                  <p className="font-semibold text-amber-100">{g.title}</p>
                  <p className="text-amber-200/80">
                    {g.current} / {g.target} · {g.progress_pct}%
                    {g.weeks_left !== null && ` · ${g.weeks_left} v kvar`}
                  </p>
                </Link>
              ))}
          </div>
        </Card>
      )}

      {/* Goal status */}
      {s?.goals && s.goals.length > 0 && (
        <Card className="border-border bg-card p-5">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Target className="h-3.5 w-3.5" /> Status för dina mål
          </p>
          <div className="space-y-2">
            {s.goals.map((g: any) => {
              const tone =
                g.pace === "Före plan"
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                  : g.pace === "På rätt spår"
                    ? "text-primary bg-primary/10 border-primary/30"
                    : g.pace === "Behöver öka"
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                      : "text-red-400 bg-red-500/10 border-red-500/30";
              return (
                <Link
                  key={g.id}
                  to="/goals/$id"
                  params={{ id: g.id }}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3 hover:border-primary/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{g.title}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{g.current}</span> / <span className="font-mono">{g.target}</span>
                      {g.weeks_left !== null && ` · ${g.weeks_left} v kvar`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}>
                    {g.pace} · {g.progress_pct}%
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {/* Link to monthly review */}
      <Link to="/review/month" className="block">
        <Card className="flex items-center justify-between border-border bg-card p-4 transition-colors hover:border-primary/40">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Månadsöversikt</p>
              <p className="text-xs text-muted-foreground">Volym, PR:er, mål-utveckling – senaste 4 veckorna</p>
            </div>
          </div>
          <TrendingUp className="h-4 w-4 text-primary" />
        </Card>
      </Link>

      {/* AI-insikter */}
      <Card className="border-primary/30 bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md forge-gradient text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">3 insikter från smedjan</p>
          </div>
          <button
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="text-muted-foreground hover:text-primary disabled:opacity-50"
            aria-label="Generera igen"
          >
            <RefreshCw className={`h-4 w-4 ${m.isPending ? "animate-spin" : ""}`} />
          </button>
        </div>
        {m.isPending && !m.data && (
          <p className="text-sm text-muted-foreground">Smedjan analyserar dina senaste 14 dagar…</p>
        )}
        {m.isError && <p className="text-sm text-destructive">Kunde inte generera insikter. Försök igen.</p>}
        {bullets.length > 0 && (
          <ol className="space-y-3">
            {bullets.slice(0, 3).map((b, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Button onClick={() => m.mutate()} disabled={m.isPending} variant="outline" className="w-full">
        {m.isPending ? "Genererar…" : "Generera nya insikter"}
      </Button>
    </div>
  );
}

function BigStat({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  suffix: string;
  tone?: "primary";
}) {
  return (
    <Card className={`border-border bg-card p-4 ${tone === "primary" ? "border-primary/40" : ""}`}>
      <div className="mb-1 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone === "primary" ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="font-mono text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{suffix}</p>
    </Card>
  );
}

function TypeCount({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 text-center">
      <Icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
      <p className="font-mono text-xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
