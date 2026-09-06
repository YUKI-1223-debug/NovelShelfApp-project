import type { CapacitorConfig } from "@capacitor/cli";

// NovelShelf ネイティブアプリ（Capacitor）の設定。
// 画面は Next.js の静的エクスポート出力（out/）をアプリ本体にバンドルして WebView で表示する。
// API 通信先はビルド時に NEXT_PUBLIC_API_BASE_URL で焼き込む（既定 https://novelshelf.jp/api/v1）。
// サーバー（server.url）は設定しない = 完全オフライン起動。
const config: CapacitorConfig = {
  appId: "jp.novelshelf.app",
  appName: "NovelShelf",
  webDir: "out",
  android: {
    // WebView のオリジンは https://localhost。バックエンドの CORS 許可リストにこれを足す必要がある
    // （CORS_ALLOWED_ORIGINS、コード変更は不要）。
    buildOptions: {
      keystorePath: undefined,
    },
  },
};

export default config;
