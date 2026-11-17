import r3 from "../../../scripts/customer-previews/miopages-editorial-r3.json";
import { fingerprint } from "../canonical/model";
import type { PresenceEvidence } from "./presence-workflow-artifacts";

/** Reference pack for a fresh, separately authorized C0 case. The old intake
 * and historic evaluation keep their exact evidence and digests. */
export function c0MarketingEditorial() {
  const pages: PresenceEvidence[] = r3.pages.map((page, index) => {
    const body = JSON.stringify(page);
    if (r3.developmentNotes.some(note => body.includes(note)) || /development note:/iu.test(body)) {
      throw Error("C0 editorial excerpt includes internal instructions");
    }
    return {
      id: "c0-r3-public-copy:" + (index + 1), kind: "service-direction", label: "C0 R3 editorial reference — " + page.title,
      reference: "scripts/customer-previews/miopages-editorial-r3.json#" + r3.sha256,
      date: null, content: body,
    };
  });
  return { pages, sources: pages.map(source => ({ digest: fingerprint(source), use: "editorial" as const })) };
}
