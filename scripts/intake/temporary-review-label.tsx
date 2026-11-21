/** Temporary owner-requested review scaffolding; never saved as customer content. */
export function TemporaryReviewLabel({ title, children }: { title: string; children: React.ReactNode }) {
  return <aside aria-label="Temporary review guide" style={{ padding: "12px 16px", border: "2px solid #35536b",
    borderRadius: 6, background: "#edf4f8", color: "#183445", marginBottom: 16, lineHeight: 1.5 }}>
    <strong>{title}</strong><div>{children}</div>
    <small>Temporary development guide · no customer approval or publication implied</small>
  </aside>;
}
