"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/BookCover";
import { ApiError, novelsApi, sitesApi, type Novel, type Site, type SiteCode } from "@/lib/api";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [siteFilter, setSiteFilter] = useState<SiteCode | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [results, setResults] = useState<Novel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      sitesApi.list().then(setSites).catch(() => {});
    });
  }, []);

  const runSearch = useCallback(async () => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const found = await novelsApi.search({ q: q.trim(), site: siteFilter ?? undefined });
      setResults(found);
      setSearched(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "検索に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [q, siteFilter]);

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <h1 className="text-xl font-bold">検索</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
        className="flex flex-col gap-3"
      >
        <input
          type="search"
          placeholder="タイトルまたは作者名"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <button
            type="button"
            onClick={() => setSiteFilter(null)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
              siteFilter === null ? "border-accent bg-accent-tint text-accent-soft" : "border-border text-muted"
            }`}
          >
            すべてのサイト
          </button>
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSiteFilter(s.code)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                siteFilter === s.code ? "border-accent bg-accent-tint text-accent-soft" : "border-border text-muted"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
        >
          検索
        </button>
      </form>

      {error && <p className="text-sm text-update">{error}</p>}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted">検索中...</p>
      ) : searched && results.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">該当する作品が見つかりませんでした。</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 pb-6 sm:grid-cols-4 md:grid-cols-6">
          {results.map((novel) => (
            <Link key={novel.id} href={`/novels/${novel.id}`} className="flex flex-col gap-1.5">
              <BookCover novelId={novel.id} title={novel.title} className="w-full" />
              <p className="line-clamp-2 text-xs font-semibold leading-tight">{novel.title}</p>
              <p className="truncate text-[11px] text-muted">{novel.author}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
