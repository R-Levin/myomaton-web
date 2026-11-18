import {createHash} from "node:crypto";
import {readFile,lstat,realpath} from "node:fs/promises";
import {join} from "node:path";
import plan from "../../docs/c0-original-evidence-run-proposal.json";
import oldSources from "../../docs/c0-generation-p0-22-sources.json";
import {fingerprint} from "../../lib/platform/canonical/model";
import {privateWorkflowFile,privateWorkflowBytes,verifyDirectory} from "../../lib/platform/intake/protected-presence-workflow";
import type {WorkflowContext} from "../../lib/platform/intake/presence-workflow";
import type {PresenceWorkflowGrant} from "../../lib/platform/intake/presence-workflow-provider";
import type {OriginalMaterial} from "../../lib/platform/intake/presence-source-material";
import {validateWorkflowStagePlan,type WorkflowStagePlan} from "../../lib/platform/intake/intelligent-responses";
import {focusMioPagesPreview} from "../customer-previews/miopages-focus";
import {draftBrand} from "../../lib/platform/wordpress-delivery/draft-brand";
export const originalEvidenceApproval="db5eea3ef55b24a4f0c9229b14968f6be4bcc49e1cc902f186961ec985ae2a75";
export const originalEvidenceCandidate={
 organizationId:"0b669145-979a-461c-9a14-e62c6276e6d4",intakeId:"4d437190-9ce3-460b-81af-edd92279271a",
 scope:{webPresenceId:"b94984b1-0bed-4a26-a54f-bb7ff7164147",managedSiteId:"caf2b932-25af-4965-aa18-df599a664c2f"},entry:"DIRECT_START" as const,
};
const hash=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
export async function verifiedOriginalEvidenceRuntime(parent:string,reviewerId:string,reviewerExpiry:number,allowExpired:boolean){
 const root=join(parent,"p0-original-evidence-c0-runtime");await verifyDirectory(root);
 const activation=await privateWorkflowFile<{proposal:string;artifact:string;startsAt:number;approvalRecord:number;capture:"existing-windows-core-stdio"}>(join(root,"activation.json"),root);
 const current=await realpath(process.argv[1]??"");
 const bytes=await readFile("docs/c0-original-evidence-run-proposal.json");
 if(hash(bytes)!==originalEvidenceApproval||activation.proposal!==originalEvidenceApproval||activation.approvalRecord!==6989946707||
  current!==join(root,"worker.cjs")||hash(await readFile(current))!==activation.artifact||activation.capture!=="existing-windows-core-stdio"||
  !Number.isSafeInteger(activation.startsAt)||activation.startsAt>Date.now())throw Error("Approved original-evidence activation differs");
 const expiresAt=Math.min(activation.startsAt+72*3600_000,reviewerExpiry);
 if(expiresAt<=activation.startsAt||!allowExpired&&expiresAt<=Date.now())throw Error("Original-evidence window unavailable");
 const prior=join(parent,"presence-evaluation",plan.preserve.priorEvaluation);
 const previousLedger=await privateWorkflowBytes(join(prior,"usage","onboarding-usage.json"),prior);
 const priorGrant=await privateWorkflowFile<PresenceWorkflowGrant>(join(prior,"grant.json"),prior);
 if(hash(previousLedger)!==plan.preserve.priorLedgerSha256||JSON.parse(previousLedger.toString()).attempts.length!==54||
   !priorGrant.ledger.carryForward?.reportHold)throw Error("Original cumulative ledger differs");
 const sourceRoot=join(root,"sources");await verifyDirectory(sourceRoot);
 const originals:OriginalMaterial[]=plan.originalMaterials.map(source=>({
  id:source.id,sha256:source.sha256,bytes:source.bytes,mime:source.mime as OriginalMaterial["mime"],
  reference:source.path,author:source.author,date:source.date,status:source.status as OriginalMaterial["status"],
  purpose:source.purpose as OriginalMaterial["purpose"],operations:source.operations as OriginalMaterial["operations"],
 }));
 async function readOriginal(source:OriginalMaterial){
  const file=join(sourceRoot,source.sha256+".source"),meta=await lstat(file);
  if(!meta.isFile()||meta.uid!==process.getuid?.()||(meta.mode&0o777)!==0o600||await realpath(file)!==file||
     meta.size!==source.bytes)throw Error("Original custody differs");
  const bytes=await readFile(file);if(hash(bytes)!==source.sha256)throw Error("Original bytes differ");return bytes;
 }
 const material=await Promise.all(originals.map(async source=>({source,bytes:await readOriginal(source)})));
 const brand=draftBrand({scope:originalEvidenceCandidate.scope,visualDirection:focusMioPagesPreview.siteConfiguration.visualDirection,
  design:focusMioPagesPreview.designConfiguration,logo:{assetId:"cd7d9a9f-76a1-4615-957a-0ebaa8e6427d",usageId:"bf7fbc72-50ef-461f-974b-f4dbcc7a62df",
   sha256:originals.find(s=>s.id==="c0-original-wordmark")!.sha256,alt:"MioPages"}});
 const {artifact:verifiedArtifact,...scopeActivation}=activation;void verifiedArtifact;
 return {
  item:originalEvidenceCandidate,primary:JSON.parse(previousLedger.toString()).rateCard,previousLedger,readOriginal,
  fingerprint:fingerprint({activation:scopeActivation,expiresAt,originals,reviewerId,brand:brand.digest}),
  async compile(_original:WorkflowContext){
   void _original;
   const sourceRecords=oldSources.sources.map(s=>({evidence:{id:s.id,kind:s.kind as WorkflowContext["evidence"][number]["kind"],
    label:s.id,reference:s.reference,date:"2026-11-18",content:s.content},use:s.use as "business-fact"|"staffed-offer"|"analysis"|"editorial"}));
   for(const {source,bytes} of material.filter(row=>row.source.mime.startsWith("text/"))){
    sourceRecords.push({evidence:{id:source.id,kind:source.status==="unconfirmed"?"customer-unconfirmed":"service-direction",
     label:source.id,reference:source.reference,date:source.date,content:bytes.toString("utf8")},use:"analysis"});
   }
   const stock=await privateWorkflowFile<unknown>(join(root,"pixabay-search-results.json"),root);
   sourceRecords.push({evidence:{id:"stock-discovery",kind:"public-research",label:"Two approved Pixabay searches; selection and rights still pending",reference:"https://pixabay.com/api/",date:"2026-11-18",content:JSON.stringify(stock)},use:"analysis"});
   const context:WorkflowContext={intakeId:originalEvidenceCandidate.intakeId,scope:originalEvidenceCandidate.scope,entry:"DIRECT_START",
    evidence:sourceRecords.map(r=>r.evidence),limitations:["Isolated development C0, not customer acceptance or publication. Ten original answers remain unconfirmed."],
    conflicts:[],evaluation:{scenario:"c0",basis:originalEvidenceApproval}};
   const stages=plan.provider.stages as WorkflowStagePlan;
   const ledger={id:fingerprint({proposal:originalEvidenceApproval,case:originalEvidenceCandidate,startsAt:activation.startsAt}),
    startingLedger:plan.preserve.priorLedgerSha256,baselineAttempts:54,requests:99,generations:49,capMicros:12000000,
    inputTokens:128000,inputBytes:36000000,breakdown:{text:49,images:0,searchCalls:10},
    carryForward:{debitMicros:2811609,totalCapMicros:14811609,reportHold:priorGrant.ledger.carryForward!.reportHold},stages};
   validateWorkflowStagePlan(stages,ledger,10);
   const grant:PresenceWorkflowGrant={contextDigest:fingerprint(context),approvedSources:context.evidence.map(fingerprint),
    approvedCorrections:[],approvedRevisionFeedback:[],siteComposition:"managed-v1",nativeComponents:2,
    originalMaterials:{version:1,contextDigest:fingerprint(context),records:originals,requestBytes:36000000,
     publicResearch:{maximumRecords:60,maximumBytes:20000000,screenshots:true}},
    marketingAuthority:{contextDigest:fingerprint(context),sources:sourceRecords.map(r=>({digest:fingerprint(r.evidence),use:r.use})),
     brandDigest:brand.digest,brandBrief:"Approved original MioPages wordmark and purple/warm-neutral identity; historical v3 is quality precedent, not a layout template.",
     qualityReviewerId:reviewerId,strategy:{version:1,peerIds:[],discoveredPeers:true,copyPolicy:"unpriced-no-testimony",
      entryJourneys:{reviewClaimId:"c0-review",directClaimId:"c0-direct"}}},
    researchSources:[{id:"research:b12",url:"https://www.b12.io/",label:"B12"},{id:"research:sitecare",url:"https://sitecare.com/",label:"SiteCare"}],
    researchResponseBytes:2000000,marketSearch:{publicQuery:"managed web presence services for small businesses customer needs alternatives objections and ongoing growth",
     maxToolCalls:10,maxSources:10,minimumNewOrigins:3},
    previewActionDestinations:{"request-review":"/free-review","start-onboarding":"/direct-start"},
    maxOutputTokens:24000,maxRetries:0,maxEditorialRevisions:3,maxCommercialReplans:1,startsAt:activation.startsAt,expiresAt,ledger};
   return {context,grant,brand,originals,readOriginal};
  }
 };
}
