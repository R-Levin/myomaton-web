import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {fingerprint} from "../canonical/model";
import type {OriginalMaterial} from "./presence-source-material";

const hash=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
export const c0ExistingWorkSources=[
 {path:"scripts/customer-previews/miopages-c0-accepted.json",sha256:"d21790402f63ce7096429708225e7a8609516c0aa22648f3ad1ca80879232530"},
 {path:"scripts/customer-previews/miopages-editorial-r3.json",sha256:"0163b59c7e5d3bc866439bd266679c50d09c7011a4e43ea224138cd43510281d"},
] as const;

/** Existing customer-owned source projection, not a generated replacement site.
 * Inputs are exact retained records; no runtime/database/provider IO or authority change.
 * The complete business snapshot and every Page/Section remain available for comparison,
 * with inactive history and development annotations distinguished from current facts. */
export function prepareC0ExistingWork(acceptedBytes:Buffer,editorialBytes:Buffer){
 assert.equal(hash(acceptedBytes),c0ExistingWorkSources[0].sha256,"Exact accepted complete-site record required");
 assert.equal(hash(editorialBytes),c0ExistingWorkSources[1].sha256,"Actual reviewed editorial content required, not its handoff documentation");
 const accepted=JSON.parse(acceptedBytes.toString("utf8")) as typeof import("../../../scripts/customer-previews/miopages-c0-accepted.json");
 const editorial=JSON.parse(editorialBytes.toString("utf8")) as typeof import("../../../scripts/customer-previews/miopages-editorial-r3.json");
 assert.equal(accepted.authority.editorialSha256,editorial.sha256);
 assert.ok(accepted.business.knowledge.entries.length&&accepted.business.offering&&accepted.pages.length&&editorial.pages.length);
 assert.ok(editorial.pages.every(page=>!editorial.developmentNotes.some(note=>JSON.stringify(page).includes(note))));
 const value={
  version:1,
  sourceFiles:c0ExistingWorkSources.map((source,index)=>({...source,bytes:[acceptedBytes,editorialBytes][index].length})),
  historicalStageAuthority:accepted.authority,
  businessSnapshot:accepted.business,
  acceptedSite:{pages:accepted.pages,actions:accepted.actions,navigation:accepted.navigation},
  earlierReviewedEditorial:{authority:editorial.authority,sha256:editorial.sha256,pages:editorial.pages},
 };
 const bytes=Buffer.from(JSON.stringify(value)+"\n");
 const source:OriginalMaterial={id:"c0-complete-owned-site-and-knowledge",sha256:hash(bytes),bytes:bytes.length,mime:"text/plain",
  reference:"Exact accepted C0 site/business snapshot and R3 public-copy projection; sourceFiles bind original records",
  author:"Owner-reviewed MioPages records; historical stage authority retained",date:"2026-11-19",status:"historical",purpose:"editorial-reference",
  operations:["research","report","direction","blueprint","page","editorial"]};
 return {bytes,source,coverage:{
  acceptedPages:accepted.pages.length,activePages:accepted.pages.filter(page=>page.status==="active").length,
  retainedHistoricalPages:accepted.pages.filter(page=>page.status!=="active").length,
  acceptedSections:accepted.pages.reduce((n,page)=>n+page.sections.length,0),earlierReviewedPages:editorial.pages.length,
  businessKnowledgeEntries:accepted.business.knowledge.entries.length,offeringRetained:true,
  contentDigest:fingerprint(value),excludedDevelopmentNotes:editorial.developmentNotes.length,
 }};
}

