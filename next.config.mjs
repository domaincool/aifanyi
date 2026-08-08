/** @type {import('next').NextConfig} */
// 阿里云 FC nextjs 环境要求 output: 'standalone'，server.js 位于 zip 根目录
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
};

export default nextConfig;
