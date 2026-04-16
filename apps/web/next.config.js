/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode catches lifecycle bugs during development
  reactStrictMode: true,

  // Allow images from ORCID and institution profile sources
  images: {
    remotePatterns: [
      { hostname: "orcid.org" },
      { hostname: "*.orcid.org" },
    ],
  },

  // Expose the API URL to client components
  // NEXT_PUBLIC_ prefix makes it available in the browser bundle
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  },
};

module.exports = nextConfig;
