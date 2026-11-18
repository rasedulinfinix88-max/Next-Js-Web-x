
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",

  images: {
    unoptimized: true,
  },

  trailingSlash: true,

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  basePath: "/Next-Js-Web-x",
  assetPrefix: "/Next-Js-Web-x/",
};

export default nextConfig;
