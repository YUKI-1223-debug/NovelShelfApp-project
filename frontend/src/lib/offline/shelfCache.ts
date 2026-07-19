// 本棚一覧(フィルタなしの全件)の端末内キャッシュ。
// オフライン時は最後に取得できたこの一覧を、画面側でクライアント側フィルタして表示する。
"use client";

import { SHELF_STORE as STORE_NAME, openDb } from "./db";
import type { BookshelfEntry } from "@/lib/api";

const CACHE_KEY = "current";

export async function putCachedShelf(entries: BookshelfEntry[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entries, CACHE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedShelf(): Promise<BookshelfEntry[] | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  const db = await openDb();
  const result = await new Promise<BookshelfEntry[] | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(CACHE_KEY);
    req.onsuccess = () => resolve(req.result as BookshelfEntry[] | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}
