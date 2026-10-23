import assert from "node:assert/strict";
import { mkdtemp, writeFile, unlink, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
import { Pool } from "pg";
import { native } from "./core";

// No installed service, shared port, shared database or repository binary changes.
export async function disposableCluster(bin: string) {
  const root = await mkdtemp(path.join(tmpdir(), "miopages-managed-cluster-")), data = path.join(root, "data");
  const password = randomBytes(32).toString("hex"), file = path.join(root, "password.tmp"), database = "migration_rehearsal_" + randomUUID().replaceAll("-", "");
  const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening"); const port = (reservation.address() as { port: number }).port;
  await new Promise<void>(resolve => reservation.close(() => resolve())); assert.notEqual(port, 5432);
  const base = new URL(`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`); let started = false;
  const stop = async () => {
    if (started) { await native(bin, "pg_ctl", ["--pgdata=" + data, "--mode=fast", "--wait", "stop"]); started = false; }
    assert.equal(path.dirname(root), path.resolve(tmpdir())); assert.equal(await realpath(root), root); assert.match(path.basename(root), /^miopages-managed-cluster-/); await rm(root, { recursive: true });
  };
  try {
    await writeFile(file, password + "\n", { mode: 0o600, flag: "wx" });
    await native(bin, "initdb", ["--pgdata=" + data, "--username=postgres", "--encoding=UTF8", "--locale=C", "--auth=scram-sha-256", "--pwfile=" + file]); await unlink(file);
    await native(bin, "pg_ctl", ["--pgdata=" + data, "--log=" + path.join(root, "server.log"), "--options=" + `-h 127.0.0.1 -p ${port}`, "--wait", "start"]); started = true;
    const admin = new Pool({ connectionString: base.toString() }); try { await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`); } finally { await admin.end(); }
    base.pathname = "/" + database;
    return { root, bin, url: base.toString(), stop };
  } catch (error) { await stop(); throw error; }
}
