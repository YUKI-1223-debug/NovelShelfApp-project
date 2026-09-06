"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";

// アプリ内リンクの共通ラッパー。
// 静的エクスポート（Capacitor）では、クエリパラメータ方式のルート（/novel?id= 等）に対する
// Next.js の RSC プリフェッチ（<route>.txt?...&_rsc=... の取得）がバンドル内ファイルと
// マッチせず失敗し、Capacitor のローカルサーバーが "Unable to open asset URL" を大量に吐く。
// 実害はない（Next は通常のページ遷移にフォールバックする）が、ログが汚れ無駄な取得も走るため
// プリフェッチを既定で無効化する。個別に有効化したい場合は prefetch を明示的に渡す。
export function AppLink(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
