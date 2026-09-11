// 読書位置の端末内キャッシュ（stale-while-revalidate用）。
//
// 「読書画面で長時間放置していると反応が止まる/ボタンが一瞬古い表示になる」不具合対応
// （2026-09-12、ユーザー報告）: 作品詳細画面の「続きから読む」判定、読書画面のスクロール復元
// 位置は、いずれも毎回サーバーから読書位置を取り直していた。ネットワークが遅い/再接続直後
// （アプリが長時間バックグラウンド後にフォアグラウンド復帰した直後など）はこの往復が
// 数百ms〜1秒以上かかり、その間ボタン操作が効かないように見えていた。
// 直近の値をここに保存しておき、画面表示にはまずこちらを即使う（正確な最新値はバックグラウンドで
// 取得してキャッシュを更新するだけに留め、表示中の位置を後から動かして「読んでいる最中に
// 飛ぶ」体験にはしない）。
"use client";

import { POSITION_STORE as STORE_NAME, openDb } from "./db";
import type { ReadingPosition } from "@/lib/api";

export async function putCachedPosition(novelId: string, position: ReadingPosition): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(position);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedPosition(novelId: string): Promise<ReadingPosition | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  const db = await openDb();
  const result = await new Promise<ReadingPosition | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(novelId);
    req.onsuccess = () => resolve(req.result as ReadingPosition | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}
