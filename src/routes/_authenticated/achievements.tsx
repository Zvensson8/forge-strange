import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAchievements } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Trophy, Flame, Footprints, Shield, Hammer, Zap, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, any> = {
  flame: Flame,
  shield: Shield,
  hammer: Hammer,
  footprints: Footprints,
  trophy: Trophy,
  zap: Zap,
  layers: Layers,
};

export const Route = createFileRoute("/_authenticated/achievements")({
  component: AchievementsPage,
});

function AchievementsPage() {
  const fn = useServerFn(getAchievements);
  const { data } = useQuery({ queryKey: ["achievements"], queryFn: () => fn() });

  const items = data ?? [];
  const unlocked = items.filter((a: any) => a.unlocked_at).length;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Märken</h1>
        <p className="text-sm text-muted-foreground">
          {unlocked} av {items.length} smidda
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        {items.map((a: any) => {
          const Icon = iconMap[a.icon] ?? Trophy;
          const unlocked = !!a.unlocked_at;
          return (
            <Card
              key={a.id}
              className={cn(
                "border-border bg-card p-4 text-center transition-all",
                unlocked ? "ember-glow border-primary/50" : "opacity-60",
              )}
            >
              <div
                className={cn(
                  "mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full",
                  unlocked ? "forge-gradient text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <p className="font-semibold text-sm">{a.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
