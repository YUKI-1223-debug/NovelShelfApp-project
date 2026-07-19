// オフライン中に送れなかった読書位置更新の端末内キュー。
// 作品ごとに最新の1件だけを保持し、オンライン復帰時にまとめてサーバーへ送る。
"use client";

import { PENDING_POSITION_STORE as STORE_NAME, openDb } from "./db";
import { ApiError, readingApi } from "@/lib/api";

export interface PendingPosition {
  novelId: string;
  chapterId: string;
  scrollPosition: number;
  queuedAt: number;
}

export async function queuePendingPosition(
  novelId: string,
  chapterId: string,
  scrollPosition: number
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ novelId, chapterId, scrollPosition, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getPendingPositions(): Promise<PendingPosition[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const result = await new Promise<PendingPosition[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as PendingPosition[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

async function clearPendingPosition(novelId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(novelId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// 送信に失敗したものはキューに残し、次回のオンライン復帰時に再試行する。
export async function flushPendingPositions(): Promise<void> {
  const pending = await getPendingPositions();
  for (const p of pending) {
    try {
      await readingApi.putPosition(p.novelId, p.chapterId, p.scrollPosition);
      await clearPendingPosition(p.novelId);
    } catch (err) {
      if (err instanceof ApiError) {
        await clearPendingPosition(p.novelId);
      }
    }
  }
}
