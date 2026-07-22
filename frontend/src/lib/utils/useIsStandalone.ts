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
