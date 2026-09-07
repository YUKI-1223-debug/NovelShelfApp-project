"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/lib/auth/AuthProvider";
import { pushApi } from "@/lib/api";
import { routes } from "@/lib/routes";

const LAST_TOKEN_KEY = "novelshelf.pushToken";

// Firebase の設定ファイル（Android: google-services.json / iOS: GoogleService-Info.plist）が
// 無いとネイティブ側の初期化で落ちるため、設定ファイルを同梱してビルドするときだけ
// NEXT_PUBLIC_PUSH_ENABLED=true にする（build:app では既定で true）。
const PUSH_ENABLED = process.env.NEXT_PUBLIC_PUSH_ENABLED === "true";

// @capacitor-firebase/messaging は Android / iOS の両方で FCM トークンを返す
// （iOS は APNs → FCM をプラグイン内部でブリッジする）。バックエンドは一貫して FCM トークンを
// 期待するため、iOS もこのプラグイン経由で登録する。
const PUSH_PLATFORMS = new Set(["android", "ios"]);

// アプリ側で作成する通知チャンネル ID（Android）。
// バックエンド FirebasePushSender.ANDROID_CHANNEL_ID と一致させること。
const ANDROID_CHANNEL_ID = "novelshelf-updates";

function extractNovelId(data: unknown): string | null {
  if (data && typeof data === "object" && "novelId" in data) {
    const value = (data as Record<string, unknown>).novelId;
    if (typeof value === "string" && value) return value;
  }
  return null;
}

// ネイティブアプリ（Capacitor）でのプッシュ通知のセットアップ。Web では何もしない。
// - ログイン中: 権限リクエスト → FCM トークン取得 → サーバーへ登録
// - ログアウト時: 登録済みトークンをサーバーから解除し、端末側のトークンも破棄
// - 通知タップ: data.novelId があればその作品画面へ遷移
export function PushNotifications() {
  const { isAuthenticated, isReady } = useAuth();
  const router = useRouter();
  const registeredTokenRef = useRef<string | null>(null);
  const listenersReadyRef = useRef(false);

  useEffect(() => {
    if (!PUSH_ENABLED || !Capacitor.isNativePlatform() || !isReady) return;
    if (!PUSH_PLATFORMS.has(Capacitor.getPlatform())) return;
    let cancelled = false;

    const registerToken = (token: string) => {
      registeredTokenRef.current = token;
      try {
        localStorage.setItem(LAST_TOKEN_KEY, token);
      } catch {
        /* プライベートモード等。登録自体は続行する */
      }
      const platform = Capacitor.getPlatform() === "ios" ? "IOS" : "ANDROID";
      pushApi.registerDevice(platform, token).catch(() => {
        // 失敗しても致命的ではない。次回起動時に再試行される。
      });
    };

    (async () => {
      const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

      if (!listenersReadyRef.current) {
        listenersReadyRef.current = true;

        // 音・ヘッドアップ表示が出る通知チャンネル（Android 8+）。iOS では no-op。
        if (Capacitor.getPlatform() === "android") {
          FirebaseMessaging.createChannel({
            id: ANDROID_CHANNEL_ID,
            name: "作品の更新",
            description: "本棚の作品に新しい話が公開されたときの通知",
            importance: 5, // Importance.Max
            visibility: 1, // Visibility.Public
            vibration: true,
          }).catch(() => {});
        }

        // トークンは初回だけでなくローテーションでも飛んでくる。届いたら都度サーバーへ登録し直す。
        await FirebaseMessaging.addListener("tokenReceived", (event) => {
          if (event.token) registerToken(event.token);
        });

        await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
          const novelId = extractNovelId(event.notification.data);
          if (novelId) router.push(routes.novel(novelId));
        });
      }

      if (isAuthenticated) {
        try {
          let status = (await FirebaseMessaging.checkPermissions()).receive;
          if (status === "prompt" || status === "prompt-with-rationale") {
            status = (await FirebaseMessaging.requestPermissions()).receive;
          }
          if (!cancelled && status === "granted") {
            const { token } = await FirebaseMessaging.getToken();
            if (!cancelled && token) registerToken(token);
          }
        } catch {
          // FCM 非対応端末・設定不備でも通知以外の機能は継続動作させる。
        }
      } else {
        // ログアウト: 登録済みトークンを解除し、端末側のトークンも破棄する。
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
          FirebaseMessaging.deleteToken().catch(() => {});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isReady, router]);

  return null;
}
