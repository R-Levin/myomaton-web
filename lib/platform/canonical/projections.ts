import type { Pool } from "pg";
import { approval, formatPrice, key, normalizeKnowledge, normalizeOffering, object, text, uuid } from "./model";

export type SourceBinding = { role: "knowledge"; knowledgeId: string; keys: string[] } |
  { role: "offering-overview" | "offering-component" | "offering-pricing"; offeringId: string; componentKey?: string };
export function normalizeBinding(value: unknown): SourceBinding {
  const b = object(value,["role","knowledgeId","keys","offeringId","componentKey"]);
  if (b.role === "knowledge") {
    if (b.offeringId !== undefined || b.componentKey !== undefined || !Array.isArray(b.keys) || !b.keys.length || b.keys.length>30) throw Error("Invalid knowledge binding");
    const keys = b.keys.map(key); if (new Set(keys).size!==keys.length) throw Error("Duplicate binding key");
    return { role: "knowledge", knowledgeId: uuid(b.knowledgeId), keys };
  }
  if (!["offering-overview","offering-component","offering-pricing"].includes(String(b.role)) || b.knowledgeId!==undefined || b.keys!==undefined) throw Error("Invalid source role");
  if (b.role !== "offering-component" && b.componentKey!==undefined) throw Error("Unexpected component key");
  return { role: b.role as "offering-overview" | "offering-component" | "offering-pricing", offeringId: uuid(b.offeringId), ...(b.role === "offering-component" ? { componentKey: key(b.componentKey) } : {}) };
}
type Row = { id: string; web_presence_id: string; payload: unknown; name?: string; status?: string; contract_version: number };
export function projectContent(type: string, content: unknown, binding: SourceBinding, row: Row): Record<string,unknown> | null {
  if (row.contract_version!==1) return null;
  const inline = object(content,["source","contextHeading","contextText"]);
  const context = { ...(inline.contextHeading===undefined ? {} : { heading: text(inline.contextHeading) }), ...(inline.contextText===undefined ? {} : { text: text(inline.contextText,2000,true) }) };
  if (binding.role === "knowledge") {
    if (!["intro","collection"].includes(type)) return null;
    const k = normalizeKnowledge(row.payload); if (k.approval.scope!=="public") return null;
    const entries = binding.keys.map(id => k.entries.find(e=>e.key===id && e.evidence.confirmation==="confirmed" && e.evidence.visibility==="public"));
    if (entries.some(e=>!e)) return null;
    return type==="collection" ? { ...context, itemSource:"inline", items: entries.map(e=>({id:e!.key,heading:e!.value})) }
      : { ...context, text:[context.text,...entries.map(e=>e!.value)].filter(Boolean).join("\n\n") };
  }
  if (row.status!=="active" || approval(object(row.payload,["summary","detail","audiences","outcomes","inclusions","exclusions","actionIds","components","thirdPartyCosts","evidence","approval"]).approval).scope!=="public") return null;
  const o = normalizeOffering(row.payload);
  if (o.evidence.confirmation!=="confirmed" || o.evidence.visibility!=="public") return null;
  if (binding.role==="offering-overview") {
    if (!["hero","intro"].includes(type) || context.heading!==undefined) return null;
    return { heading:row.name,text:[context.text,o.summary,o.detail].filter(Boolean).join("\n\n"), ...(o.actionIds[0] ? {actionId:o.actionIds[0]} : {}) };
  }
  if (binding.role==="offering-component") {
    const c=o.components.find(c=>c.key===binding.componentKey); if (!c || type!=="intro" || context.heading!==undefined) return null;
    return { heading:c.name,text:[context.text,c.summary,...c.inclusions,...c.boundaries,c.timingGuidance,c.commercialRelationship,...c.complexityNotes,formatPrice(c.pricing)].filter(Boolean).join("\n\n") };
  }
  if (type!=="collection") return null;
  const items=o.components.flatMap(c=>{ const price=formatPrice(c.pricing); return price ? [{id:c.key,heading:c.name,text:[price,c.pricing?.note].filter(Boolean).join("\n\n")}] : []; });
  return items.length ? {...context,text:[context.text,...o.thirdPartyCosts].filter(Boolean).join("\n\n"),itemSource:"inline",items} : null;
}
export async function projectCanonicalSections<T extends { type: string; content: unknown }>(pool: Pool, owner: string, sections: T[]): Promise<T[]> {
  const targets=sections.flatMap<{section:T;binding:SourceBinding|null}>(s=>{
    if (!s.content || typeof s.content!=="object" || !Object.hasOwn(s.content,"source")) return [];
    try { return [{section:s,binding:normalizeBinding((s.content as Record<string,unknown>).source)}]; } catch { return [{section:s,binding:null}]; }
  });
  if (!targets.length) return sections;
  const knowledgeIds=targets.flatMap(t=>t.binding?.role==="knowledge" ? [t.binding.knowledgeId] : []);
  const offeringIds=targets.flatMap(t=>t.binding && t.binding.role!=="knowledge" ? [t.binding.offeringId] : []);
  const [knowledge, offerings]=await Promise.all([
    knowledgeIds.length ? pool.query<Row>("SELECT * FROM business_knowledge WHERE web_presence_id=$1 AND id=ANY($2::uuid[])",[uuid(owner),knowledgeIds]) : {rows:[]},
    offeringIds.length ? pool.query<Row>("SELECT * FROM offerings WHERE web_presence_id=$1 AND id=ANY($2::uuid[])",[uuid(owner),offeringIds]) : {rows:[]},
  ]);
  return sections.flatMap(s=>{
    const target=targets.find(t=>t.section===s); if (!target) return [s]; if (!target.binding) return [];
    const b=target.binding, row=(b.role==="knowledge" ? knowledge.rows : offerings.rows).find(r=>r.id===(b.role==="knowledge" ? b.knowledgeId : b.offeringId));
    if (!row) return [];
    try { const content=projectContent(s.type,s.content,b,row); return content ? [{...s,content}] : []; } catch { return []; }
  });
}
