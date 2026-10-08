// Curated, immutable resources. Grammar selects a system, never element fonts.
export const fontResources = [
  { id: "source-serif-4-semibold", family: "Source Serif 4", weight: 600, version: "4.005R", path: "/fonts/source-serif-4.005/semibold.woff2", sha256: "457a13ac92e977d82e376038a2daac7fdb5433610910bf5787bdf6c1c3781865", license: "/fonts/source-serif-4.005/LICENSE.md", source: "https://github.com/adobe-fonts/source-serif/releases/tag/4.005R" },
  { id: "source-sans-3-regular", family: "Source Sans 3", weight: 400, version: "3.052R", path: "/fonts/source-sans-3.052/regular.woff2", sha256: "53492fb3a0def77354f166a55d09b63a10855e91c206c7620a81cf56e97f8ec3", license: "/fonts/source-sans-3.052/LICENSE.md", source: "https://github.com/adobe-fonts/source-sans/releases/tag/3.052R" },
  { id: "source-sans-3-semibold", family: "Source Sans 3", weight: 600, version: "3.052R", path: "/fonts/source-sans-3.052/semibold.woff2", sha256: "47b9b661b9f395fe7f0d0e119637fba5c8dad97bde3df60066fd24229c0792f4", license: "/fonts/source-sans-3.052/LICENSE.md", source: "https://github.com/adobe-fonts/source-sans/releases/tag/3.052R" },
] as const;
export const sourceEditorial = Object.freeze({ id: "source-editorial", version: 1, resources: fontResources, heading: '"Source Serif 4", Georgia, serif', body: '"Source Sans 3", Arial, sans-serif' });
export const sourceSans = Object.freeze({ id: "source-sans", version: 1, resources: fontResources.filter(f => f.family === "Source Sans 3"), heading: '"Source Sans 3", Arial, sans-serif', body: '"Source Sans 3", Arial, sans-serif' });
