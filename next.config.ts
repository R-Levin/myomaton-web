import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preserve the standalone Node renderer used for exact approved preview
  // revalidation. App Route bundling otherwise selects React's react-server
  // export, which deliberately has no renderToStaticMarkup implementation.
  serverExternalPackages: ["react-dom"],
};

export default nextConfig;
