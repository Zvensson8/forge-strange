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
      <div className="flex h-11 min-w-[72px] flex-1 items-center justify-center rounded-md border border-border bg-muted/40 font-mono text-lg font-semibold">
        {value}
        {suffix ? <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span> : null}
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
