"use client";

export const DB_NAME = "novelshelf-cache";
export const CHAPTER_STORE = "chapters";
export const PENDING_POSITION_STORE = "pendingPositions";
export const SHELF_STORE = "shelfCache";
export const NOVEL_META_STORE = "novelMeta";
const DB_VERSION = 4;

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHAPTER_STORE)) {
        const store = db.createObjectStore(CHAPTER_STORE, { keyPath: "chapterId" });
        store.createIndex("novelId", "novelId", { unique: false });
      }
      if (!db.objectStoreNames.contains(PENDING_POSITION_STORE)) {
        db.createObjectStore(PENDING_POSITION_STORE, { keyPath: "novelId" });
      }
      if (!db.objectStoreNames.contains(SHELF_STORE)) {
        db.createObjectStore(SHELF_STORE);
      }
      if (!db.objectStoreNames.contains(NOVEL_META_STORE)) {
        // 作品詳細 + 話一覧のキャッシュ（キー = novelId）。画面遷移時の即時表示用。
        db.createObjectStore(NOVEL_META_STORE, { keyPath: "novelId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
