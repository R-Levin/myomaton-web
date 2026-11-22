/** Development review scope is distinct from customer acceptance or publication. */
export function editorialScopeInstructions(homeOnly: boolean) {
  return (homeOnly
    ? "Review only the supplied Home concept and its actual rendered desktop/mobile evidence. Assess its supported offer coverage, originality, buyer relevance, hierarchy, writing and visual choices. Do not assess an undrafted supporting Page as if its content already existed."
    : "Critically review the complete supplied site and actual desktop/mobile rendering for commercial breadth, originality, duplication, coherent journeys, meaningful content and Actions, accessibility and unsupported claims. Check the whole offer against the complete owned business sources, not just prior generated summaries.") +
    " Use an exact supplied drafted Page path for a substantive copy or design concern. Keep inactive preview submissions, planned but undrafted routes and unverified launch prerequisites visible in the summary as operational requirements; do not demand invented capability or changes to supported service promises to fix them. Broken navigation between actually drafted Pages, misleading claims, poor mobile behavior and missing supported value remain material concerns. An editorial opinion is not customer acceptance or publication authority.";
}

/** Owner requirement (baseline Part 1 #12, P0-9/P0-10/P0-27): pages carry actual
 * images, or clearly marked FPO frames where final art is not yet available.
 * Acquired-image rights review is unchanged; an FPO frame is never real media. */
export const fpoImageInstructions =
  "Make the site visually rich: plan imagery wherever a picture would help the visitor understand, compare or trust the offer, including the Hero. " +
  "Where no suitable acquired image is supplied, still place the image: put an image node in the authored section and set that section's visual status to asset-needed, " +
  "with a specific brief that says what the final image must show, its composition and its job for this visitor, and a usable altIntent. " +
  "The site renders it as a clearly marked FPO (for-position-only) frame until final art is acquired and reviewed. " +
  "Never describe an FPO frame or stock image as an actual customer, project, result or endorsement, and never claim that unacquired media already exists. " +
  "Choose the Hero concept yourself from the business, research and Direction.";

export function stockPlacementInstructions(sourceAware: boolean) {
  if (!sourceAware) return "When availableMedia is supplied, this private cycle requires both selected photographs to become purposeful supporting Intro placements in the real website. On a Home revision, compose suitable distinct supporting contexts for the two images; if a different page is materially better, state that exact placement need in the brief instead of treating acquisition as completed. Use the actual selected source IDs in the visual brief, propose useful supporting Intro placements and contextual altIntent, and use the actual supplied permission state: selection/download alone means pending; private-contextual-rights-and-usage-verified means that exact private placement has already been reviewed, while public publication remains unapproved.";
  return "Available stock is an optional selection pool, not a requirement to place both photographs or put them on Home. Use a photograph only when it genuinely strengthens this Page's message; omit unsuitable images and use native composition instead. For a proposed placement use one exact selected sourceId in the visual brief, a supported Intro or CTA slot and contextual altIntent. Never use one photo in multiple slots or two photos in one slot. Selection/download alone means pending. Only an exact, current private-contextual-rights-and-usage-verified placement is reviewed; a different Page, changed content or changed use requires new contextual review. Public publication remains unapproved.";
}
