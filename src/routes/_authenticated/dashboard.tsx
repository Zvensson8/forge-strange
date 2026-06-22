import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard, seedDemoIfEmpty } from "@/lib/workout.functions";
import { listGoalsWithProgress } from "@/lib/goals.functions";
import { GoalCard, type GoalWithProgress } from "@/components/forge/GoalCard";
import { StreakBadge } from "@/components/forge/StreakBadge";
import { LevelBar } from "@/components/forge/LevelBar";
import { Heatmap } from "@/components/forge/Heatmap";
import { Card } from "@/components/ui/card";
import { Dumbbell, Timer, Footprints, Bike, Trees, Trophy, Sparkles, Zap, ChevronRight, Target, Plus, Bell, History as HistoryIcon } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Progress } from "@/components/ui/progress";
import { formatDateSv, formatPace } from "@/lib/forge-utils";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Filter = "alla" | "styrka" | "cirkel" | "löpning" | "cykling" | "promenad";
const HEATMAP_FILTERS: Filter[] = ["alla", "styrka", "cirkel", "löpning", "cykling", "promenad"];

function Dashboard() {
  const navigate = useNavigate();
  const getDash = useServerFn(getDashboard);
  const seedFn = useServerFn(seedDemoIfEmpty);
  const [filter, setFilter] = useState<Filter>("alla");

  const seedMut = useMutation({
    mutationFn: () => seedFn(),
    onSuccess: (r) => {
      if (r.seeded) dash.refetch();
    },
  });

  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDash(),
  });

  const goalsFn = useServerFn(listGoalsWithProgress);
  const goalsQ = useQuery({ queryKey: ["goals"], queryFn: () => goalsFn() });
  const goals = (goalsQ.data ?? []) as GoalWithProgress[];
  const activeGoals = goals.filter((g) => !g.completed);
  const urgentEvent = activeGoals.find(
    (g) => g.goal_type === "event" && g.weeks_left !== null && g.weeks_left <= 6,
  );
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

  useEffect(() => {
    if (dash.data && dash.data.stats.total_sessions === 0 && !seedMut.isPending && !seedMut.isSuccess) {
      seedMut.mutate();
    }
  }, [dash.data, seedMut]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const filteredHeatmap = useMemo(() => {
    const h = dash.data?.heatmap ?? [];
    if (filter === "alla") return h;
    return h.filter((r: any) => r.session_type === filter);
  }, [dash.data, filter]);

  if (dash.isLoading || !dash.data) {
    return <div className="py-20 text-center text-muted-foreground">Värmer upp smedjan…</div>;
  }

  const { stats, profile, recent_achievements, quest, strength_series, running_series, last7 } = dash.data as any;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Välkommen</p>
          <h1 className="text-2xl font-bold">{profile?.display_name ?? "Smed"}</h1>
        </div>
        <button
          onClick={signOut}
          className="flex h-11 w-11 items-center justify-center rounded-full forge-gradient font-bold text-primary-foreground ember-glow"
        >
          {(profile?.display_name ?? "S").slice(0, 1).toUpperCase()}
        </button>
      </header>

      {/* Streak + Level card */}
      <Card className="overflow-hidden border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Streak</p>
            <div className="mt-1.5">
              <StreakBadge days={stats?.current_streak ?? 0} large />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Längsta: <span className="font-mono font-semibold text-foreground">{stats?.longest_streak ?? 0}</span> dagar
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Totalt</p>
            <p className="text-3xl font-bold">{stats?.total_sessions ?? 0}</p>
            <p className="text-xs text-muted-foreground">pass</p>
          </div>
        </div>
        <div className="mt-5">
          <LevelBar xp={stats?.total_xp ?? 0} />
        </div>
      </Card>

      {/* Primary log button → chooser */}
      <Link
        to="/log"
        className="flex items-center justify-between rounded-xl border border-primary/50 bg-card p-4 transition-all hover:ember-glow"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full forge-gradient text-primary-foreground ember-glow">
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-base font-bold">Logga pass</p>
            <p className="text-xs text-muted-foreground">Välj styrka, cirkel, löpning, cykel eller promenad</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>

      {/* Quick shortcuts */}
      <div className="grid grid-cols-5 gap-2">
        <LogShortcut to="/log/strength" icon={Dumbbell} label="Styrka" />
        <LogShortcut to="/log/circuit" icon={Timer} label="Cirkel" />
        <LogShortcut to="/log/running" icon={Footprints} label="Löp" />
        <LogShortcut to="/log/cycling" icon={Bike} label="Cykel" />
        <LogShortcut to="/log/walking" icon={Trees} label="Gå" />
      </div>

      {/* Quick minipass */}
      <Link
        to="/log/quick"
        className="flex items-center justify-between rounded-xl border border-dashed border-primary/50 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Logga minipass · 15 min</p>
            <p className="text-xs text-muted-foreground">Räcker för full streak på låg-motivations-dagar</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>

      {/* Goals section */}
      {urgentEvent && (
        <Card className="border-amber-500/50 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-200">
                {urgentEvent.weeks_left} {urgentEvent.weeks_left === 1 ? "vecka" : "veckor"} kvar till{" "}
                {urgentEvent.title}
              </p>
              <p className="mt-0.5 text-xs text-amber-300/80">
                Du ligger på {urgentEvent.progress_pct}% – {urgentEvent.pace === "danger" ? "långt efter" : urgentEvent.pace === "behind" ? "efter" : "i takt med"}{" "}
                planen. Klicka för detaljer.
              </p>
              <Link
                to="/goals/$id"
                params={{ id: urgentEvent.id }}
                className="mt-2 inline-block text-xs font-semibold text-amber-300 underline-offset-2 hover:underline"
              >
                Öppna mål →
              </Link>
            </div>
          </div>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Target className="h-4 w-4" /> Aktiva mål
          </h2>
          <Link to="/goals" className="text-xs font-semibold text-primary">
            Alla →
          </Link>
        </div>
        {activeGoals.length === 0 ? (
          <Link
            to="/goals/new"
            className="flex items-center justify-between rounded-xl border border-dashed border-border bg-card/40 p-4 transition-colors hover:border-primary/50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Plus className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Sätt ditt första mål</p>
                <p className="text-xs text-muted-foreground">Smedjan följer takten åt dig</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        ) : (
          activeGoals.slice(0, 2).map((g) => <GoalCard key={g.id} goal={g} compact />)
        )}
      </section>

      {/* Last 7 days */}
      <Card className="border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Senaste 7 dagar</p>
          <Link to="/history" className="flex items-center gap-1 text-xs font-semibold text-primary">
            <HistoryIcon className="h-3 w-3" /> Historik
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          <Mini7 label="Totalt" value={last7?.total ?? 0} accent />
          <Mini7 label="Styrka" value={last7?.styrka ?? 0} />
          <Mini7 label="Cirkel" value={last7?.cirkel ?? 0} />
          <Mini7 label="Löpning" value={last7?.löpning ?? 0} />
          <Mini7 label="Cykling" value={last7?.cykling ?? 0} />
          <Mini7 label="Promenad" value={last7?.promenad ?? 0} />
        </div>
      </Card>


      {/* Heatmap with filters */}
      <Card className="border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Aktivitet · 6 v</h2>
        </div>
        <div className="mb-3 flex gap-1.5 overflow-x-auto">
          {HEATMAP_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors",
                filter === f
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <Heatmap data={filteredHeatmap as any} weeks={6} />
      </Card>

      {/* Veckoreview – stor och framträdande */}
      <Link to="/review" className="block">
        <Card className="relative overflow-hidden border-primary/40 bg-card p-5 transition-all hover:border-primary hover:ember-glow">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl forge-gradient text-primary-foreground ember-glow">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Veckoreview</p>
                <p className="text-base font-bold">Smedjans 3 insikter för dig</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Personlig AI-coach · uppdateras varje gång</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
          </div>
        </Card>
      </Link>

      {/* Weekly quest */}
      {quest && (
        <Card className="border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Veckans uppdrag</p>
              <p className="mt-1 font-semibold">{quest.description}</p>
            </div>
            <span className="font-mono text-lg font-bold text-primary">
              {quest.progress}/{quest.target}
            </span>
          </div>
          <Progress value={(quest.progress / quest.target) * 100} className="mt-3 h-2" />
          {quest.completed && <p className="mt-2 text-xs text-primary">Klar! Veckans glöd brinner stark.</p>}
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ChartCard title="Knäböj – tyngsta vikt" series={strength_series} valueKey="value" suffix=" kg" />
        <ChartCard
          title="Löpning – pace (min/km)"
          series={running_series.map((r: any) => ({ date: r.date, value: r.pace / 60 }))}
          valueKey="value"
          formatter={(v: number) => formatPace(v * 60)}
          invert
        />
      </div>

      {/* Recent achievements */}
      {recent_achievements.length > 0 && (
        <Card className="border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Senaste märken</h2>
            <Link to="/achievements" className="text-xs font-semibold text-primary">
              Alla →
            </Link>
          </div>
          <div className="space-y-2">
            {recent_achievements.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md forge-gradient text-primary-foreground">
                  <Trophy className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Mini7({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn("rounded-lg p-2", accent ? "bg-primary/10" : "bg-muted/40")}>
      <p className={cn("font-mono text-2xl font-bold", accent ? "text-primary" : "text-foreground")}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function LogShortcut({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to as any}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/50 hover:ember-glow"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg forge-gradient text-primary-foreground">
        <Icon className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  );
}

function ChartCard({
  title,
  series,
  formatter,
  suffix,
  invert,
}: {
  title: string;
  series: { date: string; value: number }[];
  valueKey: string;
  formatter?: (v: number) => string;
  suffix?: string;
  invert?: boolean;
}) {
  if (!series.length) {
    return (
      <Card className="border-border bg-card p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <p className="py-6 text-center text-xs text-muted-foreground">Logga pass för att se grafen</p>
      </Card>
    );
  }
  return (
    <Card className="border-border bg-card p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <XAxis dataKey="date" hide />
            <YAxis
              domain={["auto", "auto"]}
              reversed={invert}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickFormatter={(v) => (formatter ? formatter(v) : `${v}${suffix ?? ""}`)}
              width={48}
            />
            <Tooltip
              contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any) => (formatter ? formatter(v) : `${v}${suffix ?? ""}`)}
              labelFormatter={(l) => formatDateSv(l as string)}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--color-primary)" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
