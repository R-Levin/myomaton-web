import type { ContentSectionProps, HeroProps } from "@/types/editor";
import styles from "./blocks.module.css";

function safeCtaUrl(value?: string) {
  const url = value?.trim();
  if (!url) return undefined;
  try {
    const parsed = new URL(url, "https://myomaton.com");
    return ["http:", "https:", "mailto:"].includes(parsed.protocol)
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

export function Hero({
  eyebrow,
  heading,
  supportingText,
  ctaLabel,
  ctaUrl,
  alignment,
  isEditing = false,
}: HeroProps & { isEditing?: boolean }) {
  const href = safeCtaUrl(ctaUrl);

  return (
    <section className={styles.hero} data-alignment={alignment}>
      <div className={styles.heroContent}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.heroHeading}>{heading}</h1>
        {supportingText && <p className={styles.supportingText}>{supportingText}</p>}
        {ctaLabel?.trim() && href && (
          <a
            className={styles.cta}
            href={href}
            onClick={isEditing ? (event) => event.preventDefault() : undefined}
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </section>
  );
}

export function ContentSection({ heading, body, width }: ContentSectionProps) {
  return (
    <section className={styles.contentSection}>
      <div className={styles.contentInner} data-width={width}>
        <h2 className={styles.sectionHeading}>{heading}</h2>
        {body && <p className={styles.body}>{body}</p>}
      </div>
    </section>
  );
}
