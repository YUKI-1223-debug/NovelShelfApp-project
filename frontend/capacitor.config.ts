import type { CapacitorConfig } from "@capacitor/cli";

// NovelShelf ネイティブアプリ（Capacitor）の設定。
// 画面は Next.js の静的エクスポート出力（out/）をアプリ本体にバンドルして WebView で表示する。
// API 通信先はビルド時に NEXT_PUBLIC_API_BASE_URL で焼き込む（既定 https://novelshelf.jp/api/v1）。
// サーバー（server.url）は設定しない = 完全オフライン起動。
const config: CapacitorConfig = {
  appId: "jp.novelshelf.app",
  appName: "NovelShelf",
  webDir: "out",
  plugins: {
    // API 通信をネイティブ HTTP 層経由にすることで WebView の CORS 制約を回避する。
    // これによりバックエンドの CORS_ALLOWED_ORIGINS に localhost 系を足さなくてもアプリから
    // 本番 API を叩ける（fetch / XHR は @capacitor/core がネイティブ実装へパッチする）。
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
