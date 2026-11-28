import type { ContentItem, SitePage } from "@/lib/platform/site/components";
import type { ReactNode } from "react";
import type { ProductVersion } from "@/lib/platform/service/cycle";

/** Shared, plain building blocks for the workspace and the portal. */
export function Frame({ title, who, children }: { title: string; who?: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 text-[15px] leading-relaxed text-neutral-900">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 pb-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {who && <p className="text-sm text-neutral-600">{who}</p>}
      </header>
      {children}
    </main>
  );
}

export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-lg font-semibold">{title}</h2>
      {note && <p className="mb-3 text-sm text-neutral-600">{note}</p>}
      {children}
    </section>
  );
}

export const button = "rounded border border-neutral-400 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-100";
export const primary = "rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700";
export const field = "w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";

const kindName = { report: "Business Understanding Report", direction: "Presence Direction", "site-plan": "Site plan", page: "Page" } as const;
export const productName = (item: Pick<ProductVersion, "kind" | "path">) => item.kind === "page" ? `Page ${item.path}` : kindName[item.kind];

/** A Work product's content, readable in full. */
export function Content({ item }: { item: ProductVersion }) {
  const value = item.content as Record<string, unknown>;
  if (item.kind === "report") {
    const report = value as { title: string; summary: string; findings: { id: string; heading: string; body: string; status: string }[] };
    return (<div><p className="font-medium">{report.title}</p><p className="mb-2">{report.summary}</p>
      <ul className="space-y-2">{report.findings.map(finding => (<li key={finding.id}><span className="font-medium">{finding.heading}</span>
        {finding.status !== "established" && <span className="ml-2 text-xs uppercase text-amber-700">{finding.status}</span>}<br />{finding.body}</li>))}</ul></div>);
  }
  if (item.kind === "direction") {
    const direction = value as { positioning: string; approach: string; visitorDecisions: string[] };
    return (<div><p><span className="font-medium">Positioning: </span>{direction.positioning}</p><p><span className="font-medium">Approach: </span>{direction.approach}</p>
      <p className="font-medium">What a visitor decides</p><ol className="list-decimal pl-6">{direction.visitorDecisions.map(step => <li key={step}>{step}</li>)}</ol></div>);
  }
  if (item.kind === "site-plan") {
    const plan = value as { pages: { path: string; label: string; purpose: string; inMenu: boolean }[];
      footer?: { columns: { heading: string | null; text: string | null; links: string[] }[]; note: string | null } };
    const label = (path: string) => plan.pages.find(page => page.path === path)?.label ?? path;
    return (<div className="space-y-3"><ul className="space-y-1">{plan.pages.map(page => (<li key={page.path}><span className="font-medium">{page.label}</span> ({page.path}
      {page.inMenu ? ", in the Menu" : ", linked from other pages"}): {page.purpose}</li>))}</ul>
      {plan.footer && <div><p className="font-medium">Footer, on every page</p>
        <ul className="space-y-1 pl-4">{plan.footer.columns.map((column, index) => (<li key={index}>
          {column.heading && <span className="font-medium">{column.heading}: </span>}
          {column.text && <span className="whitespace-pre-line">{column.text} </span>}
          {column.links.length > 0 && <span>Links: {column.links.map(label).join(", ")}</span>}</li>))}</ul>
        {plan.footer.note && <p className="pl-4 text-sm">{plan.footer.note}</p>}</div>}</div>);
  }
  // A page: its layout (sections, with the component and band each uses) and the content laid into it.
  const page = value as SitePage;
  if (!Array.isArray(page.layout)) return <p className="text-sm text-neutral-600">A page in the earlier format (before Nov 29).</p>;
  const byId = new Map(page.content.map(item => [item.id, item]));
  const shown = (item: ContentItem) => item.type === "heading" || item.type === "text" ? item.text : item.type === "item" ? `${item.title}: ${item.text}`
    : item.type === "question" ? `${item.question} ${item.answer}` : item.type === "picture" ? `Picture: ${item.shows}` : item.type === "action" ? `Button: ${item.label} → ${item.page}`
    : `Content needed: ${item.need}. ${item.text}`;
  return (<div><p className="font-medium">{page.title}</p>{page.layout.map(section => (
    <div key={section.id} className="mt-2 border-l-2 border-neutral-200 pl-3">
      <p className="text-xs uppercase text-neutral-500">{section.component}{section.variant ? `, ${section.variant}` : ""} · {section.band}</p>
      {Object.values(section.slots).flat().map(id => byId.get(id)).filter(Boolean).map(item => <p key={item!.id} className={item!.type === "heading" ? "font-medium" : ""}>{shown(item!)}</p>)}
    </div>))}</div>);
}

/** Approve, correct in your own words, or decline a Proposed change. */
export function ReviewForm({ action, approveLabel = "Approve" }: { action: (form: FormData) => Promise<void>; approveLabel?: string }) {
  return (
    <form action={action} className="mt-3 space-y-2">
      <textarea name="words" rows={2} className={field} placeholder="To correct it, say what should change, in your own words" />
      <div className="flex flex-wrap gap-2">
        <button name="response" value="approve" className={primary}>{approveLabel}</button>
        <button name="response" value="correct" className={button}>Correct it</button>
        <button name="response" value="decline" className={button}>Decline</button>
      </div>
    </form>
  );
}
