import "server-only";
import { cookies, headers } from "next/headers";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { readOperatorSiteConfig } from "../wordpress-delivery/operator-review";
import type { Person } from "../change/model";
import { aiRunSpent, aiRunWriter, type AiRun, approvedRateCard } from "./ai-run";
import { beaconWriter } from "./beacon-writer";
import type { Writer } from "./cycle";
import { ServiceStore } from "./store";

/**
 * What the workspace and portal run on. Until sign-in on protected Core is connected
 * (milestone 4), they run only in a local preview: on this computer, outside production, against
 * the preview's own throwaway database. Anywhere else they do not exist.
 */
let pool: Pool | undefined;
let writer: Promise<Writer> | undefined;

export async function serviceRuntime() {
  const host = (await headers()).get("host") ?? "";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/u.test(host);
  if (process.env.NODE_ENV === "production" || process.env.MIOPAGES_WORKSPACE !== "local-preview" || !local || !process.env.SERVICE_DATABASE_URL) return null;
  pool ??= new Pool({ connectionString: process.env.SERVICE_DATABASE_URL, max: 4 });
  // The preview's own throwaway WordPress, enrolled like any review site; its keys stay on the server.
  const wordpressFile = process.env.MIOPAGES_PREVIEW_WORDPRESS;
  const wordpress = wordpressFile ? async () => readOperatorSiteConfig(JSON.parse(await readFile(wordpressFile, "utf8"))) : null;
  // Core's real AI, only for a run the Principal approved (milestone 3): its name, folder and cap come from the preview.
  const ai = aiRun();
  if (ai) {
    const [first] = await accounts(pool);
    if (!first || !process.env.OPENAI_API_KEY) throw Error("The approved AI run needs its Account and the AI key");
    writer ??= aiRunWriter(ai, first.account, process.env.OPENAI_API_KEY);
    return { pool, store: new ServiceStore(pool), writer: await writer, writerLabel: `Core's real AI (approved run, capped at $${ai.capMicros / 1_000_000})`,
      spent: () => aiRunSpent(ai), wordpress };
  }
  return { pool, store: new ServiceStore(pool), writer: beaconWriter as Writer, writerLabel: "Beacon (stand-in for Core's AI)", spent: null, wordpress };
}

/** The approved AI run the preview was started with, if any. */
function aiRun(): AiRun | null {
  const { MIOPAGES_PREVIEW_AI_RUN: name, MIOPAGES_PREVIEW_AI_DIR: directory, MIOPAGES_PREVIEW_AI_CAP: cap } = process.env;
  if (!name || !directory || !cap) return null;
  // The rate card the Principal approved for C0 on Nov 19.
  return { name, directory, capMicros: Number(cap), rates: approvedRateCard };
}

/** Who is acting, as chosen on the local preview's sign-in. Every action checks it again. */
export type Acting = Person & { name: string };
const cookieName = "miopages-preview-person";

export async function acting(): Promise<Acting | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;
  try {
    const person = JSON.parse(value) as Acting;
    return ["operator", "customer"].includes(person.role) && typeof person.id === "string" && typeof person.name === "string" ? person : null;
  } catch { return null; }
}
export async function actAs(person: Acting | null) {
  const jar = await cookies();
  if (person) jar.set(cookieName, JSON.stringify(person), { httpOnly: true, sameSite: "strict", path: "/" });
  else jar.delete(cookieName);
}

/** The Accounts Core serves: each Web Presence and its site. */
export async function accounts(db: Pool) {
  const { rows } = await db.query(`SELECT w.id AS web_presence_id, w.name, m.id AS managed_site_id FROM web_presences w
    JOIN managed_sites m ON m.web_presence_id=w.id ORDER BY w.name`);
  return rows.map(row => ({ name: String(row.name), account: { webPresenceId: String(row.web_presence_id), managedSiteId: String(row.managed_site_id) } }));
}
