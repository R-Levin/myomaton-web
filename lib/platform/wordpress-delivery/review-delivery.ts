import { verifyNativeDraftReceipt, type NativeDraftReceiptExpectation } from "./native-draft-receipt";

/**
 * Core's side of the plugin's web endpoint (owner decision, Nov 22: Core reaches
 * WordPress over HTTPS, never by shell access). Core sends one signed package and
 * accepts the result only when WordPress's signed receipt matches what Core sent.
 * Runs on the Core server; nothing passes through a developer's computer.
 */
export type WordPressTarget = {
  /** The site's origin, e.g. https://miopages.org. HTTPS except for a loopback test site. */
  origin: string;
  /** The hosting password gate in front of a development site, if any. */
  gate?: { user: string; password: string };
};

export function draftEndpoint(target: WordPressTarget) {
  const url = new URL(target.origin);
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(loopback && url.protocol === "http:")) || url.pathname !== "/" || url.search || url.hash ||
      url.username || url.password) throw Error("WordPress origin refused");
  // rest_route works whether or not the site uses pretty permalinks.
  return new URL("/?rest_route=/miopages/v1/draft", url);
}

export async function sendSignedDraft(target: WordPressTarget, envelope: unknown, receiptSecret: Buffer,
  expected: NativeDraftReceiptExpectation, fetcher: typeof fetch = fetch, timeoutMs = 60_000) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (target.gate) {
    if (!target.gate.user || target.gate.user.includes(":") || !target.gate.password) throw Error("Site gate login refused");
    headers.Authorization = "Basic " + Buffer.from(target.gate.user + ":" + target.gate.password, "utf8").toString("base64");
  }
  const response = await fetcher(draftEndpoint(target), { method: "POST", headers, body: JSON.stringify(envelope),
    redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  if (response.status !== 200) {
    // The site never returns detail; the status says which side to look at.
    throw Error(response.status === 401 ? "WordPress site gate refused Core's login"
      : response.status === 503 ? "WordPress delivery endpoint not configured"
      : response.status === 404 ? "WordPress delivery endpoint not installed"
      : `WordPress refused the draft (HTTP ${response.status})`);
  }
  if (text.length > 2_000_000) throw Error("WordPress receipt too large");
  return verifyNativeDraftReceipt(JSON.parse(text), receiptSecret, expected);
}
