import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        toast.success("Konto skapat – välkommen till smedjan!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Något gick fel");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-ember)" }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl forge-gradient ember-glow">
            <Flame className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">The Forge</h1>
          <p className="mt-1 text-sm text-muted-foreground">Smid din träning – en dag i taget.</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-deep">
          {mode === "up" && (
            <div>
              <Label htmlFor="name">Namn</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ditt namn" className="mt-1.5" />
            </div>
          )}
          <div>
            <Label htmlFor="email">E-post</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="password">Lösenord</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <Button type="submit" disabled={loading} className="h-12 w-full forge-gradient text-base font-semibold text-primary-foreground hover:opacity-90">
            {loading ? "Laddar…" : mode === "in" ? "Logga in" : "Skapa konto"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "in" ? "Inget konto? Skapa ett" : "Har du redan ett konto? Logga in"}
          </button>
        </form>
      </div>
    </div>
  );
}
