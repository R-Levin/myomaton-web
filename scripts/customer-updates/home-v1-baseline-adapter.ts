import historical from "./myomaton-home-v1-baseline.json";

// Historical Microsite keys belong to the frozen 2026-10-01 evidence, not the
// active SQL model. Project only identifier names; preserve every guarded value.
const { microsites, ...rest } = historical;
export const homeV1Baseline = {
  ...rest,
  managed_sites: microsites,
  pages: historical.pages.map(({ microsite_id, ...page }) => ({
    ...page, managed_site_id: microsite_id,
  })),
};
