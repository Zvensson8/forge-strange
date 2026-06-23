import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import type { ComponentType } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaTo,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
}) {
  return (
    <Link to={ctaTo as any} className="block">
      <Card className="flex items-center gap-4 border border-dashed border-border bg-card/40 p-5 transition-colors hover:border-primary/50">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          <p className="mt-2 text-xs font-semibold text-primary">{ctaLabel} →</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Card>
    </Link>
  );
}

export function StatusPill({
  tone,
  label,
}: {
  tone: "good" | "warn" | "bad" | "neutral";
  label: string;
}) {
  const map = {
    good: "bg-emerald-500",
    warn: "bg-amber-500",
    bad: "bg-red-500",
    neutral: "bg-muted-foreground",
  } as const;
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${map[tone]}`} />
      {label}
    </span>
  );
}
