import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Target, Trophy } from "lucide-react";

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

export function LogSuccessScreen({ data, onClose, nextTo = "/dashboard" }: { data: LogSuccessData; onClose?: () => void; nextTo?: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { (navigator as any).vibrate?.(15); } catch { /* noop */ }
    }
  }, []);

  function finish() {
    onClose?.();
    navigate({ to: nextTo as any });
  }

  const topWin = data.wins[0];
  const topGoal = data.goal_impact[0];

  return (
    <div className="space-y-5 pb-32">
      {/* Lugn rubrik */}
      <div className="pt-6 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Pass loggat</p>
        <h1 className="mt-2 text-3xl font-semibold">Klart. Bra jobbat.</h1>
      </div>

      {/* Tre lugna rader */}
      <Card className="border-border bg-card p-5">
        <div className="space-y-4">
          {/* Rad 1: vad du gjorde */}
          <Row
            icon={<Sparkles className="h-4 w-4 text-primary" />}
            label="Det här gjorde du"
            value={data.title}
            sub={data.subtitle}
          />
          {/* Rad 2: målpåverkan */}
          {topGoal ? (
            <Row
              icon={<Target className="h-4 w-4 text-primary" />}
              label="Närmare målet"
              value={`+${topGoal.delta_pct}% mot ${topGoal.title}`}
              sub={`Nu ${topGoal.progress_pct}% · ${topGoal.current_label}`}
            />
          ) : (
            <Row
              icon={<Target className="h-4 w-4 text-muted-foreground" />}
              label="Mål"
              value="Inga aktiva mål kopplade till detta pass"
              sub="Sätt ett mål för att se din progression"
            />
          )}
          {/* Rad 3: win om någon */}
          {topWin && (
            <Row
              icon={<Trophy className="h-4 w-4 text-amber-300" />}
              label="Det här var nytt"
              value={topWin.label}
            />
          )}
        </div>
      </Card>

      {/* Diskret metarad */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <span>+{data.xp_gained} XP</span>
        <span>·</span>
        <span>Streak {data.streak}</span>
        <span>·</span>
        <span>Nivå {data.new_level}</span>
      </div>

      {data.leveled_up && (
        <p className="text-center text-sm font-semibold text-primary">
          Du nådde nivå {data.new_level}.
        </p>
      )}

      {data.unlocked_achievements.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Nya märken: {data.unlocked_achievements.map((a) => a.name).join(" · ")}
        </p>
      )}

      <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-xl">
          <Button
            onClick={finish}
            className="h-14 w-full forge-gradient text-base font-semibold text-primary-foreground hover:opacity-90"
          >
            Klar
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-semibold leading-snug">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
