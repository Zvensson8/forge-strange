import { Link, useLocation } from "@tanstack/react-router";
import { Home, Plus, Calendar, Trophy, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", label: "Hem", icon: Home },
  { to: "/history", label: "Historik", icon: Calendar },
  { to: "/log/strength", label: "Logga", icon: Plus, primary: true },
  { to: "/achievements", label: "Märken", icon: Trophy },
  { to: "/settings", label: "Profil", icon: SettingsIcon },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-xl items-stretch justify-around">
        {items.map((it) => {
          const Icon = it.icon;
          const active = pathname.startsWith(it.to.split("/").slice(0, 2).join("/"));
          if (it.primary) {
            return (
              <Link
                key={it.to}
                to={it.to}
                className="-mt-5 flex flex-col items-center"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full forge-gradient text-primary-foreground ember-glow">
                  <Icon className="h-7 w-7" strokeWidth={2.5} />
                </span>
                <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">{it.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
