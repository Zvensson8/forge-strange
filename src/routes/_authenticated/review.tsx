import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWeeklyReview } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Flame, Trophy, Dumbbell, Footprints, Timer, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { formatDateSv } from "@/lib/forge-utils";

export const Route = createFileRoute("/_authenticated/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const navigate = useNavigate();
  const fn = useServerFn(getWeeklyReview);
  const m = useMutation({ mutationFn: () => fn() });

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
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Smedjans röst</p>
          <h1 className="text-2xl font-bold">Veckoreview</h1>
        </div>
      </header>

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

      {/* Goal status */}
      {s?.goals && s.goals.length > 0 && (
        <Card className="border-border bg-card p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status för dina mål
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
