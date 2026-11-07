import { fingerprint, text } from "../canonical/model";
import { placementInput, type SuppliedMediaAuthority } from "./supplied-media";
import type { SuppliedPlacement } from "./supplied-evidence";
import type { StockSelection } from "./stock";

export type StockSearchHit = Pick<StockSelection, "provider" | "sourceId" | "sourceUrl" | "creator"> & {
  previewUrl: string;
  description?: string;
  representation: { id: string; url: string; width: number; height: number };
};
export interface StockSearchProvider {
  readonly credit: { label: string; url: string };
  search(phrase: string): Promise<readonly StockSearchHit[]>;
}

const cacheDuration = 24 * 60 * 60 * 1000;
type SearchEntry = {
  expiresAt: number;
  placements: Set<string>;
  results: Promise<readonly (StockSearchHit & { digest: string })[]>;
};

// The private Operator action supplies one human-entered search. No scheduler,
// automatic selection, media download or eligibility grant is attached here.
export class StockDiscovery {
  private readonly cache = new Map<string, SearchEntry>();

  constructor(private readonly provider: StockSearchProvider, private readonly authority: SuppliedMediaAuthority) {}

  private async authorize(context: unknown, target: SuppliedPlacement, phrase: string) {
    const placement = placementInput(target);
    await this.authority.authorize(context, "receive-supplied-media", structuredClone(placement));
    return { placement, query: text(phrase, 100).normalize("NFC").replace(/\s+/g, " ").toLowerCase() };
  }

  async search(context: unknown, target: SuppliedPlacement, phrase: string) {
    const { placement, query } = await this.authorize(context, target, phrase);
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= Date.now()) this.cache.delete(key);
    }
    let entry = this.cache.get(query);
    if (!entry) {
      if (this.cache.size >= 64) throw Error("Stock search cache is at capacity");
      const next: SearchEntry = { expiresAt: Infinity, placements: new Set(), results: this.provider.search(query).then(hits => {
        const results = hits.map(hit => ({ ...hit, digest: fingerprint(hit) }));
        next.expiresAt = Date.now() + cacheDuration;
        return results;
      }).catch(error => {
        this.cache.delete(query);
        throw error;
      }) };
      this.cache.set(query, next);
      entry = next;
    }
    const results = await entry.results, scope = fingerprint(placement);
    if (!entry.placements.has(scope) && entry.placements.size >= 128) throw Error("Stock search review is at capacity");
    entry.placements.add(scope);
    return { query, credit: structuredClone(this.provider.credit), results: structuredClone(results), expiresAt: entry.expiresAt };
  }

  async select(context: unknown, target: SuppliedPlacement, phrase: string, sourceId: string, digest: string) {
    const { placement, query } = await this.authorize(context, target, phrase);
    const entry = this.cache.get(query);
    if (!entry || entry.expiresAt <= Date.now() || !entry.placements.has(fingerprint(placement))) throw Error("Current reviewed stock search required");
    const hit = (await entry.results).find(result => result.sourceId === sourceId && result.digest === digest);
    if (!hit) throw Error("Exact reviewed stock selection required");
    return { placement, selection: structuredClone(hit), credit: structuredClone(this.provider.credit), expiresAt: entry.expiresAt, state: "requires-rights-review" as const };
  }
}
