// Presentation only: canonical text stays unchanged. React escapes every paragraph.
export function PlainTextParagraphs({ text }: { text: unknown }) {
  if (typeof text !== "string") return null;
  const paragraphs = text.replace(/\r\n?/g, "\n")
    .split(/\n(?:[^\S\n]*\n)+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
  return paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>);
}
