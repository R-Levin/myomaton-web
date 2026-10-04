import type { FieldName } from "./model";

export interface ContactDeliveryProvider {
  // Trusted routing resolves routeKey; values are plain body text, never headers.
  // Implementations should deduplicate by submissionId where supported.
  deliverSubmission(input: { submissionId: string; routeKey: string; fields: Partial<Record<FieldName, string>> }): Promise<void>;
}
export interface ContactAbuseGuard { allow(scope: string): Promise<boolean> }
export interface ContactEvents { accepted(event: { name: "form_submit"; submissionId: string; webPresenceId: string; definitionId: string }): Promise<void> }

// Fixed-window, bounded-memory development guard. No IP/fingerprint storage.
// Production activation requires an injected distributed guard and spam controls.
export function developmentGuard(limit = 10, windowMs = 60_000, now = Date.now): ContactAbuseGuard {
  const windows = new Map<string, { start: number; count: number }>();
  return { async allow(scope) {
    const time = now();
    for (const [key, v] of windows) if (time - v.start >= windowMs) windows.delete(key);
    if (!windows.has(scope)) { if (windows.size >= 1000) return false; windows.set(scope, { start: time, count: 0 }); }
    return ++windows.get(scope)!.count <= limit;
  } };
}
