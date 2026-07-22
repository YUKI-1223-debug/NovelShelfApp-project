"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AddNovelDialog } from "@/components/AddNovelDialog";
import { ChartIcon, ExternalLinkIcon, HeartIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { ApiError, shelfApi, type BookshelfEntry, type ShelfSortOrder, type ShelfStatus } from "@/lib/api";
import { getCachedShelf, putCachedShelf } from "@/lib/offline/shelfCache";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { toStandaloneExternalHref, useIsStandalone } from "@/lib/utils/useIsStandalone";

type FilterKey = "ALL" | ShelfStatus | "FAVORITE" | "UPDATED";

// サーバー側のフィルタ(shelfApi.list)と同じ条件をキャッシュデータに対して再現する。
function filterCachedEntries(entries: BookshelfEntry[], key: FilterKey): BookshelfEntry[] {
  if (key === "FAVORITE") return entries.filter((e) => e.isFavorite);
  if (key === "ALL" || key === "UPDATED") return entries;
  return entries.filter((e) => e.status === key);
}

// サーバー側のsort=recentと同じ順序(最終閲読日時の降順、未読了は追加日時の降順で末尾)をキャッシュデータに対して再現する。
function sortCachedEntries(entries: BookshelfEntry[], sortOrder: ShelfSortOrder): BookshelfEntry[] {
  if (sortOrder !== "RECENT_DESC") return entries;
  return [...entries].sort((a, b) => {
    if (a.lastReadAt && b.lastReadAt) return b.lastReadAt.localeCompare(a.lastReadAt);
    if (a.lastReadAt) return -1;
    if (b.lastReadAt) return 1;
    return b.addedAt.localeCompare(a.addedAt);
  });
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "すべて" },
  { key: "READING", label: "読書中" },
  { key: "FAVORITE", label: "お気に入り" },
  { key: "COMPLETED", label: "読了" },
  { key: "READ_LATER", label: "あとで読む" },
  { key: "UPDATED", label: "更新あり" },
];

const SORTS: { key: ShelfSortOrder; label: string }[] = [
  { key: "ADDED_DESC", label: "追加順" },
  { key: "RECENT_DESC", label: "最近読んだ順" },
];

export default function BookshelfPage() {
  const { settings, update: updateSettings, isLoading: settingsLoading } = useSettings();
  // shelfSortOrderは既存ユーザーのDB上の既定値("UPDATED_DESC")を引きずっている場合があるため、
  // 未知の値は「追加順」扱いに正規化する(選択操作で正規の値に上書きされる)。
  const sortOrder: ShelfSortOrder = settings.shelfSortOrder === "RECENT_DESC" ? "RECENT_DESC" : "ADDED_DESC";

  const [entries, setEntries] = useState<BookshelfEntry[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // PWAのスタンドアロン表示ではwindow.confirm()が機能しない(何も表示されず即falseになる)
  // 端末があったため、ネイティブダイアログではなく画面内の確認バーで代用する。
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isStandalone = useIsStandalone();

  const load = useCallback(async (key: FilterKey, sort: ShelfSortOrder) => {
    setIsLoading(true);
    setError(null);
    setFromCache(false);
    const sortParam = sort === "RECENT_DESC" ? "recent" : undefined;
    try {
      if (key === "FAVORITE") {
        setEntries(await shelfApi.list({ favorite: true, sort: sortParam }));
      } else if (key === "ALL" || key === "UPDATED") {
        const result = await shelfApi.list({ sort: sortParam });
        setEntries(result);
        putCachedShelf(result).catch(() => {});
      } else {
        setEntries(await shelfApi.list({ status: key, sort: sortParam }));
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        return;
      }
      // ネットワーク自体の失敗(オフライン)。最後に取得できた本棚をキャッシュから表示する。
      const cached = await getCachedShelf();
      if (cached) {
        setEntries(sortCachedEntries(filterCachedEntries(cached, key), sort));
        setFromCache(true);
      } else {
        setError("本棚の取得に失敗しました。");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (settingsLoading) return;
    queueMicrotask(() => load(filter, sortOrder));
  }, [filter, sortOrder, settingsLoading, load]);

  const visibleEntries = filter === "UPDATED" ? entries.filter((e) => e.novel.hasUpdate) : entries;

  async function toggleFavorite(entry: BookshelfEntry) {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, isFavorite: !e.isFavorite } : e)));
    try {
      await shelfApi.update(entry.id, { isFavorite: !entry.isFavorite });
    } catch {
      load(filter, sortOrder);
    }
  }

  function toggleSelect(entryId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setConfirmingDelete(false);
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    setConfirmingDelete(false);
    await Promise.all(ids.map((id) => shelfApi.remove(id).catch(() => {})));
    exitSelectMode();
    load(filter, sortOrder);
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">本棚</h1>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={selectedIds.size === 0}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-update disabled:opacity-40"
                aria-label={`選択した${selectedIds.size}件を削除`}
              >
                <TrashIcon className="h-5 w-5" />
              </button>
              <button onClick={exitSelectMode} className="px-2 text-xs font-medium text-muted">
                キャンセル
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setSelectMode(true)} className="px-2 text-xs font-medium text-muted">
                選択
              </button>
              <Link
                href="/stats"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted"
                aria-label="読書統計"
              >
                <ChartIcon className="h-5 w-5" />
              </Link>
              <button
                onClick={() => dialogRef.current?.showModal()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground"
                aria-label="作品を追加"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-update bg-update-tint px-3 py-2">
          <p className="text-xs text-update">選択した{selectedIds.size}件を本棚から削除しますか？</p>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setConfirmingDelete(false)}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-muted"
            >
              やめる
            </button>
            <button
              onClick={deleteSelected}
              className="rounded-full bg-update px-2.5 py-1 text-xs font-semibold text-white"
            >
              削除する
            </button>
          </div>
        </div>
      )}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setSelectedIds(new Set());
            }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
              filter === f.key
                ? "border-accent bg-accent-tint text-accent-soft"
                : "border-border text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          並び順
          <select
            value={sortOrder}
            onChange={(e) => updateSettings({ shelfSortOrder: e.target.value as ShelfSortOrder })}
            className="rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-update">{error}</p>}
      {fromCache && (
        <p className="text-xs text-muted">オフライン中のため、最後に取得した本棚を表示しています。</p>
      )}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted">読み込み中...</p>
      ) : visibleEntries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          まだ作品がありません。右上の「＋」からURLを追加してください。
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {visibleEntries.map((entry) => {
            const isSelected = selectedIds.has(entry.id);
            const rowBody = (
              <>
                <div className="flex items-center gap-1.5">
                  {entry.novel.hasUpdate && (
                    <span className="shrink-0 rounded bg-update-tint px-1.5 py-0.5 text-[10px] font-bold text-update">
                      更新
                    </span>
                  )}
                  <p className="truncate text-sm font-semibold">{entry.novel.title}</p>
                </div>
                <p className="truncate text-xs text-muted">{entry.novel.author}</p>
                {sortOrder === "RECENT_DESC" && (
                  <p className="truncate text-[11px] text-muted">
                    {entry.lastReadAt
                      ? `最終閲読: ${new Date(entry.lastReadAt).toLocaleDateString("ja-JP")}`
                      : "未読"}
                  </p>
                )}
              </>
            );
            return (
              <div key={entry.id} className="flex items-center gap-2 py-3">
                {selectMode ? (
                  <button onClick={() => toggleSelect(entry.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected ? "border-accent bg-accent" : "border-border"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">{rowBody}</span>
                  </button>
                ) : (
                  <Link href={`/novels/${entry.novel.id}`} className="min-w-0 flex-1">
                    {rowBody}
                  </Link>
                )}
                {!selectMode && entry.novel.latestKnownChapterNo === 0 && (
                  <a
                    href={isStandalone ? toStandaloneExternalHref(entry.novel.sourceUrl) : entry.novel.sourceUrl}
                    target={isStandalone ? undefined : "_blank"}
                    rel={isStandalone ? undefined : "noopener noreferrer"}
                    aria-label="外部サイトで開く"
                    className="shrink-0 text-muted"
                  >
                    <ExternalLinkIcon className="h-5 w-5" />
                  </a>
                )}
                {!selectMode && (
                  <button onClick={() => toggleFavorite(entry)} aria-label="お気に入り切替" className="shrink-0">
                    <HeartIcon
                      filled={entry.isFavorite}
                      className={`h-5 w-5 ${entry.isFavorite ? "text-update" : "text-muted"}`}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddNovelDialog ref={dialogRef} onAdded={() => load(filter, sortOrder)} />
    </div>
  );
}
