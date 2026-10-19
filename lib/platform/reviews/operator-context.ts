import type { Claim, ReviewEvidencePacket } from "./model";
import { questionnaireFor, type QuestionnaireContext } from "./questionnaire";

export function prospectInterview(packet: ReviewEvidencePacket, revisionContext?: QuestionnaireContext) {
  const resolved = questionnaireFor(packet.submission, revisionContext ?? packet.questionnaireContext);
  const groups = resolved.context.groups.map(g => ({ number: g.number, title: g.title, fields: g.fields.flatMap(f => {
    const answer = packet.submission.answers[f.key];
    if (answer === undefined || typeof answer === "string" && !answer.trim() || Array.isArray(answer) && !answer.length) return [];
    return [{ ...f, reference: `intake:${f.key}`, answer: Array.isArray(answer) ? [...answer] : answer, provenance: { ...packet.submission.provenance[f.key] } }];
  }) })).filter(g => g.fields.length);
  return { mode: resolved.mode, questionnaireVersion: resolved.context.questionnaireVersion, groups };
}
export function claimSources(claim: Claim, packet: ReviewEvidencePacket, revisionContext?: QuestionnaireContext) {
  const context = questionnaireFor(packet.submission, revisionContext ?? packet.questionnaireContext).context;
  return (claim.referenceReview?.candidateEvidence ?? claim.evidence).map(reference => {
    if (reference.startsWith("intake:")) {
      for (const group of context.groups) { const f = group.fields.find(f => `intake:${f.key}` === reference); if (f && Object.hasOwn(packet.submission.answers, f.key)) return { type: "intake" as const, reference, question: group.title, field: { ...f, answer: packet.submission.answers[f.key], provenance: packet.submission.provenance[f.key] } }; }
      throw Error("Claim references an unanswered/unmapped intake field");
    }
    const e = packet.evidence.find(e => e.id === reference); if (!e) throw Error("Claim evidence source missing");
    const page = packet.presence?.reviewed.find(p => p.evidenceId === reference);
    const title = page ? packet.presence!.discovered.find(p => p.route === page.route)!.title : e.kind === "public-web" ? "Captured public Web evidence" : "Operator-supplied evidence";
    return { type: "page" as const, reference, title, route: page?.route, source: e.source, observation: e.text, capturedAt: e.capturedAt, limitations: e.coverage };
  });
}

// Separate trusted operator artifact; never appended to customer Review Markdown.
export function interviewMarkdown(packet: ReviewEvidencePacket) {
  const interview = prospectInterview(packet);
  return "# Prospect Q&A — operator only\n\n" + interview.groups.map(g => {
    const rows = g.fields.filter(f => !f.followUpTo || !g.fields.some(parent => parent.key === f.followUpTo!.key)).map(f => {
      const children = g.fields.filter(child => child.followUpTo?.key === f.key);
      const followup = (choice?: string) => children.filter(child => !choice || child.followUpTo!.choice === choice).map(child => `\n\n  ${child.label}\n\n  ${Array.isArray(child.answer) ? child.answer.join("; ") : child.answer}\n\n  Reference: ${child.reference}`).join("");
      const answer = Array.isArray(f.answer) ? f.answer.map(choice => `- ${choice}${followup(choice)}`).join("\n") : f.answer + followup();
      return `### ${f.label}\n\n${answer}\n\nReference: ${f.reference}`;
    });
    return `## ${g.number}. ${g.title}\n\n${rows.join("\n\n")}`;
  }).join("\n\n") + "\n";
}
