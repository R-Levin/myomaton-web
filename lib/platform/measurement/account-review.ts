import { fingerprint, object } from "../canonical/model";
import type { PresenceWorkflowView, WorkflowContext } from "../intake/presence-workflow";
import { FirstPartyMeasurement, type MeasurementSource } from "./first-party";

/** Authenticated Core review activity only. This is not the WordPress visitor
 * collector, Contact acceptance, customer outcomes or business performance. */
export function accountReviewActivity(measurement: FirstPartyMeasurement, activatedAt: string, clock = Date.now) {
  return async (context: WorkflowContext, workflow: PresenceWorkflowView, value?: unknown) => {
    if (workflow.contextDigest !== fingerprint(context)) throw Error("Current account source required for review activity");
    const key = fingerprint({ scope: context.scope, intakeId: context.intakeId, purpose: "core-account-review/1" });
    const source: MeasurementSource = {
      id: `${key.slice(0, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}-${key.slice(16, 20)}-${key.slice(20, 32)}`,
      selection: context.scope, environment: "development", activatedAt,
      revision: fingerprint({ context: workflow.contextDigest, report: workflow.report, direction: workflow.direction,
        blueprint: workflow.blueprint, pages: workflow.pages }),
      routes: { "/core": ["open-current-work"] }, coverage: ["page-observed", "action-selected"],
    };
    if (value !== undefined) {
      const event = object(value, ["id", "kind", "at", "action"]);
      if (!["page-observed", "action-selected"].includes(String(event.kind))) throw Error("Review activity kind refused");
      await measurement.record(source, { ...event, page: "/core", attribution: null });
    }
    return measurement.snapshot(source, activatedAt, new Date(clock()).toISOString());
  };
}
