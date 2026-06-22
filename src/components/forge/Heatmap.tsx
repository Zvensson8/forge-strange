import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Entry = { date: string; session_type: string };

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function Heatmap({ data, weeks = 6 }: { data: Entry[]; weeks?: number }) {
  const today = useMemo(() => new Date(), []);
  const days = weeks * 7;

  const map = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of data) {
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date)!.push(e.session_type);
    }
    return m;
  }, [data]);

  // Build columns (weeks) of 7 days, monday-first
  const todayDow = (today.getDay() + 6) % 7;
  const startOffset = (weeks - 1) * 7 + todayDow;
  const cells: { date: string; types: string[] }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (startOffset - i));
    const iso = isoDate(d);
    cells.push({ date: iso, types: map.get(iso) ?? [] });
  }

  const dayLabels = ["M", "T", "O", "T", "F", "L", "S"];

  return (
    <div className="flex gap-2">
      <div className="flex flex-col gap-1 pt-0.5 text-[10px] text-muted-foreground">
        {dayLabels.map((d) => (
          <div key={d} className="h-5 leading-5">
            {d}
          </div>
        ))}
      </div>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: weeks }).map((_, w) => (
          <div key={w} className="flex flex-1 flex-col gap-1">
            {Array.from({ length: 7 }).map((_, d) => {
              const cell = cells[w * 7 + d];
              const intensity = cell.types.length;
              const isFuture = cell.date > isoDate(today);
              return (
                <div
                  key={d}
                  title={cell.date + (cell.types.length ? ` – ${cell.types.join(", ")}` : "")}
                  className={cn(
                    "h-5 flex-1 rounded-[3px] transition-colors",
                    isFuture
                      ? "bg-transparent"
                      : intensity === 0
                        ? "bg-muted/60"
                        : intensity === 1
                          ? "bg-primary/55"
                          : "bg-primary ember-glow",
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
