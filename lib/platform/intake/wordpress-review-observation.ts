/** Temporary read-only development observation, not an application receipt. */
export type WordPressReviewObservation = {
  kind: "wordpress-review-observation/1"; observedAt: string; installationId: string;
  revision: number; candidateDigest: string; pluginVersion: string; themeVersion: string;
  pages: { path: string; postId: number }[];
};

export function validateWordPressReviewObservation(value: unknown): WordPressReviewObservation {
  const data = value as WordPressReviewObservation;
  if (!data || data.kind !== "wordpress-review-observation/1" ||
      data.installationId !== "d84ebc69-46d5-4c64-adc6-ac7b87468f89" ||
      !Number.isFinite(Date.parse(data.observedAt)) || !Number.isSafeInteger(data.revision) || data.revision < 1 ||
      !/^[a-f0-9]{64}$/u.test(data.candidateDigest) ||
      ![data.pluginVersion, data.themeVersion].every(value => typeof value === "string" && /^\d+\.\d+\.\d+$/u.test(value)) ||
      !Array.isArray(data.pages) || !data.pages.length || data.pages.some(page =>
        !page || typeof page.path !== "string" || !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)*$/u.test(page.path) ||
        !Number.isSafeInteger(page.postId) || page.postId < 1) ||
      new Set(data.pages.map(page => page.path)).size !== data.pages.length ||
      new Set(data.pages.map(page => page.postId)).size !== data.pages.length) {
    throw Error("WordPress review observation refused");
  }
  return { kind: data.kind, observedAt: data.observedAt, installationId: data.installationId,
    revision: data.revision, candidateDigest: data.candidateDigest, pluginVersion: data.pluginVersion,
    themeVersion: data.themeVersion, pages: data.pages.map(({ path, postId }) => ({ path, postId })) };
}

export function wordpressDraftReviewUrl(postId: number) {
  if (!Number.isSafeInteger(postId) || postId < 1) throw Error("WordPress Page identity required");
  return "https://miopages.org/?page_id=" + postId + "&preview=true";
}
