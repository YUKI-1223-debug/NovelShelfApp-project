"use client";

export const DB_NAME = "novelshelf-cache";
export const CHAPTER_STORE = "chapters";
export const PENDING_POSITION_STORE = "pendingPositions";
export const SHELF_STORE = "shelfCache";
const DB_VERSION = 3;

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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
