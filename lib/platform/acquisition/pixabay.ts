import { text } from "../canonical/model";
import { record } from "../presentation/content";
import type { StockSearchHit, StockSearchProvider } from "./stock-discovery";

// Transport is supplied by the composition root.
type SearchResponse = { status: number; body: unknown };
const pageSize = 8;

function pixabayUrl(value: unknown, role: "source" | "image", id: string) {
  let url: URL;
  try { url = new URL(text(value, 500)); } catch { throw Error("Invalid Pixabay result URL"); }
  const safePath = role === "source"
    ? url.hostname === "pixabay.com" && url.pathname.replace(/\/$/, "").endsWith("-" + id)
    : (url.hostname === "pixabay.com" && url.pathname.startsWith("/get/") ||
      url.hostname === "cdn.pixabay.com" && url.pathname.startsWith("/photo/"))
      && /\.(jpe?g|png|webp)$/i.test(url.pathname);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || !safePath) {
    throw Error("Unsupported Pixabay result URL");
  }
  return url.href;
}

function normalizeResponse(value: unknown): StockSearchHit[] {
  const { hits } = record(value);
  if (!Array.isArray(hits) || hits.length > pageSize) throw Error("Invalid bounded Pixabay results");
  const ids = new Set<string>();
  return hits.map(value => {
    const hit = record(value);
    if (!Number.isSafeInteger(hit.id) || Number(hit.id) <= 0 || hit.type !== "photo") throw Error("Invalid Pixabay photo identity");
    const sourceId = String(hit.id);
    if (ids.has(sourceId)) throw Error("Duplicate Pixabay photo identity");
    ids.add(sourceId);
    const { webformatWidth: width, webformatHeight: height } = hit;
    if (typeof width !== "number" || typeof height !== "number" ||
      !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 640 || height > 640) {
      throw Error("Unsupported Pixabay representation dimensions");
    }
    const description = typeof hit.tags === "string" ? hit.tags.replace(/[<>\u0000-\u001f\u007f-\u009f]/g, " ").trim().slice(0, 240) : "";
    return { ...(description ? { description } : {}), provider: "pixabay", sourceId, sourceUrl: pixabayUrl(hit.pageURL, "source", sourceId),
      creator: hit.user == null || hit.user === "" ? null : text(hit.user, 200),
      previewUrl: pixabayUrl(hit.previewURL, "image", sourceId),
      representation: { id: "webformat", url: pixabayUrl(hit.webformatURL, "image", sourceId), width, height } };
  });
}

export function pixabaySearch(readResponse: (params: URLSearchParams) => Promise<SearchResponse>): StockSearchProvider {
  return {
    credit: { label: "Images from Pixabay", url: "https://pixabay.com/" },
    async search(phrase) {
      const params = new URLSearchParams({ q: text(phrase, 100), image_type: "photo", safesearch: "true", per_page: String(pageSize), page: "1" });
      const response = await readResponse(params);
      if (response.status === 429) throw Error("Pixabay rate limit reached");
      if (response.status === 401 || response.status === 403) throw Error("Pixabay access refused");
      if (response.status !== 200) throw Error("Pixabay search unavailable");
      return normalizeResponse(response.body);
    },
  };
}
