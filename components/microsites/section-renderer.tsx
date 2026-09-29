import Image from "next/image";
import type { MicrositeSection } from "@/lib/platform/microsites/service";
import { normalizeDestination } from "../../lib/platform/actions/model";

function textField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
}

export function SectionRenderer({ section }: { section: MicrositeSection }) {
  if (!["hero", "intro", "cta"].includes(section.type)) return null;

  const heading = textField(section.content, "heading");
  const text = textField(section.content, "text");
  const action = section.action;
  const actionHref = action ? normalizeDestination(action.type, action.destination) : null;
  const Heading = section.type === "hero" ? "h1" : "h2";

  return (
    <section
      id={textField(section.configuration, "anchor")}
      className={`microsite-section microsite-section-${section.type}`}
    >
      {heading && <Heading>{heading}</Heading>}
      {text && <p>{text}</p>}
      {section.type === "intro" && section.image && (
        <Image className="microsite-photo" src={section.image.src} alt={section.image.alt}
          width={section.image.width} height={section.image.height} unoptimized />
      )}
      {section.type === "cta" && action && actionHref && (
        <a href={actionHref} className="microsite-action">{action.label}</a>
      )}
    </section>
  );
}
