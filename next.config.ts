import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse reads test files from disk at import time and must not be
  // bundled by webpack — tell Next.js to use the native Node.js require.
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
