// Explicit single-deployment selection, not request-host tenant resolution.
// Resolve this exact active Web Presence/Microsite pair; ambiguity fails closed.
// P9 will replace this boundary when production host routing is introduced.
export const micrositeDeployment = {
  domain: "myomaton.com",
  micrositeName: "Myomaton",
} as const;
