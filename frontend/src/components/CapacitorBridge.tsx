"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { sharePathFromAppUrl } from "@/lib/shareUrl";

// ネイティブアプリ（Capacitor）専用の橋渡し。Web では何もしない。
// - Android のハードウェア戻るボタン: 履歴があれば戻る、無ければアプリを終了する
//   （既定動作の「即終了」は読書中の誤タップで抜けてしまうため）。
// - 共有シートからの追加: Android（MainActivity）・iOS（Share Extension）が渡す novelshelf://share?... を
//   /share 画面に回す。起動中なら appUrlOpen、共有でアプリが起動したときは getLaunchUrl で受け取る（S2-7・S2-8）。
export function CapacitorBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const back = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack || window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    const openShare = (appUrl: string | undefined) => {
      const path = appUrl ? sharePathFromAppUrl(appUrl) : null;
      if (path) router.push(path);
    };
    const urlOpen = App.addListener("appUrlOpen", ({ url }) => openShare(url));
    App.getLaunchUrl()
      .then((launch) => openShare(launch?.url))
      .catch(() => {});

    return () => {
      back.then((h) => h.remove());
      urlOpen.then((h) => h.remove());
    };
  }, [router]);

  return null;
}
