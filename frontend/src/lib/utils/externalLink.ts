import { Capacitor } from "@capacitor/core";
import { toStandaloneExternalHref } from "./useIsStandalone";

// 外部サイト（なろう・カクヨム等）へのリンクを「いまのアプリ/PWA画面から離れずに、
// 端末の既定ブラウザ（Chrome/Safari）の新しいタブで開く」ための <a> 属性を返す。
//
// - Capacitor ネイティブアプリ: 通常の target="_blank"。Capacitor のネイティブ層が
//   iOS は UIApplication.open、Android は Intent.ACTION_VIEW で外部ブラウザに開くため、
//   これで「アプリ内ブラウザに開いて毎回戻る」問題が起きない。
//   ※ PWA 用の x-safari-https:// / intent:// スキーム書き換えはここでは使わない
//     （Capacitor の WebView 上ではむしろ正しく開けず、アプリ内表示になってしまう）。
// - インストール済み PWA（ホーム画面追加）: スコープ外リンク検出／スキーム書き換えで
//   ブラウザ本体へ委譲する（詳細は useIsStandalone.ts）。
// - 通常のブラウザ: 新しいタブ。
export function externalLinkProps(
  url: string,
  isStandalone: boolean
): { href: string; target: string | undefined; rel: string | undefined } {
  if (Capacitor.isNativePlatform()) {
    return { href: url, target: "_blank", rel: "noopener noreferrer" };
  }
  if (isStandalone) {
    return { href: toStandaloneExternalHref(url), target: undefined, rel: undefined };
  }
  return { href: url, target: "_blank", rel: "noopener noreferrer" };
}
