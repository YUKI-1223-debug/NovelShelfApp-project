// 話本文の端末内キャッシュ（簡易版）。
// IndexedDBにそのまま保存しており、Phase1で要求している暗号化・容量表示・上限設定は未実装（docs/KNOWN_ISSUES.md参照）。
"use client";

export interface CachedChapter {
  chapterId: string;
  novelId: string;
  chapterNo: number;
  title: string;
  bodyHtml: string;
  sourceUrl: string;
  cachedAt: number;
}

const DB_NAME = "novelshelf-cache";
const STORE_NAME = "chapters";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "chapterId" });
        store.createIndex("novelId", "novelId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putCachedChapter(chapter: Omit<CachedChapter, "cachedAt">): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ ...chapter, cachedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedChapter(chapterId: string): Promise<CachedChapter | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  const db = await openDb();
  const result = await new Promise<CachedChapter | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(chapterId);
    req.onsuccess = () => resolve(req.result as CachedChapter | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function getCachedChapterIdsForNovel(novelId: string): Promise<Set<string>> {
  if (typeof indexedDB === "undefined") return new Set();
  const db = await openDb();
  const ids = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("novelId");
    const req = index.getAllKeys(IDBKeyRange.only(novelId));
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return new Set(ids);
}
