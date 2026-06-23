import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboard, updateProfile, clearAllMyData } from "@/lib/workout.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const dashFn = useServerFn(getDashboard);
  const updFn = useServerFn(updateProfile);
  const clearFn = useServerFn(clearAllMyData);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => dashFn() });
  const [name, setName] = useState("");
  const [w, setW] = useState<"kg" | "lb">("kg");
  const [d, setD] = useState<"km" | "mi">("km");

  useEffect(() => {
    if (data?.profile) {
      setName(data.profile.display_name ?? "");
      setW((data.profile.units_weight as any) ?? "kg");
      setD((data.profile.units_distance as any) ?? "km");
    }
  }, [data]);

  async function save() {
    try {
      await updFn({ data: { display_name: name, units_weight: w, units_distance: d } });
      toast.success("Sparat");
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte spara");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Profil</h1>
      </header>
      <Card className="space-y-4 border-border bg-card p-5">
        <div>
          <Label htmlFor="name">Visningsnamn</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vikt</Label>
            <div className="mt-1.5 flex gap-2">
              <UnitBtn active={w === "kg"} onClick={() => setW("kg")}>kg</UnitBtn>
              <UnitBtn active={w === "lb"} onClick={() => setW("lb")}>lb</UnitBtn>
            </div>
          </div>
          <div>
            <Label>Distans</Label>
            <div className="mt-1.5 flex gap-2">
              <UnitBtn active={d === "km"} onClick={() => setD("km")}>km</UnitBtn>
              <UnitBtn active={d === "mi"} onClick={() => setD("mi")}>mi</UnitBtn>
            </div>
          </div>
        </div>
        <Button onClick={save} className="w-full forge-gradient text-primary-foreground hover:opacity-90">
          Spara
        </Button>
      </Card>
      <Card className="space-y-3 border-destructive/40 bg-destructive/5 p-5">
        <div>
          <p className="text-sm font-bold text-destructive">Rensa all träningsdata</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tar bort alla pass, set, löprundor, achievements och nollställer XP, level och streak. Använd t.ex. för att rensa demo-data.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={async () => {
            if (!confirm("Säker? All träningshistorik försvinner permanent.")) return;
            try {
              await clearFn();
              await qc.invalidateQueries();
              toast.success("Rensat – nu kan du börja logga från noll");
            } catch (e: any) {
              toast.error(e.message ?? "Kunde inte rensa");
            }
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Rensa all data
        </Button>
      </Card>
      <Button variant="outline" onClick={signOut} className="w-full">
        Logga ut
      </Button>
    </div>
  );
}

function UnitBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
