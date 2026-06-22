import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export function StreakBadge({ days, large = false }: { days: number; large?: boolean }) {
  const active = days > 0;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold",
        large && "px-4 py-2 text-lg",
        active
          ? "forge-gradient text-primary-foreground ember-glow"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Flame className={cn("h-4 w-4", large && "h-5 w-5")} strokeWidth={2.5} />
      <span>
        {days} {days === 1 ? "dag" : "dagar"}
      </span>
    </div>
  );
}
