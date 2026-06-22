import { createFileRoute } from "@tanstack/react-router";
import { LogDistance } from "./log.running";

export const Route = createFileRoute("/_authenticated/log/walking")({
  component: () => <LogDistance kind="promenad" title="Promenad" />,
});
