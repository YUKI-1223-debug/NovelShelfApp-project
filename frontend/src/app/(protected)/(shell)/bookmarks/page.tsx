"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrashIcon } from "@/components/icons";
import { ApiError, bookmarksApi, type Bookmark } from "@/lib/api";

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bookmarksApi
      .list()
      .then(setBookmarks)
      .catch((err) => setError(err instanceof ApiError ? err.message : "しおりの取得に失敗しました。"))
      .finally(() => setIsLoading(false));
  }, []);

  async function remove(id: string) {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    try {
      await bookmarksApi.remove(id);
    } catch {
      // 失敗時は次回一覧再取得で復元される
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <h1 className="text-xl font-bold">しおり</h1>

      {error && <p className="text-sm text-update">{error}</p>}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted">読み込み中...</p>
      ) : bookmarks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">しおりはまだありません。読書画面から追加できます。</p>
      ) : (
        <div className="flex flex-col gap-2.5 pb-6">
          {bookmarks.map((b) => (
            <div key={b.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={b.novelId ? `/novels/${b.novelId}/chapters/${b.chapterId}` : "#"}
                  className="min-w-0 flex-1"
                >
                  <p className="text-sm font-bold">{b.name}</p>
                  <p className="truncate text-xs text-muted">
                    {b.chapterNo ? `第${b.chapterNo}話 ${b.chapterTitle}` : b.chapterTitle}
                  </p>
                </Link>
                <button onClick={() => remove(b.id)} aria-label="削除">
                  <TrashIcon className="h-4 w-4 text-muted" />
                </button>
              </div>
              {b.memo && <p className="mt-1.5 text-xs text-foreground/80">{b.memo}</p>}
              {b.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {b.tags.map((t) => (
                    <span key={t.id} className="rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-semibold text-accent-soft">
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
