import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Dumbbell, Timer, Footprints, Bike, Trees, Zap, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/log/")({
  component: LogChooser,
});

const choices = [
  { to: "/log/strength", icon: Dumbbell, label: "Styrka", desc: "Lyft, set & reps · +50 XP" },
  { to: "/log/circuit", icon: Timer, label: "Cirkelpass", desc: "HIIT / kroppsvikt · +60 XP" },
  { to: "/log/running", icon: Footprints, label: "Löpning", desc: "Distans & pace · +50 XP" },
  { to: "/log/cycling", icon: Bike, label: "Cykling", desc: "Distans & tid · +50 XP" },
  { to: "/log/walking", icon: Trees, label: "Promenad", desc: "Återhämtning · +35 XP" },
] as const;

function LogChooser() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
          aria-label="Tillbaka"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Logga pass</h1>
          <p className="text-xs text-muted-foreground">Välj typ av träning du gjort</p>
        </div>
      </header>

      <div className="space-y-2">
        {choices.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.to} to={c.to}>
              <Card className="flex items-center gap-3 border-border bg-card p-4 transition-all hover:border-primary/50 hover:ember-glow">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl forge-gradient text-primary-foreground">
                  <Icon className="h-6 w-6" strokeWidth={2.5} />
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Card>
            </Link>
          );
        })}
      </div>

      <Link
        to="/log/quick"
        className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-primary/50 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Minipass · 15 min</p>
            <p className="text-xs text-muted-foreground">Halv XP, full streak – för lågmotivations-dagar</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>
    </div>
  );
}
