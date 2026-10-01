import type { DesignConfiguration } from "../../lib/platform/design-systems/configuration";

export const myomatonDesignConfiguration = {
  typography: {
    bodyFont: "sans",
    headingFont: "sans",
    baseSize: 18,
    headingScale: 3,
    lineHeight: 1.65,
  },
  colors: {
    background: "#f6f5f0",
    surface: "#e9ede6",
    text: "#202b27",
    muted: "#526159",
    accent: "#214e43",
    onAccent: "#ffffff",
    border: "#cbd3c9",
  },
  spacing: { unit: 8, section: 72 },
  shape: { radius: 12 },
} satisfies DesignConfiguration;
