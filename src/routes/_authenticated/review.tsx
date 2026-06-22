import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWeeklyReview } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const fn = useServerFn(getWeeklyReview);
  const m = useMutation({ mutationFn: () => fn() });

  useEffect(() => {
    m.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Veckoreview</h1>
        <p className="text-sm text-muted-foreground">Smedjans röst om din vecka.</p>
      </header>

      {m.data?.summary && (
        <Card className="border-border bg-card p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sammanfattning</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="Pass" value={String(m.data.summary.total)} />
            <Stat label="Styrka" value={String(m.data.summary.strength)} />
            <Stat label="Cirkel" value={String(m.data.summary.circuit)} />
            <Stat label="Löpning" value={String(m.data.summary.running)} />
          </div>
          {m.data.summary.total_distance > 0 && (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Total löpdistans:{" "}
              <span className="font-mono font-bold text-primary">{m.data.summary.total_distance.toFixed(1)} km</span>
            </p>
          )}
        </Card>
      )}

      <Card className="border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI-insikter</p>
        </div>
        {m.isPending && <p className="text-sm text-muted-foreground">Smedjan analyserar din vecka…</p>}
        {m.isError && <p className="text-sm text-destructive">Kunde inte generera insikter. Försök igen.</p>}
        {m.data?.insights && (
          <div className="prose prose-sm prose-invert whitespace-pre-wrap text-sm leading-relaxed">
            {m.data.insights}
          </div>
        )}
      </Card>

      <Button onClick={() => m.mutate()} disabled={m.isPending} variant="outline" className="w-full">
        Generera igen
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-bold">{value}</p>
    </div>
  );
}
