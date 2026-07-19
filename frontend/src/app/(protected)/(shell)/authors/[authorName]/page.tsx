"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BookCover } from "@/components/BookCover";
import { ChevronLeftIcon } from "@/components/icons";
import { ApiError, novelsApi, shelfApi, type BookshelfEntry, type Novel } from "@/lib/api";

export default function AuthorPage() {
  const { authorName } = useParams<{ authorName: string }>();
  const router = useRouter();
  const decodedName = decodeURIComponent(authorName);

  const [novels, setNovels] = useState<Novel[]>([]);
  const [shelfEntries, setShelfEntries] = useState<BookshelfEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      Promise.all([novelsApi.search({ q: decodedName }), shelfApi.list()])
        .then(([foundNovels, entries]) => {
          setNovels(foundNovels.filter((n) => n.author === decodedName));
          setShelfEntries(entries.filter((e) => e.novel.author === decodedName));
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : "取得に失敗しました。"))
        .finally(() => setIsLoading(false));
    });
  }, [decodedName]);

  const completedCount = shelfEntries.filter((e) => e.status === "COMPLETED").length;
  const favoriteCount = shelfEntries.filter((e) => e.isFavorite).length;
  const updatedCount = shelfEntries.filter((e) => e.novel.hasUpdate).length;

  if (isLoading) {
    return <p className="p-6 text-center text-sm text-muted">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted">
        <ChevronLeftIcon className="h-4 w-4" /> 戻る
      </button>

      <h1 className="text-xl font-bold">{decodedName}</h1>

      {error && <p className="text-sm text-update">{error}</p>}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
          <p className="text-lg font-bold tabular-nums">{novels.length}</p>
          <p className="text-[10px] text-muted">全作品</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
          <p className="text-lg font-bold tabular-nums">{completedCount}</p>
          <p className="text-[10px] text-muted">読了</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
          <p className="text-lg font-bold tabular-nums">{favoriteCount}</p>
          <p className="text-[10px] text-muted">お気に入り</p>
        </div>
      </div>

      {updatedCount > 0 && (
        <p className="text-xs text-update">本棚に登録中の作品のうち{updatedCount}件に更新があります。</p>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {novels.map((novel) => (
          <Link key={novel.id} href={`/novels/${novel.id}`} className="flex flex-col gap-1.5">
            <BookCover novelId={novel.id} title={novel.title} className="w-full" />
            <p className="line-clamp-2 text-xs font-semibold leading-tight">{novel.title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
