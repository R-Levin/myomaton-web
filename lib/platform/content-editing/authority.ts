import { fingerprint, text, uuid } from "../canonical/model";
import { record, relationship } from "../presentation/content";
import { normalizeSection } from "../managed-sites/sections";
export type Scope={webPresenceId:string;managedSiteId:string};
export type SectionContext={scope:Scope;pageId:string;sectionId:string;version:number;type:string;variant:string;content:unknown;configuration:unknown;metadata:unknown;projectedContent:unknown;canonicalSources:{id:string;version:number;fingerprint:string;payload:unknown}[]};
export type TextField={id:string;path:string;value:string;sourceType:"canonical"|"page-editorial"|"derived-system";owner:string;directlyEditable:boolean;requiresCanonicalReconciliation:boolean;constraints:{maxLength:number;plainText:true};revision:{sectionVersion:number;sourceFingerprint:string};provenance:unknown};
export function contextFingerprint(c:SectionContext){return fingerprint(c);}
function textualPaths(content:unknown):{path:string;value:string;max:number}[]{
 const rows:{path:string;value:string;max:number}[]=[];
 const visit=(v:unknown,path:string)=>{if(Array.isArray(v)){v.forEach((x,i)=>visit(x,`${path}/${i}`));return;}if(!v||typeof v!=="object")return;
  for(const [key,x]of Object.entries(v)){const p=`${path}/${key}`;if(["heading","text","eyebrow","label","contextHeading","contextText"].includes(key)&&typeof x==="string")rows.push({path:p,value:x,max:key.includes("Text")||key==="text"?2000:key==="eyebrow"?100:300});
   else if(["items","valuePoints","extensions","parties","rows","cells"].includes(key))visit(x,p);}
 };visit(content,"");return rows;
}
export function describeTextFields(c:SectionContext):TextField[]{
 uuid(c.scope.webPresenceId);uuid(c.scope.managedSiteId);uuid(c.pageId);uuid(c.sectionId);
 const raw=record(c.content),bound=Boolean(raw.source),context=contextFingerprint(c),binding=record(raw.source);
 const rawFields=textualPaths(raw),projected=bound?textualPaths(c.projectedContent).filter(f=>!(f.path==="/heading"&&raw.contextHeading!==undefined)):[];
 const projection=record(c.projectedContent);
 const scopeLabel=(path:string)=>{const match=path.match(/^\/items\/(\d+)\/heading$/);const item=match&&Array.isArray(projection.items)?record(projection.items[Number(match[1])]):{};return ["included","boundaries"].includes(String(item.id));};
 return [...rawFields.map(f=>({...f,kind:"page-editorial" as const})),...projected.map(f=>({...f,kind:((scopeLabel(f.path)&&record(raw.source).role==="offering-relationship")||(record(raw.source).role==="offering-commercial-structure"&&/\/text$/.test(f.path))?"derived-system":"canonical") as "canonical"|"derived-system"}))].map(f=>({
  id:`section:${c.sectionId}:${f.path}`,path:f.path,value:f.value,sourceType:f.kind,owner:f.kind==="page-editorial"?`page:${c.pageId}/section:${c.sectionId}`:f.kind==="canonical"?`canonical:${binding.role==="knowledge"?binding.knowledgeId:binding.offeringId}`:"system:canonical-projection",
  directlyEditable:f.kind==="page-editorial",requiresCanonicalReconciliation:f.kind!=="derived-system",constraints:{maxLength:f.path.includes("/valuePoints/")?(f.path.endsWith("/heading")?100:300):c.type==="relationship"&&!bound?(f.path==="/heading"?200:f.path.endsWith("/heading")?160:f.path.includes("/parties/")?100:f.path.endsWith("/label")?120:f.max):f.max,plainText:true},revision:{sectionVersion:c.version,sourceFingerprint:context},provenance:{metadata:c.metadata,binding:raw.source??null,sources:c.canonicalSources.map(({payload,...s})=>{void payload;return s;})}
 }));
}
export type EditorialDraft={contractVersion:1;scope:Scope;sectionId:string;baseFingerprint:string;baseVersion:number;sourceContext:SectionContext;workingContent:unknown;configuration:unknown;reviewStatus:"pending-review";published:false;edits:{fieldId:string;owner:string;previousValue:string;newValue:string;actor:string;reason:string;at:string;sequence:number;reconciliation:"pending-assessment";proofreading:"not-run"}[]};
export function createEditorialDraft(c:SectionContext):EditorialDraft{
 return {contractVersion:1,scope:{...c.scope},sectionId:c.sectionId,baseFingerprint:contextFingerprint(c),baseVersion:c.version,sourceContext:structuredClone(c),workingContent:structuredClone(c.content),configuration:structuredClone(c.configuration),reviewStatus:"pending-review",published:false,edits:[]};
}
export function editEditorialDraft(c:SectionContext,draft:EditorialDraft,input:{scope:Scope;fieldId:string;value:string;actor:string;reason:string;expectedSequence:number;at:string}):EditorialDraft{
 if(fingerprint(input.scope)!==fingerprint(c.scope)||fingerprint(draft.scope)!==fingerprint(c.scope)||draft.sectionId!==c.sectionId)throw Error("Foreign draft scope");
 if(draft.baseFingerprint!==contextFingerprint(c)||draft.baseVersion!==c.version||draft.edits.length!==input.expectedSequence)throw Error("Stale draft context");
 if(draft.edits.length>=100||fingerprint(draft.sourceContext)!==contextFingerprint(c))throw Error("Invalid draft provenance");
 if(fingerprint(draft.configuration)!==fingerprint(c.configuration)||draft.published!==false||draft.reviewStatus!=="pending-review"||draft.contractVersion!==1)throw Error("Invalid draft envelope");
 const field=describeTextFields(c).find(f=>f.id===input.fieldId);if(!field||!field.directlyEditable)throw Error("Direct override refused; use canonical reconciliation or system contract");
 const fields=describeTextFields(c),replayed=structuredClone(c.content) as Record<string,unknown>;
 for(const [index,edit]of draft.edits.entries()) {
  const priorField=fields.find(f=>f.id===edit.fieldId);if(!priorField?.directlyEditable||edit.owner!==priorField.owner||edit.sequence!==index+1||edit.reconciliation!=="pending-assessment"||edit.proofreading!=="not-run")throw Error("Invalid draft journal");
  const keys=priorField.path.slice(1).split("/");let container=replayed;
  for(const key of keys.slice(0,-1))container=container[key] as Record<string,unknown>;
  if(container[keys.at(-1)!]!==edit.previousValue)throw Error("Draft journal conflict");
  container[keys.at(-1)!]=text(edit.newValue,priorField.constraints.maxLength,true);
 }
 if(fingerprint(replayed)!==fingerprint(draft.workingContent))throw Error("Unjournaled draft change");
 const value=text(input.value,field.constraints.maxLength,true),actor=text(input.actor),reason=text(input.reason,1000);
 if(!Number.isFinite(Date.parse(input.at)))throw Error("Invalid edit date");
 const result=structuredClone(draft),parts=field.path.slice(1).split("/");let target=result.workingContent as Record<string,unknown>;
 for(const part of parts.slice(0,-1))target=target[part] as Record<string,unknown>;
 const previous=target[parts.at(-1)!];if(typeof previous!=="string")throw Error("Invalid working field");target[parts.at(-1)!]=value;
 // Validate the same typed Section/relationship contract; no second content model.
 if(!record(c.content).source&&!normalizeSection({type:c.type,variant:c.variant,content:result.workingContent,configuration:c.configuration}))throw Error("Invalid draft Section");
 if(c.type==="relationship"&&!record(c.content).source)relationship(result.workingContent);
 result.edits.push({fieldId:field.id,owner:field.owner,previousValue:previous,newValue:value,actor,reason,at:new Date(input.at).toISOString(),sequence:result.edits.length+1,reconciliation:"pending-assessment",proofreading:"not-run"});return result;
}
