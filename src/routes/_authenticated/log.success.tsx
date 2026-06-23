import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getWorkoutCelebration } from "@/lib/workout.functions";
import { LogSuccessScreen } from "@/components/forge/LogSuccess";

export const Route = createFileRoute("/_authenticated/log/success")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ id: z.string().uuid(), leveled_up: z.coerce.boolean().optional() }).parse(s),
  component: LogSuccess,
});

function LogSuccess() {
  const navigate = useNavigate();
  const { id, leveled_up } = Route.useSearch();
  const fn = useServerFn(getWorkoutCelebration);
  const q = useQuery({ queryKey: ["celebration", id], queryFn: () => fn({ data: { workout_id: id } }) });

  if (q.isLoading || !q.data) {
    return <div className="py-20 text-center text-muted-foreground">Smeden räknar dina segrar…</div>;
  }
  const data = { ...q.data, leveled_up: Boolean(leveled_up) };
  return <LogSuccessScreen data={data} onClose={() => navigate({ to: "/dashboard" })} />;
}
