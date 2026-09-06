"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/lib/auth/AuthProvider";
import { pushApi } from "@/lib/api";
import { routes } from "@/lib/routes";

const LAST_TOKEN_KEY = "novelshelf.pushToken";

// Capacitor の push プラグインの register() は google-services.json が無いと
// ネイティブ側で FATAL 例外を投げてアプリごと落ちる。Firebase の設定ファイルを
// android/app/ に配置してビルドするときだけ NEXT_PUBLIC_PUSH_ENABLED=true にする。
const PUSH_ENABLED = process.env.NEXT_PUBLIC_PUSH_ENABLED === "true";

// ネイティブアプリ（Capacitor）でのプッシュ通知のセットアップ。Web では何もしない。
// - ログイン中: 権限リクエスト → FCM トークン取得 → サーバーへ登録
// - ログアウト時: 登録済みトークンをサーバーから解除
// - 通知タップ: data.novelId があればその作品画面へ遷移
export function PushNotifications() {
  const { isAuthenticated, isReady } = useAuth();
  const router = useRouter();
  const registeredTokenRef = useRef<string | null>(null);
  const listenersReadyRef = useRef(false);

  useEffect(() => {
    if (!PUSH_ENABLED || !Capacitor.isNativePlatform() || !isReady) return;
    let cancelled = false;

    (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");

      if (!listenersReadyRef.current) {
        listenersReadyRef.current = true;

        await PushNotifications.addListener("registration", (token) => {
          registeredTokenRef.current = token.value;
          try {
            localStorage.setItem(LAST_TOKEN_KEY, token.value);
          } catch {
            /* プライベートモード等。登録自体は続行する */
          }
          const platform = Capacitor.getPlatform() === "ios" ? "IOS" : "ANDROID";
          pushApi.registerDevice(platform, token.value).catch(() => {
            // 失敗しても致命的ではない。次回起動時に再試行される。
          });
        });

        await PushNotifications.addListener("registrationError", () => {
          // 端末が FCM 非対応（GMS 無し等）。通知以外の機能はそのまま使える。
        });

        await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const novelId = action.notification.data?.novelId;
          if (typeof novelId === "string" && novelId) {
            router.push(routes.novel(novelId));
          }
        });
      }

      if (isAuthenticated) {
        const perm = await PushNotifications.checkPermissions();
        let status = perm.receive;
        if (status === "prompt" || status === "prompt-with-rationale") {
          status = (await PushNotifications.requestPermissions()).receive;
        }
        if (!cancelled && status === "granted") {
          await PushNotifications.register();
        }
      } else {
        // ログアウト: 登録済みトークンを解除
        let token = registeredTokenRef.current;
        if (!token) {
          try {
            token = localStorage.getItem(LAST_TOKEN_KEY);
          } catch {
            token = null;
          }
        }
        if (token) {
          pushApi.unregisterDevice(token).catch(() => {});
          registeredTokenRef.current = null;
          try {
            localStorage.removeItem(LAST_TOKEN_KEY);
          } catch {
            /* noop */
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isReady, router]);

  return null;
}
