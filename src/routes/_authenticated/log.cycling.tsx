import { createFileRoute } from "@tanstack/react-router";
import { LogDistance } from "./log.running";

export const Route = createFileRoute("/_authenticated/log/cycling")({
  component: () => <LogDistance kind="cykling" title="Cykling" />,
});
