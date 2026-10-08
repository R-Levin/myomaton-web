import type { CSSProperties } from "react";
import { resolveDesignConfiguration } from "../design-systems/configuration";
import { exact, record } from "./content";
import { surfaces } from "./plan";
export function luminance(hex: string) { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; }
export function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
function safe(preferred: string, background: string) { return contrast(preferred, background) >= 4.5 ? preferred : luminance(background) > .179 ? "#000000" : "#ffffff"; }
export type Palette = Record<typeof surfaces[number], { background: string; text: string }> & { border: string; muted: string };
export function validatePalette(value: unknown): Palette {
  const p = exact(value, ["version", ...surfaces, "border", "muted"]); if (p.version !== 1) throw Error("Unsupported palette version");
  const hex = (v: unknown) => { if (typeof v !== "string" || !/^#[0-9a-f]{6}$/i.test(v)) throw Error("Approved palette hex required"); return v; };
  const pairs = Object.fromEntries(surfaces.map(role => { const pair = exact(p[role], ["background", "text"]); const background = hex(pair.background), text = hex(pair.text); if (contrast(background, text) < 4.5) throw Error("Unsafe palette pair"); return [role, { background, text }]; })) as Omit<Palette, "border" | "muted">;
  const muted = hex(p.muted); if (contrast(muted, pairs.light.background) < 4.5) throw Error("Unsafe muted text");
  return { ...pairs, border: hex(p.border), muted };
}
export function presentationTokens(configuration: unknown): CSSProperties {
  const d = resolveDesignConfiguration(configuration), c = d.colors;
  let palette: Palette;
  try { palette = validatePalette(record(configuration).palette); }
  catch { palette = { light: { background: c.background, text: safe(c.text, c.background) }, strong: { background: c.surface, text: safe(c.text, c.surface) }, tonal: { background: c.surface, text: safe(c.text, c.surface) }, brand: { background: c.accent, text: safe(c.onAccent, c.accent) }, supporting: { background: c.secondaryAccent ?? c.accent, text: safe(c.onSecondaryAccent ?? c.onAccent, c.secondaryAccent ?? c.accent) }, contrast: { background: c.text, text: safe(c.background, c.text) }, border: c.border, muted: safe(c.muted, c.background) }; }
  const tokens: Record<string, string> = {};
  for (const role of surfaces) { tokens[`--p-${role}`] = palette[role].background; tokens[`--p-on-${role}`] = palette[role].text; }
  tokens["--p-link"] = safe(c.accent, palette.light.background); tokens["--p-border"] = palette.border; tokens["--p-muted"] = palette.muted;
  tokens["--p-unit"] = `${d.spacing.unit}px`; tokens["--p-radius"] = `${Math.min(d.shape.radius, 12)}px`; tokens["--p-body"] = `${d.typography.baseSize}px`;
  tokens["--p-font"] = 'var(--font-geist-sans), system-ui, sans-serif';
  return tokens as CSSProperties;
}
