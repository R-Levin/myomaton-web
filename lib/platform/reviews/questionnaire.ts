import archived from "./questionnaires/foundational-intake-1.json";
import { object, text } from "../canonical/model";
import type { Submission } from "./model";

type Condition = { field: string; oneOf: string[] };
type Definition = { questionnaireVersion: string; definitionCommit: string; definitionSha256: string; groups: { number: number; title: string; titleFromField?: string; intentTitles?: Record<string, string>; fields: { key: string; label: string; kind: string; required?: boolean; when?: Condition; labels?: { when: Condition; label: string }[] }[] }[] };
export type QuestionnaireContext = { version: "review-questionnaire/1"; questionnaireVersion: string; definitionCommit: string; definitionSha256: string; groups: { number: number; title: string; fields: { key: string; label: string; kind: string; optional: boolean; followUpTo?: { key: string; choice: string } }[] }[] };
// Frozen semantic data from the accepted version, never today's mutable UI source.
const definitions: Record<string, Definition> = { [archived.questionnaireVersion]: archived as Definition };
export function snapshotQuestionnaire(submission: Submission): QuestionnaireContext {
  const definition = definitions[submission.questionnaire_version];
  if (!definition) throw Error("No pinned questionnaire definition for this version");
  const applies = (condition?: Condition) => !condition || condition.oneOf.some(v => {
    const answer = submission.answers[condition.field]; return Array.isArray(answer) ? answer.includes(v) : answer === v;
  });
  const groups = definition.groups.map(g => {
    const fields = g.fields.filter(f => applies(f.when)).map(f => ({ key: f.key, label: f.labels?.find(l => applies(l.when))?.label ?? f.label, kind: f.kind, optional: !f.required, ...(f.when && g.fields.some(parent => parent.key === f.when!.field) ? { followUpTo: { key: f.when.field, choice: f.when.oneOf.find(choice => applies({ field: f.when!.field, oneOf: [choice] }))! } } : {}) }));
    return { number: g.number, title: g.titleFromField ? fields.find(f => f.key === g.titleFromField)!.label : g.intentTitles?.[submission.entry_intent] ?? g.title, fields };
  });
  const context: QuestionnaireContext = { version: "review-questionnaire/1", questionnaireVersion: definition.questionnaireVersion, definitionCommit: definition.definitionCommit, definitionSha256: definition.definitionSha256, groups };
  validateQuestionnaire(context, submission); return context;
}
export function validateQuestionnaire(context: QuestionnaireContext, submission: Submission) {
  object(context, ["version", "questionnaireVersion", "definitionCommit", "definitionSha256", "groups"]);
  if (context.version !== "review-questionnaire/1" || context.questionnaireVersion !== submission.questionnaire_version || !/^[a-f0-9]{40}$/.test(context.definitionCommit) || !/^[a-f0-9]{64}$/.test(context.definitionSha256)) throw Error("Invalid questionnaire context/version");
  if (!Array.isArray(context.groups) || context.groups.length < 1 || context.groups.length > 30) throw Error("Invalid questionnaire groups");
  const keys = new Set<string>();
  for (const [i, g] of context.groups.entries()) {
    object(g, ["number", "title", "fields"]); text(g.title, 400);
    if (g.number !== i + 1 || !Array.isArray(g.fields) || !g.fields.length || g.fields.length > 10) throw Error("Invalid questionnaire order/group");
    for (const f of g.fields) {
      object(f, ["key", "label", "kind", "optional", "followUpTo"]); text(f.label, 400);
      if (!/^[a-zA-Z][a-zA-Z0-9]{0,79}$/.test(f.key) || keys.has(f.key) || !["text", "textarea", "email", "url", "single", "multiple"].includes(f.kind) || typeof f.optional !== "boolean") throw Error("Invalid questionnaire field");
      if (submission.answers[f.key] !== undefined && (f.kind === "multiple" ? !Array.isArray(submission.answers[f.key]) : typeof submission.answers[f.key] !== "string")) throw Error("Questionnaire answer type mismatch");
      if (f.followUpTo) { object(f.followUpTo, ["key", "choice"]); text(f.followUpTo.choice, 200); const parent = g.fields.find(p => p.key === f.followUpTo!.key); const answer = submission.answers[f.followUpTo.key]; if (!parent || !keys.has(parent.key) || !["single", "multiple"].includes(parent.kind) || !(Array.isArray(answer) ? answer.includes(f.followUpTo.choice) : answer === f.followUpTo.choice)) throw Error("Invalid conditional follow-up relationship"); }
      keys.add(f.key);
    }
  }
  if (Object.keys(submission.answers).some(k => !keys.has(k))) throw Error("Stored answer has no applicable questionnaire wording");
}
export function questionnaireFor(submission: Submission, embedded?: QuestionnaireContext) {
  if (embedded) { validateQuestionnaire(embedded, submission); return { mode: "embedded" as const, context: embedded }; }
  return { mode: "legacy-pinned" as const, context: snapshotQuestionnaire(submission) };
}
