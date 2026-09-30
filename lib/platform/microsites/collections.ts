import type { Action } from "../actions/model";
import type { PresentedSubject } from "../subjects/presentation";
import type { CollectionContent } from "./sections";

export type CollectionItem = { id: string; heading: string; text?: string; action?: Action };

// Project resolved dependencies into visitor-facing cards without changing Section content.
export function presentCollection(content: CollectionContent,
  subjects: ReadonlyMap<string, PresentedSubject> = new Map(),
  actions: ReadonlyMap<string, Action> = new Map(),
): CollectionItem[] {
  return content.items.flatMap((item) => {
    const action = item.actionId ? actions.get(item.actionId) : undefined;
    const reference = { id: item.id, ...(action ? { action } : {}) };
    if ("subjectId" in item) {
      const subject = subjects.get(item.subjectId);
      return subject ? [{ ...reference, heading: subject.name, ...(subject.description !== null ? { text: subject.description } : {}) }] : [];
    }
    return [{ ...reference, heading: item.heading, ...(item.text !== undefined ? { text: item.text } : {}) }];
  });
}
