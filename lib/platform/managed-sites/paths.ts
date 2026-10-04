// Page slugs are root-relative paths, not labels or absolute URLs. Keep this
// contract shared by request lookup and entity-backed Navigation destinations.
export function normalizePagePath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/")) return null;
  if (value === "/") return value;
  const path = value.endsWith("/") ? value.slice(0, -1) : value;
  const segments = path.slice(1).split("/");
  if (segments.some((segment) => !/^[A-Za-z0-9._~-]+$/.test(segment) || segment === "." || segment === "..")) return null;
  // Managed media, Next infrastructure, and the framework's generated error
  // entries own these namespaces (also present in the production route manifest).
  if (["media", "api", "_next", "_not-found", "_global-error"].includes(segments[0])) return null;
  return path;
}

export function canonicalPagePath(value: unknown): string | null {
  const path = normalizePagePath(value);
  // Do not infer aliases from noncanonical database slugs. Exact canonical
  // paths retain the database's (managed_site_id, slug) uniqueness guarantee.
  return path === value ? path : null;
}

export function pagePathFromSegments(segments: unknown): string | null {
  if (segments === undefined) return "/";
  if (!Array.isArray(segments) || segments.length === 0 || segments.some(
    (segment) => typeof segment !== "string" || !segment || segment.includes("/"),
  )) return null;
  // Next already decodes params. Never decode them again or treat an encoded
  // slash within one segment as a path separator.
  return canonicalPagePath(`/${segments.join("/")}`);
}
