import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preserve the standalone Node renderer used for exact approved preview
  // revalidation. App Route bundling otherwise selects React's react-server
  // export, which deliberately has no renderToStaticMarkup implementation.
  serverExternalPackages: ["react-dom"],
  // Only the isolated artifact handles exact raw paths before Next's router.
  // Normal Core keeps the framework's existing defaults.
  ...(process.env.MIOPAGES_WP_PRIVATE_STAGE === "enabled" || process.env.MIOPAGES_PROTECTED_CORE === "enabled" ? {
    skipTrailingSlashRedirect: true,
    skipProxyUrlNormalize: true,
  } : {}),
};

export default nextConfig;
