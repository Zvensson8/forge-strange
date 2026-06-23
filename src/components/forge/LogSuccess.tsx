import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Trophy, Flame, TrendingUp, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type Win = { kind: "pr" | "longest" | "fastest" | "comeback" | "milestone"; label: string };

export type LogSuccessData = {
  title: string;
  subtitle?: string;
  xp_gained: number;
  total_xp: number;
  new_level: number;
  leveled_up: boolean;
  streak: number;
  wins: Win[];
  goal_impact: { id: string; title: string; delta_pct: number; progress_pct: number; current_label: string }[];
  unlocked_achievements: { code: string; name: string }[];
};

const WIN_ICON = {
  pr: Trophy,
  longest: TrendingUp,
  fastest: Zap,
  comeback: Sparkles,
  milestone: Sparkles,
};

export function LogSuccessScreen({ data, onClose, nextTo = "/dashboard" }: { data: LogSuccessData; onClose?: () => void; nextTo?: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    // Lite glöd-känsla genom haptik om mobil
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        (navigator as any).vibrate?.([20, 30, 20]);
      } catch {
        /* noop */
      }
    }
  }, []);

  function finish() {
    onClose?.();
    navigate({ to: nextTo as any });
  }

  return (
    <div className="space-y-4 pb-32">
      {/* Hero */}
      <Card className="relative overflow-hidden border-primary/40 bg-card p-6 text-center">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full forge-gradient ember-glow">
            <Sparkles className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="text-xs uppercase tracking-widest text-primary">Pass loggat</p>
          <h1 className="mt-1 text-2xl font-bold">{data.title}</h1>
          {data.subtitle && <p className="mt-1 text-sm text-muted-foreground">{data.subtitle}</p>}
          <div className="mt-4 flex items-center justify-center gap-6 text-center">
            <div>
              <p className="font-mono text-3xl font-bold text-primary">+{data.xp_gained}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">XP</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5">
                <Flame className="h-5 w-5 text-primary" />
                <p className="font-mono text-3xl font-bold">{data.streak}</p>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dagar streak</p>
            </div>
            <div>
              <p className="font-mono text-3xl font-bold">{data.new_level}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Forge Level</p>
            </div>
          </div>
          {data.leveled_up && (
            <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Du nådde Forge Level {data.new_level}!
            </div>
          )}
        </div>
      </Card>

      {/* Wins */}
      {data.wins.length > 0 && (
        <Card className="border-border bg-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Det här uppnådde du</p>
          <div className="space-y-2">
            {data.wins.map((w, i) => {
              const Icon = WIN_ICON[w.kind] ?? Sparkles;
              const tone = w.kind === "pr" ? "text-amber-300 bg-amber-500/10 border-amber-500/30" : "text-primary bg-primary/10 border-primary/30";
              return (
                <div key={i} className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm", tone)}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="font-semibold">{w.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Goal impact */}
      {data.goal_impact.length > 0 && (
        <Card className="border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Target className="h-3.5 w-3.5" /> Det här tog dig närmare målet
          </p>
          <div className="space-y-2">
            {data.goal_impact.map((g) => (
              <Link
                key={g.id}
                to="/goals/$id"
                params={{ id: g.id }}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3 hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{g.title}</p>
                  <p className="text-xs text-muted-foreground">{g.current_label} · nu {g.progress_pct}%</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 font-mono text-xs font-bold text-primary">
                  +{g.delta_pct}%
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Achievements */}
      {data.unlocked_achievements.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
            <Trophy className="h-3.5 w-3.5" /> Nya märken
          </p>
          <div className="space-y-1.5">
            {data.unlocked_achievements.map((a) => (
              <div key={a.code} className="text-sm font-semibold text-amber-100">
                · {a.name}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-xl">
          <Button
            onClick={finish}
            className="h-14 w-full forge-gradient text-base font-bold text-primary-foreground ember-glow hover:opacity-90"
          >
            Klart
          </Button>
        </div>
      </div>
    </div>
  );
}
