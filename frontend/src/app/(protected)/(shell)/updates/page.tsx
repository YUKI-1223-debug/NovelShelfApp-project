"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/BookCover";
import { ApiError, updatesApi, type Novel } from "@/lib/api";

export default function UpdatesPage() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setNovels(await updatesApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新一覧の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => load());
  }, [load]);

  async function checkUpdates() {
    setChecking(true);
    setMessage(null);
    try {
      await updatesApi.check();
      setMessage("更新確認をリクエストしました。反映まで少し時間がかかる場合があります。");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "更新確認のリクエストに失敗しました。");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">更新一覧</h1>
        <button
          onClick={checkUpdates}
          disabled={checking}
          className="rounded-full border border-accent px-3 py-1.5 text-xs font-semibold text-accent-soft disabled:opacity-50"
        >
          {checking ? "確認中..." : "更新を確認"}
        </button>
      </div>

      {message && <p className="text-xs text-muted">{message}</p>}
      {error && <p className="text-sm text-update">{error}</p>}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted">読み込み中...</p>
      ) : novels.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          更新のある作品はありません。本棚の作品は自動では確認されないため、「更新を確認」を押すと最新話数を取得します。
        </p>
      ) : (
        <div className="flex flex-col gap-2.5 pb-6">
          {novels.map((novel) => (
            <Link
              key={novel.id}
              href={`/novels/${novel.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
            >
              <BookCover novelId={novel.id} title={novel.title} className="w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-tight">{novel.title}</p>
                <p className="truncate text-xs text-muted">{novel.author}</p>
                <span className="mt-1 inline-block rounded bg-update-tint px-1.5 py-0.5 text-[10px] font-bold text-update">
                  全{novel.latestKnownChapterNo}話まで更新
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
