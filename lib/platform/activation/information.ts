import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { choice, fingerprint, key, normalizeKnowledge, normalizeOffering, object, text, uuid, type Evidence } from "../canonical/model";
import { inspectCanonical, type CanonicalDomain, type OnboardingOwner, type WriteInput } from "../canonical/writes";
import type { Submission } from "../reviews/model";
import type { Assessment, Authority, Area } from "./model";

export const informationFields = ["audience", "serviceArea", "locations", "offer"] as const;
export type InformationField = typeof informationFields[number];
export type InformationFact = { field: "audience" | "serviceArea" | "locations"; key:string; value:string }
  | { field:"offer"; key:string; type:"service" | "product"; name:string; summary:string; detail:string };
export type InformationSource = { kind:"intake"; field:InformationField; valueDigest:string }
  | { kind:"onboarding"; reference:string; suppliedAt:string }
  | { kind:"canonical"; domain:CanonicalDomain; recordId:string; version:number; fingerprint:string; key?:string };
export type InformationRequest = {
  requestId:string; expectedVersion:number; customer:Omit<OnboardingOwner,"caseId">;
  record:{id:string|null; expectedVersion:number|null; expectedFingerprint:string|null};
  fact:InformationFact; source:InformationSource;
  confirmation:{confirmed:true; reference:string; at:string};
};
export type InformationConfirmation = {
  requestId:string; field:InformationField; key:string; domain:CanonicalDomain; recordId:string;
  previousVersion:number|null; previousFingerprint:string|null; revision:number; revisionFingerprint:string;
  source:InformationSource & { submissionId?:string; submissionDigest?:string; confirmedValueDigest:string };
  confirmation:{by:string; reference:string; at:string};
};
const sha=(v:unknown)=>{if(typeof v!=="string"||!/^[a-f0-9]{64}$/.test(v))throw Error("Exact information digest required");return v;};
const version=(v:unknown)=>{if(!Number.isSafeInteger(v)||Number(v)<1)throw Error("Current information version required");return Number(v);};
const date=(v:unknown)=>{if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}T/.test(v)||!Number.isFinite(Date.parse(v))||Date.parse(v)>Date.now())throw Error("Explicit information confirmation time required");return new Date(v).toISOString();};
export const informationArea=(field:InformationField):Area=>field==="offer"?"offering":field==="audience"?"audience":"service-area";
export const informationKind=(field:Exclude<InformationField,"offer">)=>field==="audience"?"audience":"service-area";

export function informationRequest(value:unknown):InformationRequest {
  const r=object(value,["requestId","expectedVersion","customer","record","fact","source","confirmation"]);
  const customer=object(r.customer,["organizationId","webPresenceId","managedSiteId"]),record=object(r.record,["id","expectedVersion","expectedFingerprint"]);
  const raw=object(r.fact,["field","key","value","type","name","summary","detail"]),field=choice(raw.field,informationFields);
  let fact:InformationFact;
  if(field==="offer"){
    object(raw,["field","key","type","name","summary","detail"]);
    fact={field,key:key(raw.key),type:choice(raw.type,["service","product"]),name:text(raw.name),summary:text(raw.summary,2000),detail:text(raw.detail,10000,true)};
  }else{
    object(raw,["field","key","value"]);fact={field,key:key(raw.key),value:text(raw.value,2000,true)};
  }
  const supplied=object(r.source,["kind","field","valueDigest","reference","suppliedAt","domain","recordId","version","fingerprint","key"]);
  let source:InformationSource;
  if(supplied.kind==="intake"){
    object(supplied,["kind","field","valueDigest"]);source={kind:"intake",field:choice(supplied.field,informationFields),valueDigest:sha(supplied.valueDigest)};
    if(source.field!==field)throw Error("Intake source must match the information field");
  }else if(supplied.kind==="onboarding"){
    object(supplied,["kind","reference","suppliedAt"]);source={kind:"onboarding",reference:text(supplied.reference,160),suppliedAt:date(supplied.suppliedAt)};
  }else if(supplied.kind==="canonical"){
    object(supplied,["kind","domain","recordId","version","fingerprint","key"]);
    source={kind:"canonical",domain:choice(supplied.domain,["knowledge","offering"]),recordId:uuid(supplied.recordId),version:version(supplied.version),fingerprint:sha(supplied.fingerprint),...(supplied.key===undefined?{}:{key:key(supplied.key)})};
    if((field==="offer")!==(source.domain==="offering")||source.domain==="knowledge"&&!source.key||source.domain==="offering"&&source.key!==undefined)throw Error("Canonical source domain/selection mismatch");
  }else throw Error("Only intake, onboarding or canonical information sources are supported; Review analysis is not fact evidence");
  const confirmation=object(r.confirmation,["confirmed","reference","at"]);
  if(confirmation.confirmed!==true)throw Error("Explicit confirmed information required");
  const at=date(confirmation.at);
  if(source.kind==="onboarding"&&Date.parse(source.suppliedAt)>Date.parse(at))throw Error("Confirmation predates supplied information");
  const selected=record.id===null?{id:null,expectedVersion:null,expectedFingerprint:null}:{id:uuid(record.id),expectedVersion:version(record.expectedVersion),expectedFingerprint:sha(record.expectedFingerprint)};
  if(record.id===null&&(record.expectedVersion!==null||record.expectedFingerprint!==null))throw Error("New canonical information requires null creation guards");
  return {requestId:uuid(r.requestId),expectedVersion:version(r.expectedVersion),customer:{organizationId:uuid(customer.organizationId),webPresenceId:uuid(customer.webPresenceId),managedSiteId:uuid(customer.managedSiteId)},record:selected,fact,source,confirmation:{confirmed:true,reference:text(confirmation.reference,160),at}};
}

export async function confirmedInformationSource(c:PoolClient,request:InformationRequest,submission:Submission,owner:string):Promise<InformationConfirmation["source"]> {
  const source=request.source,fact=request.fact;
  if(source.kind==="intake"){
    const value=submission.answers[source.field],provenance=submission.provenance[source.field];
    if(value===undefined||value===""||!provenance||provenance.source!=="prospect-supplied"||fingerprint(value)!==source.valueDigest)throw Error("Immutable intake information source mismatch");
    // This first slice copies exact intake text; edited/new facts use onboarding input.
    if(typeof value!=="string"||(fact.field==="offer"?fact.name!==text(value)||fact.summary!==text(value,2000,true)||fact.detail!==text(value,2000,true):fact.value!==text(value,2000,true)))throw Error("Changed intake information requires an explicit onboarding source");
    if(Date.parse(request.confirmation.at)<Date.parse(submission.submitted_at))throw Error("Confirmation predates immutable intake");
    return {...source,submissionId:submission.id,submissionDigest:submission.digest,confirmedValueDigest:fingerprint(fact)};
  }
  if(source.kind==="canonical"){
    const current=await inspectCanonical(c as unknown as Pool,source.domain,owner,source.recordId);
    if(!current||current.row.version!==source.version||current.fingerprint!==source.fingerprint)throw Error("Current owned canonical source required");
    await informationRevision(c,{domain:source.domain,recordId:source.recordId,revision:source.version,revisionFingerprint:source.fingerprint},owner);
    if(fact.field==="offer"){
      const payload=normalizeOffering(current.row.payload);
      if(payload.evidence.confirmation!=="confirmed"||fact.key!==current.row.key||fact.type!==current.row.type||fact.name!==current.row.name||fact.summary!==payload.summary||fact.detail!==payload.detail)throw Error("Confirmed canonical Offering source differs");
    }else{
      const entry=normalizeKnowledge(current.row.payload).entries.find(e=>e.key===source.key);
      if(!entry||entry.evidence.confirmation!=="confirmed"||entry.kind!==informationKind(fact.field)||entry.value!==fact.value)throw Error("Confirmed canonical Knowledge source differs");
    }
  }
  return {...source,confirmedValueDigest:fingerprint(fact)};
}

export async function prepareInformationWrite(c:PoolClient,caseId:string,request:InformationRequest,actor:Authority,source:InformationConfirmation["source"]):Promise<WriteInput> {
  const domain=request.fact.field==="offer"?"offering":"knowledge",id=request.record.id??randomUUID();
  const current=await inspectCanonical(c as unknown as Pool,domain,request.customer.webPresenceId,id);
  if(request.record.id&&!current)throw Error("Owned canonical information record required");
  if(!request.record.id&&domain==="knowledge"&&(await c.query("SELECT id FROM business_knowledge WHERE web_presence_id=$1",[request.customer.webPresenceId])).rowCount)throw Error("Canonical Knowledge exists; use its current version");
  if(current&&(current.row.version!==request.record.expectedVersion||current.fingerprint!==request.record.expectedFingerprint))throw Error("Stale canonical information revision");
  const confirmation={by:actor.operatorId,reference:request.confirmation.reference,at:request.confirmation.at};
  const evidence:Evidence={sourceKind:source.kind==="intake"?"customer":"operator",sourceReference:JSON.stringify({kind:"onboarding-information/1",caseId,requestId:request.requestId,source,confirmation}),confirmation:"confirmed",visibility:"internal",confirmedBy:actor.operatorId,confirmedAt:confirmation.at};
  const approval={by:actor.operatorId,at:confirmation.at,scope:"internal" as const};
  let payload:unknown,offering:WriteInput["offering"];
  if(request.fact.field==="offer"){
    const fact=request.fact;
    if(current&&(current.row.key!==fact.key||current.row.type!==fact.type||current.row.status!=="inactive"))throw Error("Offering identity/status cannot be retargeted during onboarding");
    payload={...(current?normalizeOffering(current.row.payload):{audiences:[],outcomes:[],inclusions:[],exclusions:[],actionIds:[],components:[],thirdPartyCosts:[]}),summary:fact.summary,detail:fact.detail,evidence,approval};
    offering={key:fact.key,type:fact.type,name:fact.name,status:"inactive"};
  }else{
    const fact=request.fact,previous=current?normalizeKnowledge(current.row.payload):{entries:[],identityEvidence:[],approval};
    const old=previous.entries.find(e=>e.key===fact.key);
    if(old&&old.kind!==informationKind(fact.field))throw Error("Knowledge kind cannot be retargeted");
    const entry={key:fact.key,kind:informationKind(fact.field),value:fact.value,evidence};
    payload={...previous,entries:[...previous.entries.filter(e=>e.key!==fact.key),entry],approval};
  }
  return {domain,id,webPresenceId:request.customer.webPresenceId,expectedVersion:request.record.expectedVersion,expectedFingerprint:request.record.expectedFingerprint,payload,...(offering?{offering}:{}),responsibleIdentity:actor.operatorId,changeReason:`Confirmed ${request.fact.field}; ${confirmation.reference}; case ${caseId}; request ${request.requestId}`};
}

export async function informationRevision(c:PoolClient,link:Pick<InformationConfirmation,"domain"|"recordId"|"revision"|"revisionFingerprint">,owner:string) {
  const table=link.domain==="knowledge"?"business_knowledge_revisions":"offering_revisions",parent=link.domain==="knowledge"?"knowledge_id":"offering_id";
  const row=(await c.query(`SELECT * FROM ${table} WHERE web_presence_id=$1 AND ${parent}=$2 AND revision_version=$3`,[owner,link.recordId,link.revision])).rows[0];
  if(!row||fingerprint(row.snapshot)!==link.revisionFingerprint)throw Error("Confirmed canonical revision linkage mismatch");
  return row;
}

export function confirmedAssessment(previous:Assessment,confirmation:InformationConfirmation):Assessment {
  const area=informationArea(confirmation.field),required:InformationField[]=area==="service-area"?["serviceArea","locations"]:[confirmation.field];
  return previous.map(item=>{
    if(item.area!==area)return structuredClone(item);
    const confirmations=[...(item.confirmations??[]).filter(c=>c.field!==confirmation.field),confirmation];
    const complete=required.every(field=>confirmations.some(c=>c.field===field));
    return {area:item.area,state:complete?"CONFIRMED":"UNCONFIRMED",fields:[...item.fields],confirmations,
      ...(complete?{reference:confirmation.confirmation.reference,confirmedBy:confirmation.confirmation.by,confirmedAt:confirmation.confirmation.at}:{})};
  });
}
