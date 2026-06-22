import { createFileRoute } from "@tanstack/react-router";
import { LogStrengthOrCircuit } from "./log.strength";

export const Route = createFileRoute("/_authenticated/log/circuit")({
  component: () => <LogStrengthOrCircuit kind="cirkel" title="Cirkelpass" />,
});
