export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { routingMode } = await import("./lib/platform/managed-sites/hostname");
    routingMode();
  }
}
