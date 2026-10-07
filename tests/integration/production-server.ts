import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { setTimeout } from "node:timers/promises";

export async function startProductionFixture(databaseUrl: string, schema: string, root: string,
  selection: {webPresenceId:string;managedSiteId:string}) {
  const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  if (!/^(?:myomaton_(?:asset_test|rename_test|contact_test|visual_test)|canonical_test)_[a-f0-9]{32}(?:_\w+)?$/.test(schema)) throw new Error("Disposable schema required");
  const url = new URL(databaseUrl); url.searchParams.set("options", `-c search_path=${schema} -c default_transaction_read_only=on`);
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, DATABASE_URL: url.toString(), MANAGED_ASSET_ROOT: root, WEB_PRESENCE_ID: selection.webPresenceId, MANAGED_SITE_ID: selection.managedSiteId }, windowsHide: true, stdio: "ignore",
  });
  const base = `http://127.0.0.1:${port}`;
  const stop = async () => { if (child.exitCode === null) { const done = once(child, "exit"); child.kill(); await done; } };
  try {
    for (let i = 0; i < 150; i++) {
      if (child.exitCode !== null) throw new Error("Production fixture server exited.");
      try {
        const response = await fetch(`${base}/media/assets/invalid`, { signal: AbortSignal.timeout(1000) });
        if (response.status === 404) return { base, stop, processId: child.pid };
      } catch { /* Wait for startup only; no real content is requested. */ }
      await setTimeout(200);
    }
    throw new Error("Production fixture server did not become ready.");
  } catch (error) { await stop(); throw error; }
}
