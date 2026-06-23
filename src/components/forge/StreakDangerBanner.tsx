import { Link } from "@tanstack/react-router";
import { Flame, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StreakDangerBanner({ streak, lastDate }: { streak: number; lastDate: string | null }) {
  if (streak <= 0) return null;
  const todayISO = new Date().toISOString().slice(0, 10);
  if (lastDate === todayISO) return null;

  const hour = new Date().getHours();
  // Vid streak ≥ 7 visa från kl 12, annars från kl 18
  const threshold = streak >= 7 ? 12 : 18;
  if (hour < threshold) return null;

  return (
    <Link to="/log" className="block">
      <Card className="border-amber-500/50 bg-amber-500/10 p-4 transition-colors hover:bg-amber-500/15">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-100">
              Streak i fara · <Flame className="inline h-3.5 w-3.5" /> {streak} dagar
            </p>
            <p className="mt-0.5 text-xs text-amber-200/80">
              Logga ett pass idag (även 15 min minipass räcker) för att inte bryta streaken.
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
