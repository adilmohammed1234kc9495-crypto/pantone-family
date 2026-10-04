/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    const rawBackend = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:5000";
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
