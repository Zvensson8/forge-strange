import { progressToNextLevel } from "@/lib/forge-utils";

export function LevelBar({ xp }: { xp: number }) {
  const { level, pct, xpInLevel, xpForNext } = progressToNextLevel(xp);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">Forge Level</span>
        <span className="font-mono text-muted-foreground">
          {xpInLevel} / {xpForNext} XP
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold tracking-tight">{level}</span>
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full forge-gradient transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
