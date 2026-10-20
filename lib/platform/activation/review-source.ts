import { same, type CreateCase, type ReviewBinding } from "./model";
import { assertOwner, type Owner, type Submission } from "../reviews/model";
import { LocalReviewStore, type ReviewState } from "../reviews/store";

export interface ApprovedReviewSource { read(id: string, owner: Owner): Promise<ReviewState> }
// Existing store verifies the complete immutable ledger/QC before returning it.
export const localApprovedReviews: ApprovedReviewSource = { read: (id, owner) => new LocalReviewStore(id, owner).read() };
export async function approvedReview(reader: ApprovedReviewSource, request: NonNullable<CreateCase["review"]>, owner: Owner, submission: Submission): Promise<ReviewBinding> {
  if (submission.entry_intent !== "FREE_REVIEW") throw Error("Direct Start cannot acquire a fabricated Review dependency");
  const r = await reader.read(request.id, owner); assertOwner(r.packet.owner, owner);
  const revision = r.revisions.find(v => v.number === request.revision);
  const event = r.decisions.find(e => e.action === "approve" && e.binding.revision === request.revision && e.binding.revisionDigest === request.digest);
  if (r.id !== request.id || !revision || revision.digest !== request.digest || !event || !same(r.packet.submission, submission) || event.binding.submissionDigest !== submission.digest || event.binding.evidenceDigest !== r.packet.digest) throw Error("Exact approved Review/source binding required");
  return { ...request, evidenceDigest: r.packet.digest, approvalEventHash: event.hash };
}
