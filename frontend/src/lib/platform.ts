/**
 * Windows デスクトップアプリ(Tauri)の WebView2 上で動いているか。
 * `window.__TAURI_INTERNALS__` は Tauri が常に注入するグローバル(AI秘書の lib/platform.ts と同じ判定)。
 */
export function isTauriPlatform(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}
