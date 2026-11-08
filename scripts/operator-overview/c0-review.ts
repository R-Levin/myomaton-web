import { developmentOnly, type Owner } from "../../lib/platform/reviews/model";
import { prospectInterview } from "../../lib/platform/reviews/operator-context";
import { reviewSections } from "../../lib/platform/reviews/presentation";
import { LocalReviewStore, type ReviewState } from "../../lib/platform/reviews/store";
import { mioPagesIntakeOwner } from "../../lib/platform/intake/availability";

const reviewId = "8b842f9b-10af-4328-8c01-aa2e45c8f959";
export const approvedReviewDigest = "8c880b38bea80b864b639a45aa498337384bc74a9201a085509f11c746bfb1ef";
const approvalEvent = "d84e88d52ec7af9503d64e8b0b21cd1e1503dcfc12ca9570a7e50d534457ddd6";
const businessQuestions = new Set(["offer", "audience", "problem", "reviewFocus"]);

function presentC0Review(review: ReviewState) {
  const latest = review.revisions.at(-1);
  const approval = review.decisions.at(-1);
  if (review.id !== reviewId || review.packet.digest !== "7708c066d5451a331b22cebbdbe8da8ab8438b1e7c0fd64b2769617447e0c79f" ||
      review.state !== "APPROVED" || latest?.number !== 3 || latest.digest !== approvedReviewDigest ||
      approval?.action !== "approve" || approval.hash !== approvalEvent || approval.binding.revisionDigest !== latest.digest) {
    throw Error("Expected the exact retained C0 Review approval");
  }
  const interview = prospectInterview(review.packet, latest.questionnaireContext);
  return {
    submittedAt: review.packet.submission.submitted_at,
    answers: interview.groups.flatMap(group => group.fields.filter(field => businessQuestions.has(field.key))
      .map(field => ({ question: field.label, answer: field.answer }))),
    revisions: review.revisions.map(revision => ({ number: revision.number, at: revision.at, source: revision.source })),
    approvedAt: approval.at,
    approvalEvent: approval.hash,
    reviewedPaths: review.packet.presence?.reviewed.map(row => row.route) ?? [],
    sections: reviewSections(latest.content),
  };
}

export async function loadC0Review(owner: Owner) {
  if (owner.webPresenceId !== mioPagesIntakeOwner.webPresenceId || owner.managedSiteId !== mioPagesIntakeOwner.managedSiteId) return null;
  try {
    developmentOnly();
    return presentC0Review(await new LocalReviewStore(reviewId, owner).read());
  } catch { return null; }
}

export type C0Review = NonNullable<Awaited<ReturnType<typeof loadC0Review>>>;
