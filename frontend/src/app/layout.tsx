import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { OfflinePositionSync } from "@/components/OfflinePositionSync";
import { THEME_INIT_SCRIPT } from "@/lib/theme/applyTheme";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovelShelf",
  description: "広告なしのWeb小説リーダー",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // ネイティブアプリに近い操作感にするため、ページ全体のピンチ/ダブルタップズームは無効化する。
  // 文字サイズの調整は設定画面のフォントサイズ機能で行う想定（docs/DECISIONS.md参照）。
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0ece2" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1a17" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ServiceWorkerRegister />
          <OfflinePositionSync />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
