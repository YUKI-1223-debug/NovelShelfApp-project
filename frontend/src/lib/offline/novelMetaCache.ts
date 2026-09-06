// 作品詳細 + 話一覧の端末内キャッシュ。画面遷移のたびの「空白→スピナー→数秒待ち」を避け、
// まず前回の内容を即表示してから裏で最新を取りに行く（stale-while-revalidate）ために使う。
"use client";

import { NOVEL_META_STORE as STORE_NAME, openDb } from "./db";
import type { Chapter, NovelDetail } from "@/lib/api";

interface CachedNovelMeta {
  novelId: string;
  detail: NovelDetail;
  chapters: Chapter[];
  cachedAt: number;
}

export async function putCachedNovelMeta(novelId: string, detail: NovelDetail, chapters: Chapter[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ novelId, detail, chapters, cachedAt: Date.now() } satisfies CachedNovelMeta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedNovelMeta(
  novelId: string
): Promise<{ detail: NovelDetail; chapters: Chapter[] } | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  const db = await openDb();
  const result = await new Promise<CachedNovelMeta | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(novelId);
    req.onsuccess = () => resolve(req.result as CachedNovelMeta | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result ? { detail: result.detail, chapters: result.chapters } : undefined;
}
