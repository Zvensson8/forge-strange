import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/workout.functions";
import { listGoalsWithProgress } from "@/lib/goals.functions";
import { GoalCard, type GoalWithProgress } from "@/components/forge/GoalCard";
import { StreakDangerBanner } from "@/components/forge/StreakDangerBanner";
import { EmptyState, StatusPill } from "@/components/forge/EmptyState";
import { Card } from "@/components/ui/card";
import { Dumbbell, Footprints, Bike, Trees, Timer, Plus, ChevronRight, Target, History as HistoryIcon, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

export default Dashboard;

function Dashboard() {
  const navigate = useNavigate();
  const getDash = useServerFn(getDashboard);

  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDash(),
  });

  const goalsFn = useServerFn(listGoalsWithProgress);
  const goalsQ = useQuery({ queryKey: ["goals"], queryFn: () => goalsFn() });
  const goals = (goalsQ.data ?? []) as GoalWithProgress[];
  const topLevel = goals.filter((g) => !(g as any).parent_goal_id);
  const subsByParent = new Map<string, GoalWithProgress[]>();
  for (const g of goals) {
    const pid = (g as any).parent_goal_id;
    if (pid) {
      if (!subsByParent.has(pid)) subsByParent.set(pid, []);
      subsByParent.get(pid)!.push(g);
    }
  }
  const activeGoals = topLevel.filter((g) => !g.completed);
  const reminderGoal = activeGoals.find((g) => (g as any).reminder_enabled);

  // In-app reminder: visa toast om man inte loggat idag och har påminnelse på
  useEffect(() => {
    if (!dash.data || !reminderGoal) return;
    const key = `forge-reminded-${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(key)) return;
    const today = new Date().toISOString().slice(0, 10);
    const trainedToday = dash.data.stats?.last_workout_date === today;
    if (!trainedToday) {
      toast(`Påminnelse: ${reminderGoal.title}`, {
        description: "Logga ett pass idag för att hålla takten mot ditt mål.",
        duration: 6000,
      });
      sessionStorage.setItem(key, "1");
    }
  }, [dash.data, reminderGoal]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  // Statussammanfattning — en mening
  const status = useMemo(() => {
    if (!dash.data) return null;
    return computeStatus({
      lastDate: dash.data.stats?.last_workout_date ?? null,
      goals: activeGoals,
    });
  }, [dash.data, activeGoals]);

  if (dash.isLoading || !dash.data) {
    return <div className="py-20 text-center text-muted-foreground">Värmer upp smedjan…</div>;
  }

  const { stats, profile } = dash.data as any;
  const hasWorkouts = (stats?.total_sessions ?? 0) > 0;
  const today = new Date();
  const dateStr = today.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-5">
      {/* Lugn header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Hej</p>
          <h1 className="truncate text-2xl font-semibold">{profile?.display_name ?? "Smed"}</h1>
          <p className="mt-0.5 text-xs capitalize text-muted-foreground">{dateStr}</p>
        </div>
        <button
          onClick={signOut}
          aria-label="Profilmeny"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground"
        >
          {(profile?.display_name ?? "S").slice(0, 1).toUpperCase()}
        </button>
      </header>

      {/* Streak danger (visas bara vid faktisk risk) */}
      <StreakDangerBanner streak={stats?.current_streak ?? 0} lastDate={stats?.last_workout_date ?? null} />

      {/* STATUS IDAG — kärnbudskapet */}
      {status && (
        <Card className="border-border bg-card p-5">
          <StatusPill tone={status.tone} label={status.short} />
          <p className="mt-2 text-base font-semibold leading-snug">{status.message}</p>
          {status.detail && (
            <p className="mt-1 text-xs text-muted-foreground">{status.detail}</p>
          )}
        </Card>
      )}

      {/* Primär CTA */}
      <Link
        to="/log"
        className="flex items-center justify-between rounded-2xl border border-primary/40 bg-card p-5 transition-all hover:border-primary hover:ember-glow"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full forge-gradient text-primary-foreground ember-glow">
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-base font-semibold">Logga pass</p>
            <p className="text-xs text-muted-foreground">Styrka · Cirkel · Löpning · Cykel · Promenad</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>

      {/* Aktiva mål – kompakt */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Target className="h-3.5 w-3.5" /> Aktiva mål
          </h2>
          {activeGoals.length > 0 && (
            <Link to="/goals" className="text-xs font-semibold text-primary">
              Alla →
            </Link>
          )}
        </div>
        {activeGoals.length === 0 ? (
          <>
            <EmptyState
              icon={Target}
              title="Sätt ditt första mål"
              description="Smedjan följer takten åt dig och visar om du är på rätt väg."
              ctaLabel="Skapa mål"
              ctaTo="/goals/new"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <GoalSuggestion label="Springa 5 km" sub="Distansmål" to="/goals/new?type=distance&value=5&unit=km" />
              <GoalSuggestion label="3 pass/vecka" sub="Återkommande" to="/goals/new?type=process&value=3&period=week" />
              <GoalSuggestion label="Halvmaraton" sub="Eventmål" to="/goals/new?type=event&value=21.1&unit=km" />
            </div>
          </>
        ) : (
          activeGoals.slice(0, 3).map((g) => (
            <GoalCard key={g.id} goal={g} compact subGoals={subsByParent.get(g.id) ?? []} />
          ))
        )}
      </section>

      {/* Senaste pass / tomt-state */}
      {!hasWorkouts ? (
        <Card className="border border-dashed border-border bg-card/40 p-5">
          <p className="text-sm font-semibold">Inga pass loggade än</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Logga ditt första pass — det tar 20 sekunder.
          </p>
          <div className="mt-4 grid grid-cols-5 gap-2">
            <LogShortcut to="/log/strength" icon={Dumbbell} label="Styrka" />
            <LogShortcut to="/log/circuit" icon={Timer} label="Cirkel" />
            <LogShortcut to="/log/running" icon={Footprints} label="Löp" />
            <LogShortcut to="/log/cycling" icon={Bike} label="Cykel" />
            <LogShortcut to="/log/walking" icon={Trees} label="Gå" />
          </div>
        </Card>
      ) : (
        <Link to="/history" className="block">
          <Card className="flex items-center justify-between border-border bg-card p-4 transition-colors hover:border-primary/40">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
                <HistoryIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Historik</p>
                <p className="text-xs text-muted-foreground">
                  {stats?.total_sessions} pass loggade · senast {stats?.last_workout_date ?? "—"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Card>
        </Link>
      )}

      {/* Kvällsreflektion */}
      <Link to="/review" className="block">
        <Card className="flex items-center justify-between border-border bg-card p-4 transition-colors hover:border-primary/40">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Kvällsreflektion</p>
              <p className="text-xs text-muted-foreground">Veckans uppdrag, insikter och reflektion</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Card>
      </Link>

      {/* Lugn metarad längst ner */}
      <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
        <span>Streak <span className="font-mono font-semibold text-foreground">{stats?.current_streak ?? 0}</span></span>
        <span>·</span>
        <span>Nivå <span className="font-mono font-semibold text-foreground">{stats?.level ?? 1}</span></span>
        <span>·</span>
        <span><span className="font-mono font-semibold text-foreground">{stats?.total_xp ?? 0}</span> XP</span>
      </div>
    </div>
  );
}

function GoalSuggestion({ label, sub, to }: { label: string; sub: string; to: string }) {
  return (
    <Link
      to={to as any}
      className="rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/50"
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </Link>
  );
}

function LogShortcut({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to as any}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/50"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  );
}

// --- Status-sammanfattning -------------------------------------------------

type Status = {
  tone: "good" | "warn" | "bad" | "neutral";
  short: string;
  message: string;
  detail?: string;
};

function computeStatus({
  lastDate,
  goals,
}: {
  lastDate: string | null;
  goals: GoalWithProgress[];
}): Status {
  const todayISO = new Date().toISOString().slice(0, 10);
  const trainedToday = lastDate === todayISO;

  if (!goals.length) {
    return {
      tone: "neutral",
      short: "Inget mål satt",
      message: "Sätt ett mål för att se om du är på rätt väg.",
      detail: "Smedjan jämför din takt mot målet och säger till om du behöver öka.",
    };
  }

  // Hitta värsta målets pace
  const order = { danger: 0, behind: 1, on_track: 2, ahead: 3 } as const;
  const worst = [...goals].sort((a, b) => order[a.pace] - order[b.pace])[0];
  const best = [...goals].sort((a, b) => order[b.pace] - order[a.pace])[0];

  if (worst.pace === "danger") {
    return {
      tone: "bad",
      short: "Risk att missa mål",
      message: `Du är långt efter på ${worst.title}.`,
      detail:
        worst.required_per_week && worst.current_per_week !== null && worst.current_per_week !== undefined
          ? `Krav: ${worst.required_per_week} ${worst.target_unit}/v – du gör ${worst.current_per_week}. Öka takten nu.`
          : trainedToday
            ? "Du loggade idag – fortsätt så."
            : "Logga ett pass idag för att komma ifatt.",
    };
  }
  if (worst.pace === "behind") {
    return {
      tone: "warn",
      short: "Något efter plan",
      message: `Du behöver öka takten på ${worst.title}.`,
      detail:
        worst.required_per_week && worst.current_per_week !== null && worst.current_per_week !== undefined
          ? `Öka från ${worst.current_per_week} till ${worst.required_per_week} ${worst.target_unit}/v.`
          : "Ett pass till denna vecka räcker långt.",
    };
  }
  // alla i fas eller före
  return {
    tone: "good",
    short: "På rätt väg",
    message: trainedToday
      ? `Bra jobbat idag. Du ligger ${best.pace === "ahead" ? "före" : "i fas med"} ditt mål ${best.title}.`
      : `Du ligger ${best.pace === "ahead" ? "före" : "i fas med"} ditt mål ${best.title}.`,
    detail: trainedToday
      ? undefined
      : "Logga dagens pass för att hålla momentum.",
  };
}
