export const planningMessages = {
  evidence_changed: "Business evidence or dispatch authorization changed. Inspect the current evidence before proceeding.",
  usage_gate: "The request was refused by the usage ledger or budget. Inspect the protected usage receipt.",
  provider_count: "The provider token count failed validation or was unavailable. Inspect the usage receipt.",
  input_token_limit: "The request exceeded its authorized input allowance.",
  provider_transport: "The generation request returned no usable transport result. Inspect the protected usage receipt.",
  provider_identity: "The response model or processing tier did not match the authorization.",
  provider_usage: "The response usage did not match the authorized token or cost limits.",
  provider_incomplete: "The provider reported an incomplete or refused response.",
  output_token_limit: "The model reached the output limit before it finished.",
  response_decode: "The response did not contain the expected proposal JSON. Inspect the private response evidence.",
  proposal_shape: "The proposal structure is invalid. Inspect the private response evidence.",
  proposal_citations: "The proposal has missing, duplicate or out-of-scope citations. Inspect the private response evidence.",
  proposal_route: "A proposed page or visitor destination is invalid. Inspect the private response evidence.",
  proposal_content: "Proposed copy is missing, unsafe or outside its field constraints. Inspect the private response evidence.",
  custody_write: "Core could not verify a private response write. Check protected storage before continuing.",
  custody_read: "Core could not verify the stored response. Check its integrity and permissions.",
  custody_expired: "The protected response has reached the recovery deadline.",
  draft_capacity: "The proposal exceeded the current intake storage capacity. Its verified private response remains available during the recovery window.",
  draft_persistence: "The draft write could not be verified. Reload and recover the saved response.",
  interrupted: "Generation was interrupted before Core could verify a saved response. Inspect the usage ledger before any further dispatch.",
  generation_failed: "This earlier failure has no retained stage or response evidence.",
} as const;

export type PlanningFailure = keyof typeof planningMessages;

export class PlanningFailureError extends Error {
  constructor(readonly code: PlanningFailure) {
    super(planningMessages[code]);
  }
}

export function atPlanningStage<T>(code: PlanningFailure, run: () => T): T {
  try { return run(); }
  catch (error) {
    if (error instanceof PlanningFailureError) throw error;
    throw new PlanningFailureError(code);
  }
}
