/** @type {import('next').NextConfig} */
// 阿里云 FC nextjs 环境要求 output: 'standalone'，server.js 位于 zip 根目录
const nextConfig = {
  async redirects() {
    return [
      // 盲测擂台 → Arena（流量增长 V1.0 D11：唯一内容 301，spec §65 三同步）
      { source: '/blindtest', destination: '/arena', statusCode: 301 },
      { source: '/blindtest/:path*', destination: '/arena/:path*', statusCode: 301 },
    ];
  },
  output: 'standalone',
  reactStrictMode: true,
  // pdfjs-dist 的可选依赖 canvas（Node 渲染用）在服务器不存在，排除打包
  serverExternalPackages: ['pdfjs-dist', 'canvas'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // pdfjs-dist 内部对 canvas 是可选 require，标记为外部避免打包失败
      config.externals = [...(config.externals || []), { canvas: 'commonjs canvas' }];
    }
    return config;
  },
};

export default nextConfig;
