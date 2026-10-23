import { routingMode } from "./lib/platform/managed-sites/hostname";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") routingMode();
}
