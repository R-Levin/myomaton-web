import { canonicalPagePath } from "../managed-sites/paths";
import { atPlanningStage, PlanningFailureError } from "./planning-diagnostics";
import { object, text } from "../canonical/model";

const string = { type: "string" };
const shape = (properties: Record<string, unknown>) => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});
export const presencePlanSchema = shape({
  positioning: string, offering: string, audience: string,
  pages: { type: "array", items: shape({
    path: string, title: string, purpose: string, seoDescription: string, action: string,
    sections: { type: "array", items: shape({ heading: string, body: string }) },
  }) },
});

const copy = (value: unknown, max: number) => atPlanningStage("proposal_content", () => {
  const result = text(value, max, true);
  if (/[\u202a-\u202e\u2066-\u2069]/u.test(result)) throw Error("Unsafe Presence Direction copy");
  return result;
});

export function readPresencePlan(value: unknown) {
  const plan = object(value, ["positioning", "offering", "audience", "pages"]);
  if (!Array.isArray(plan.pages) || !plan.pages.length) throw Error("Invalid proposed page set");
  const paths = new Set<string>();
  const pages = plan.pages.map(value => {
    const page = object(value, ["path", "title", "purpose", "seoDescription", "action", "sections"]);
    const path = atPlanningStage("proposal_route", () => {
      const path = text(page.path, 120, true);
      if (!canonicalPagePath(path) || paths.has(path)) throw Error();
      return path;
    });
    if (!Array.isArray(page.sections) || !page.sections.length) throw Error("Invalid proposed Page");
    paths.add(path);
    return { path, title: copy(page.title, 100), purpose: copy(page.purpose, 300), seoDescription: copy(page.seoDescription, 160),
      action: copy(page.action, 100), sections: page.sections.map(value => {
        const section = object(value, ["heading", "body"]);
        return { heading: copy(section.heading, 160), body: copy(section.body, 1000) };
      }) };
  });
  if (!paths.has("/")) throw new PlanningFailureError("proposal_route");
  return { positioning: copy(plan.positioning, 500), offering: copy(plan.offering, 500), audience: copy(plan.audience, 350), pages };
}
export type PresencePlan = ReturnType<typeof readPresencePlan>;
