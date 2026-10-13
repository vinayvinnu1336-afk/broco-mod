/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      // Hero/marketing photos: versioned file names, so browsers may keep them for a year.
      // To change a photo, add it under a NEW name (see docs/brand/README.md) instead of overwriting.
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // Car brand logos rarely change; refresh them daily.
      {
        source: "/brands/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
