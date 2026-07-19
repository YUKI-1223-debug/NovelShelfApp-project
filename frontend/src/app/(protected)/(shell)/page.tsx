"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AddNovelDialog } from "@/components/AddNovelDialog";
import { BookCover } from "@/components/BookCover";
import { ChartIcon, HeartIcon, PlusIcon } from "@/components/icons";
import { ApiError, shelfApi, type BookshelfEntry, type ShelfStatus } from "@/lib/api";

type FilterKey = "ALL" | ShelfStatus | "FAVORITE" | "UPDATED";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "すべて" },
  { key: "READING", label: "読書中" },
  { key: "FAVORITE", label: "お気に入り" },
  { key: "COMPLETED", label: "読了" },
  { key: "READ_LATER", label: "あとで読む" },
  { key: "UPDATED", label: "更新あり" },
];

export default function BookshelfPage() {
  const [entries, setEntries] = useState<BookshelfEntry[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(async (key: FilterKey) => {
    setIsLoading(true);
    setError(null);
    try {
      if (key === "FAVORITE") {
        setEntries(await shelfApi.list({ favorite: true }));
      } else if (key === "ALL" || key === "UPDATED") {
        setEntries(await shelfApi.list());
      } else {
        setEntries(await shelfApi.list({ status: key }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "本棚の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => load(filter));
  }, [filter, load]);

  const visibleEntries = filter === "UPDATED" ? entries.filter((e) => e.novel.hasUpdate) : entries;

  async function toggleFavorite(entry: BookshelfEntry) {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, isFavorite: !e.isFavorite } : e)));
    try {
      await shelfApi.update(entry.id, { isFavorite: !entry.isFavorite });
    } catch {
      load(filter);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">本棚</h1>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
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

      {error && <p className="text-sm text-update">{error}</p>}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted">読み込み中...</p>
      ) : visibleEntries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          まだ作品がありません。右上の「＋」からURLを追加してください。
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {visibleEntries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-1.5">
              <Link href={`/novels/${entry.novel.id}`} className="relative block">
                <BookCover novelId={entry.novel.id} title={entry.novel.title} className="w-full" />
                {entry.novel.hasUpdate && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-update-tint px-1.5 py-0.5 text-[10px] font-bold text-update">
                    更新
                  </span>
                )}
              </Link>
              <div className="flex items-start justify-between gap-1">
                <Link href={`/novels/${entry.novel.id}`} className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-semibold leading-tight">{entry.novel.title}</p>
                  <p className="truncate text-[11px] text-muted">{entry.novel.author}</p>
                </Link>
                <button onClick={() => toggleFavorite(entry)} aria-label="お気に入り切替">
                  <HeartIcon
                    filled={entry.isFavorite}
                    className={`h-4 w-4 shrink-0 ${entry.isFavorite ? "text-update" : "text-muted"}`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddNovelDialog ref={dialogRef} onAdded={() => load(filter)} />
    </div>
  );
}
