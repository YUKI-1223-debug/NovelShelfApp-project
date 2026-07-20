"use client";

// 音量ボタンページ送りのON/OFFは端末ローカルのlocalStorageに保持する（useVolumeButtonPaging.ts参照）。
// useSyncExternalStoreで購読することで、SSR時のサーバースナップショット(false)とクライアントの
// 実際の値がズレてもハイドレーションエラーにならず、同一タブ内でのトグル操作も即座に反映される。
const STORAGE_KEY = "novelshelf.volumeButtonPaging";
const CHANGE_EVENT = "novelshelf:volume-button-paging-changed";

export function getVolumeButtonPagingPref(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function getVolumeButtonPagingPrefServerSnapshot(): boolean {
  return false;
}

export function setVolumeButtonPagingPref(value: boolean): void {
  localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeVolumeButtonPagingPref(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
