"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

// ネイティブアプリ（Capacitor）専用の橋渡し。Web では何もしない。
// - Android のハードウェア戻るボタン: 履歴があれば戻る、無ければアプリを終了する
//   （既定動作の「即終了」は読書中の誤タップで抜けてしまうため）。
export function CapacitorBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handle = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack || window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    return () => {
      handle.then((h) => h.remove());
    };
  }, []);

  return null;
}
