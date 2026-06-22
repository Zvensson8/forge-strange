import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard, seedDemoIfEmpty } from "@/lib/workout.functions";
import { StreakBadge } from "@/components/forge/StreakBadge";
import { LevelBar } from "@/components/forge/LevelBar";
import { Heatmap } from "@/components/forge/Heatmap";
import { Card } from "@/components/ui/card";
import { Dumbbell, Timer, Footprints, Trophy, Sparkles, TrendingUp } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Progress } from "@/components/ui/progress";
import { formatDateSv, formatPace } from "@/lib/forge-utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const getDash = useServerFn(getDashboard);
  const seedFn = useServerFn(seedDemoIfEmpty);

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

  useEffect(() => {
    if (dash.data && dash.data.stats.total_sessions === 0 && !seedMut.isPending && !seedMut.isSuccess) {
      seedMut.mutate();
    }
  }, [dash.data, seedMut]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (dash.isLoading || !dash.data) {
    return <div className="py-20 text-center text-muted-foreground">Värmer upp smedjan…</div>;
  }

  const { stats, profile, heatmap, recent_achievements, quest, strength_series, running_series } = dash.data;

  const projected = Math.round(((stats?.current_streak ?? 0) * 0.7 + (stats?.total_sessions ?? 0) * 0.3) * 1.5);

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

      {/* Quick log */}
      <div className="grid grid-cols-3 gap-2">
        <LogButton to="/log/strength" icon={Dumbbell} label="Styrka" />
        <LogButton to="/log/circuit" icon={Timer} label="Cirkel" />
        <LogButton to="/log/running" icon={Footprints} label="Löpning" />
      </div>

      {/* Heatmap */}
      <Card className="border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Aktivitet · 6 veckor</h2>
        </div>
        <Heatmap data={heatmap as any} weeks={6} />
      </Card>

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

      {/* Compounding */}
      <Card className="border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm">
              Din consistency ger en projicerad utveckling på{" "}
              <span className="font-bold text-primary">+{projected}%</span> det här kvartalet. Små pass, varje vecka, blir
              till tung skillnad.
            </p>
            <Link to="/review" className="mt-2 inline-block text-xs font-semibold uppercase tracking-wider text-primary">
              Visa veckoreview →
            </Link>
          </div>
        </div>
      </Card>

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

function LogButton({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to as any}
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:ember-glow"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full forge-gradient text-primary-foreground">
        <Icon className="h-6 w-6" strokeWidth={2.5} />
      </span>
      <span className="text-xs font-semibold">{label}</span>
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
