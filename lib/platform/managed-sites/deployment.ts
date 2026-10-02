// Explicit single-deployment selection, not request-host tenant resolution.
// Resolve this exact active Web Presence/ManagedSite pair; ambiguity fails closed.
// P9 will replace this boundary when production host routing is introduced.
export const managedSiteDeployment = {
  domain: "myomaton.com",
  managedSiteName: "Myomaton",
} as const;
