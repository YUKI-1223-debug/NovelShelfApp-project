import type { NextConfig } from "next";

// NEXT_OUTPUT=export … Capacitor アプリ用の静的エクスポート（out/ に純粋な静的ファイルを出力）。
//   ミニPC の Web 配信も将来この静的出力へ寄せる予定（docs/MOBILE_APP_STRATEGY.md フェーズ0）。
// 未指定 … 従来どおり standalone（Node サーバー）。現行の Web 本番ビルドはこちら。
const isStaticExport = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : "standalone",
  // 静的エクスポートでは next/image の最適化サーバーが無いため無効化（本アプリは next/image 未使用）。
  images: { unoptimized: true },
};

export default nextConfig;
