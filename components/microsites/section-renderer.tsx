import type { MicrositeSection } from "@/lib/platform/microsites/service";

function textField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
}

function safeHref(value: string | undefined): string | undefined {
  if (!value || /[\s\\]/.test(value)) return;
  if (value.startsWith("#") || (value.startsWith("/") && !value.startsWith("//"))) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return value;
  } catch {
    return;
  }
}

export function SectionRenderer({ section }: { section: MicrositeSection }) {
  if (!["hero", "intro", "cta"].includes(section.type)) return null;

  const heading = textField(section.content, "heading");
  const text = textField(section.content, "text");
  const actionLabel = textField(section.content, "actionLabel");
  const actionHref = safeHref(textField(section.content, "actionHref"));
  const Heading = section.type === "hero" ? "h1" : "h2";

  return (
    <section
      id={textField(section.configuration, "anchor")}
      className={`microsite-section microsite-section-${section.type}`}
    >
      {heading && <Heading>{heading}</Heading>}
      {text && <p>{text}</p>}
      {section.type === "cta" && actionLabel && actionHref && (
        <a href={actionHref} className="microsite-action">{actionLabel}</a>
      )}
    </section>
  );
}
