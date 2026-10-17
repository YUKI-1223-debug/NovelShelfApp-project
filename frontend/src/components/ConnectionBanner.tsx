"use client";

import { useEffect, useRef, useState } from "react";
import { checkHealth, NETWORK_ERROR_EVENT } from "@/lib/api/client";
import { isServerSleepWindow } from "@/lib/serverSchedule";

const FIRST_RETRY_MS = 10_000;
const MAX_RETRY_MS = 60_000;

/** つながったときに window へ送るイベント。画面側はこれを受けて読み込み直せる */
export const RECONNECTED_EVENT = "api:reconnected";

/**
 * サーバーにつながらないときに画面上部に出す表示(個人利用アプリ化 フェーズ2 設計書 §3-3)。
 * 起動時と、API が通信エラーになったときに接続を確認し、つながらなければ
 * 10 秒 → 20 秒 → 40 秒 → 60 秒(以後 60 秒ごと)の間隔で確認し直す。つながったら消して RECONNECTED_EVENT を送る。
 * オフライン保存した作品はつながらなくても読めるので、画面の操作は止めない。
 */
export function ConnectionBanner() {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  // 「再試行」ボタンから呼ぶ。中身は effect の中で作る(render 中に ref を書き換えないため)
  const retryNowRef = useRef<() => void>(() => {});

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = FIRST_RETRY_MS;
    let wasOffline = false;
    let disposed = false;

    const check = async () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      setChecking(true);
      const ok = await checkHealth();
      if (disposed) return;
      setChecking(false);
      if (ok) {
        setOffline(false);
        delay = FIRST_RETRY_MS;
        if (wasOffline) window.dispatchEvent(new Event(RECONNECTED_EVENT));
        wasOffline = false;
        return;
      }
      wasOffline = true;
      setOffline(true);
      timer = setTimeout(check, delay);
      delay = Math.min(delay * 2, MAX_RETRY_MS);
    };

    retryNowRef.current = () => {
      delay = FIRST_RETRY_MS;
      check();
    };
    check();
    window.addEventListener(NETWORK_ERROR_EVENT, check);
    return () => {
      disposed = true;
      window.removeEventListener(NETWORK_ERROR_EVENT, check);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      className="safe-pt sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
    >
      <span>
        {isServerSleepWindow()
          ? "ミニPCは休止中です（平日 1:00〜7:00）。保存済みの作品は読めます。7:00 以降に自動で再接続します"
          : "サーバーに接続できません — Tailscale が ON か確認してください（保存済みの作品は読めます）"}
      </span>
      <button
        onClick={() => retryNowRef.current()}
        disabled={checking}
        className="shrink-0 rounded-md border border-amber-700/40 px-2 py-1 disabled:opacity-50"
      >
        {checking ? "確認中…" : "再試行"}
      </button>
    </div>
  );
}
