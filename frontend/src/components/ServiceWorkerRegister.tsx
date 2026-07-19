"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // オフライン起動は付加価値機能のため、登録失敗時もアプリ自体は継続動作させる
      });
    }
  }, []);

  return null;
}
