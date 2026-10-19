import type { NextConfig } from "next";

// 静的エクスポート専用（個人利用アプリ化 S4-2、2026-10-19）。novelshelf.jp の Web 配信（standalone・PWA）は廃止し、
// out/ を Windows（Tauri）・Android/iOS（Capacitor）のアプリに同梱するだけになった。
const nextConfig: NextConfig = {
  output: "export",
  // 静的エクスポートでは next/image の最適化サーバーが無いため無効化（本アプリは next/image 未使用）。
  images: { unoptimized: true },
};

export default nextConfig;
