/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    const rawBackend = process.env.INTERNAL_BACKEND_URL || "https://pantone-family.onrender.com";
    const baseBackend = rawBackend.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
    return [
      {
        source: "/api/v1/:path*",
        destination: `${baseBackend}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
