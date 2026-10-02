// Asset defaults describe the reusable thing; configuration.image describes this
// particular usage. Reject malformed accessibility fields, not the Section text.
export function resolveUsageAlt(defaultAlt: unknown, configuration: unknown): string | null {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) return null;
  const config = configuration as Record<string, unknown>;
  if (!Object.hasOwn(config, "image")) return typeof defaultAlt === "string" ? defaultAlt : null;
  if (!config.image || typeof config.image !== "object" || Array.isArray(config.image)) return null;
  const image = config.image as Record<string, unknown>;
  if (Object.hasOwn(image, "decorative") && typeof image.decorative !== "boolean") return null;
  // Decorative intent dominates even a stale or malformed alt override.
  if (image.decorative === true) return "";
  if (Object.hasOwn(image, "altText")) {
    if (typeof image.altText !== "string" || !image.altText.trim()
      || image.altText.length > 2000 || /[\u0000-\u001f\u007f-\u009f]/.test(image.altText)) return null;
    return image.altText.trim();
  }
  // An explicitly informative usage must not silently become decorative.
  if (typeof defaultAlt !== "string" || (image.decorative === false && !defaultAlt.trim())) return null;
  return defaultAlt;
}
