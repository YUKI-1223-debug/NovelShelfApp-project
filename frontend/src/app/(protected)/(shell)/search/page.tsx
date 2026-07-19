"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/BookCover";
import { ApiError, novelsApi, sitesApi, tagsApi, type Novel, type Site, type SiteCode, type Tag } from "@/lib/api";
import { genreOptionsForSite, genreLabel } from "@/lib/utils/genreLabels";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [siteFilter, setSiteFilter] = useState<SiteCode | null>(null);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [results, setResults] = useState<Novel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      sitesApi.list().then(setSites).catch(() => {});
      tagsApi.list().then(setTags).catch(() => {});
    });
  }, []);

  function selectSite(code: SiteCode | null) {
    setSiteFilter(code);
    setGenreFilter(null);
  }

  const runSearch = useCallback(async () => {
    if (!q.trim() && !genreFilter && !tagFilter) {
      setResults([]);
      setSearched(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const found = await novelsApi.search({
        q: q.trim() || undefined,
        site: siteFilter ?? undefined,
        genre: genreFilter ?? undefined,
        tag: tagFilter ?? undefined,
      });
      setResults(found);
      setSearched(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "検索に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [q, siteFilter, genreFilter, tagFilter]);

  const genreOptions = genreOptionsForSite(siteFilter);

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
            onClick={() => selectSite(null)}
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
              onClick={() => selectSite(s.code)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                siteFilter === s.code ? "border-accent bg-accent-tint text-accent-soft" : "border-border text-muted"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {genreOptions.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <button
              type="button"
              onClick={() => setGenreFilter(null)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                genreFilter === null ? "border-accent bg-accent-tint text-accent-soft" : "border-border text-muted"
              }`}
            >
              すべてのジャンル
            </button>
            {genreOptions.map((g) => (
              <button
                key={g.code}
                type="button"
                onClick={() => setGenreFilter(g.code)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  genreFilter === g.code ? "border-accent bg-accent-tint text-accent-soft" : "border-border text-muted"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <button
              type="button"
              onClick={() => setTagFilter(null)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                tagFilter === null ? "border-accent bg-accent-tint text-accent-soft" : "border-border text-muted"
              }`}
            >
              すべてのタグ
            </button>
            {tags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTagFilter(t.name)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  tagFilter === t.name ? "border-accent bg-accent-tint text-accent-soft" : "border-border text-muted"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
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
              {genreLabel(novel.site, novel.genre) && (
                <p className="truncate text-[10px] text-muted/80">{genreLabel(novel.site, novel.genre)}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
