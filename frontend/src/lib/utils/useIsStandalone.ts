import { useSyncExternalStore } from "react";

const QUERY = "(display-mode: standalone)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

// インストール済みPWA（standaloneウィンドウ）内でtarget="_blank"のリンクを踏むと、
// 通常のChromeタブではなくタブバーのない簡易ウィンドウが開いてしまい、閉じるまで
// アプリに戻れず不便（実機確認、2026-07-22）。standalone時はtarget属性を外し、
// 通常のページ内遷移として発生させることで、Chrome/EdgeのPWAスコープ外リンク検出が働き、
// アプリのウィンドウはそのままに既定ブラウザの新しいタブで開かせる。
export function useIsStandalone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+はUser-AgentがmacOSと同一になるため、タッチポイント数で判別する。
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
}

// iOSのホーム画面追加アプリ(standalone)はChrome/Edgeのスコープ外リンク検出を持たず、
// target="_blank"にしてもSafari本体ではなくアプリ内WKWebViewの簡易ブラウザが開くだけで
// アプリから抜け出せない（実機確認、2026-07-22）。x-safari-https://スキームでリンクすると
// OSに処理を渡してSafari本体を起動できる（Apple非公式だが広く使われている回避策）。
//
// Androidの「ホーム画面に追加」(WebAPK)も同様で、スコープ外URLへの通常遷移は自動では
// 既定ブラウザに逃げず、アプリ自身のウィンドウ内でそのまま開いてしまう（実機確認、2026-07-22。
// この自動脱出はTrusted Web ActivityとしてPlayストア経由でネイティブアプリ化した場合の挙動で、
// Chromeの「アプリをインストール」だけでは効かない）。intent://スキームでpackageに
// com.android.chromeを明示すると、Android側でChrome本体を別アプリとして起動できる。
// Chrome未インストール等でintentが解決できない場合はS.browser_fallback_urlで通常URLにフォールバックする。
export function toStandaloneExternalHref(url: string): string {
  if (isIOS()) {
    if (url.startsWith("https://")) return url.replace(/^https:\/\//, "x-safari-https://");
    if (url.startsWith("http://")) return url.replace(/^http:\/\//, "x-safari-http://");
    return url;
  }
  if (isAndroid()) {
    const match = url.match(/^(https?):\/\/(.+)$/);
    if (!match) return url;
    const [, scheme, rest] = match;
    return `intent://${rest}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  }
  return url;
}
