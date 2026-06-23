import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  className?: string;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  function commit(raw: string) {
    const cleaned = raw.replace(",", ".").trim();
    if (cleaned === "" || isNaN(Number(cleaned))) {
      setText(String(value));
      return;
    }
    const n = Math.max(min, Number(Number(cleaned).toFixed(2)));
    onChange(n);
    setText(String(n));
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-11 w-11 shrink-0"
        onClick={() => onChange(Math.max(min, Number((value - step).toFixed(2))))}
      >
        <Minus className="h-5 w-5" />
      </Button>
      <div className="flex h-11 min-w-[72px] flex-1 items-center justify-center gap-1 rounded-md border border-border bg-muted/40 px-1">
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          onFocus={(e) => e.target.select()}
          className="w-full bg-transparent text-center font-mono text-lg font-semibold outline-none"
        />
        {suffix ? <span className="shrink-0 text-xs font-normal text-muted-foreground">{suffix}</span> : null}
      </div>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-11 w-11 shrink-0"
        onClick={() => onChange(Number((value + step).toFixed(2)))}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}
