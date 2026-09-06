"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export function ServiceWorkerRegister() {
  useEffect(() => {
    // ネイティブアプリ（Capacitor）では画面アセットを端末内にバンドルしており Service Worker は不要。
    // localhost 配信下で登録するとアセット取得に余計な失敗経路が増えるだけなので登録しない。
    if (Capacitor.isNativePlatform()) return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // オフライン起動は付加価値機能のため、登録失敗時もアプリ自体は継続動作させる
      });
    }
  }, []);

  return null;
}
