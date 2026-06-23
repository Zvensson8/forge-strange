import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getMonthlyReview } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Trophy, Flame, Dumbbell, Footprints, Bike, Trees, Timer, Target, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/review/month")({
  component: MonthReview,
});

function MonthReview() {
  const navigate = useNavigate();
  const fn = useServerFn(getMonthlyReview);
  const m = useMutation({ mutationFn: () => fn() });
  useEffect(() => {
    m.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = m.data?.summary as any;
  const bullets = (m.data?.insights ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-•*]\s*/, ""));

  const monthLabel = s?.month
    ? new Date(s.month).toLocaleDateString("sv-SE", { month: "long", year: "numeric" })
    : "";

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/review" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Månadsöversikt</p>
          <h1 className="text-2xl font-bold capitalize">{monthLabel || "Denna månad"}</h1>
        </div>
      </header>

      {!s && m.isPending && (
        <p className="py-10 text-center text-sm text-muted-foreground">Smedjan summerar månaden…</p>
      )}

      {s && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <BigStat icon={Sparkles} label="Pass" value={`${s.total}`} suffix={`${s.days_trained} dagar`} tone="primary" />
            <BigStat icon={Flame} label="Streak" value={`${s.current_streak}`} suffix={`längsta ${s.longest_streak}`} />
            <BigStat icon={Dumbbell} label="Lyftvolym" value={s.total_volume_kg.toLocaleString("sv-SE")} suffix="kg" />
            <BigStat icon={Footprints} label="Distans" value={`${s.total_distance}`} suffix="km" />
          </div>

          <Card className="border-border bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fördelning</p>
            <div className="grid grid-cols-5 gap-2">
              <TypeCount icon={Dumbbell} label="Styrka" value={s.sessions_by_type.styrka} />
              <TypeCount icon={Timer} label="Cirkel" value={s.sessions_by_type.cirkel} />
              <TypeCount icon={Footprints} label="Löp" value={s.sessions_by_type.löpning} />
              <TypeCount icon={Bike} label="Cykel" value={s.sessions_by_type.cykling} />
              <TypeCount icon={Trees} label="Gå" value={s.sessions_by_type.promenad} />
            </div>
          </Card>

          {s.pr_count > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5 p-5">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-300" />
                <p className="font-bold text-amber-100">
                  {s.pr_count} {s.pr_count === 1 ? "PR" : "PR:er"} denna månad
                </p>
              </div>
            </Card>
          )}

          {s.goals.length > 0 && (
            <Card className="border-border bg-card p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Target className="h-3.5 w-3.5" /> Mål-status
              </p>
              <div className="space-y-2">
                {s.goals.map((g: any) => (
                  <Link key={g.id} to="/goals/$id" params={{ id: g.id }} className="block rounded-md border border-border bg-muted/30 p-3 hover:border-primary/40">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-semibold">{g.title}</p>
                      <span className="font-mono text-xs text-muted-foreground">{g.progress_pct}%</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{g.current_label} / {g.target}{g.weeks_left !== null ? ` · ${g.weeks_left} v kvar` : ""}</p>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <Card className="border-primary/30 bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md forge-gradient text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Månadens insikter</p>
              </div>
              <button onClick={() => m.mutate()} disabled={m.isPending} className="text-muted-foreground hover:text-primary disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${m.isPending ? "animate-spin" : ""}`} />
              </button>
            </div>
            {bullets.length > 0 && (
              <ol className="space-y-3">
                {bullets.slice(0, 5).map((b, i) => (
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

          <Button onClick={() => navigate({ to: "/review" })} variant="outline" className="w-full">
            Tillbaka till veckoreview
          </Button>
        </>
      )}
    </div>
  );
}

function BigStat({ icon: Icon, label, value, suffix, tone }: { icon: any; label: string; value: string; suffix: string; tone?: "primary" }) {
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
