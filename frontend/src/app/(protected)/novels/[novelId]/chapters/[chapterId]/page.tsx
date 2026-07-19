"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AddBookmarkDialog } from "@/components/AddBookmarkDialog";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { ApiError, novelsApi, readingApi } from "@/lib/api";
import type { Chapter } from "@/lib/api";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { getCachedChapter, putCachedChapter } from "@/lib/offline/chapterCache";

const MARGIN_PADDING: Record<string, string> = {
  SMALL: "px-3",
  MEDIUM: "px-6",
  LARGE: "px-10",
};

export default function ReaderPage() {
  const { novelId, chapterId } = useParams<{ novelId: string; chapterId: string }>();
  const router = useRouter();
  const { settings, update } = useSettings();

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [bookmarkScroll, setBookmarkScroll] = useState(0);
  const [fromCache, setFromCache] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bookmarkDialogRef = useRef<HTMLDialogElement>(null);
  const startedAtRef = useRef<number>(0);
  const restoreFractionRef = useRef<number | null>(null);

  const currentIndex = chapters.findIndex((c) => c.id === chapterId);
  const currentChapter = chapters[currentIndex];
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : undefined;
  const nextChapter = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : undefined;

  useEffect(() => {
    novelsApi.chapters(novelId).then(setChapters).catch(() => {});
  }, [novelId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setIsLoading(true);
      setError(null);
      startedAtRef.current = Date.now();

      readingApi
        .getPosition(novelId)
        .then((pos) => {
          if (!cancelled && pos.chapterId === chapterId) {
            restoreFractionRef.current = pos.scrollPosition / 100;
          }
        })
        .catch(() => {});

      const cached = await getCachedChapter(chapterId);
      if (cached && !cancelled) {
        setTitle(cached.title);
        setBodyHtml(cached.bodyHtml);
        setFromCache(true);
        setIsLoading(false);
        return;
      }
      try {
        const content = await novelsApi.content(chapterId);
        if (cancelled) return;
        setTitle(content.title);
        setBodyHtml(content.bodyHtml);
        setFromCache(false);
        const chapterNo = chapters.find((c) => c.id === chapterId)?.chapterNo ?? 0;
        putCachedChapter({
          chapterId,
          novelId,
          chapterNo,
          title: content.title,
          bodyHtml: content.bodyHtml,
          sourceUrl: content.sourceUrl,
        }).catch(() => {});
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "本文の取得に失敗しました。");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, novelId]);

  useEffect(() => {
    if (isLoading || !bodyHtml || restoreFractionRef.current === null) return;
    const fraction = restoreFractionRef.current;
    restoreFractionRef.current = null;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (settings.writingMode === "VERTICAL") {
        const max = el.scrollWidth - el.clientWidth;
        el.scrollLeft = max * (1 - fraction);
      } else {
        const max = el.scrollHeight - el.clientHeight;
        el.scrollTop = max * fraction;
      }
    });
  }, [isLoading, bodyHtml, settings.writingMode]);

  const computeScrollFraction = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return 0;
    let fraction = 0;
    if (settings.writingMode === "VERTICAL") {
      const max = el.scrollWidth - el.clientWidth;
      fraction = max > 0 ? 1 - el.scrollLeft / max : 0;
    } else {
      const max = el.scrollHeight - el.clientHeight;
      fraction = max > 0 ? el.scrollTop / max : 0;
    }
    return Math.max(0, Math.min(1, fraction)) * 100;
  }, [settings.writingMode]);

  const saveProgress = useCallback(() => {
    if (!scrollRef.current) return;
    readingApi.putPosition(novelId, chapterId, computeScrollFraction()).catch(() => {});

    const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
    if (durationSeconds > 2) {
      readingApi.recordHistory(chapterId, new Date().toISOString(), durationSeconds).catch(() => {});
    }
  }, [novelId, chapterId, computeScrollFraction]);

  useEffect(() => {
    return () => {
      saveProgress();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  function goTo(chapter: Chapter | undefined) {
    if (!chapter) return;
    saveProgress();
    router.push(`/novels/${novelId}/chapters/${chapter.id}`);
  }

  const fontClass = settings.fontFamily === "MINCHO" ? "reader-text-mincho" : "reader-text-gothic";
  const paddingClass = MARGIN_PADDING[settings.marginSize] ?? MARGIN_PADDING.MEDIUM;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5 text-sm">
        <button onClick={() => router.push(`/novels/${novelId}`)} className="flex items-center gap-1 text-muted">
          <ChevronLeftIcon className="h-4 w-4" /> 戻る
        </button>
        <span className="truncate px-2 text-xs text-muted">
          {currentChapter ? `第${currentChapter.chapterNo}話 / ${chapters.length}話` : ""}
          {fromCache && " ・ オフライン"}
        </span>
        <button onClick={() => setShowSettings((v) => !v)} className="font-serif text-base font-bold text-muted">
          Aa
        </button>
      </header>

      {showSettings && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 text-xs">
          <button
            onClick={() => update({ writingMode: settings.writingMode === "VERTICAL" ? "HORIZONTAL" : "VERTICAL" })}
            className="rounded-full border border-border px-3 py-1"
          >
            {settings.writingMode === "VERTICAL" ? "縦書き" : "横書き"}
          </button>
          <button
            onClick={() => update({ fontFamily: settings.fontFamily === "MINCHO" ? "GOTHIC" : "MINCHO" })}
            className="rounded-full border border-border px-3 py-1"
          >
            {settings.fontFamily === "MINCHO" ? "明朝" : "ゴシック"}
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => update({ fontSize: Math.max(12, settings.fontSize - 1) })}
              className="h-6 w-6 rounded-full border border-border"
            >
              −
            </button>
            <span>{settings.fontSize}px</span>
            <button
              onClick={() => update({ fontSize: Math.min(28, settings.fontSize + 1) })}
              className="h-6 w-6 rounded-full border border-border"
            >
              ＋
            </button>
          </div>
          <button onClick={() => update({ darkMode: !settings.darkMode })} className="rounded-full border border-border px-3 py-1">
            {settings.darkMode ? "ライトモード" : "ダークモード"}
          </button>
          <button
            onClick={() => {
              setBookmarkScroll(computeScrollFraction());
              bookmarkDialogRef.current?.showModal();
            }}
            className="ml-auto rounded-full bg-accent px-3 py-1 font-semibold text-accent-foreground"
          >
            しおりを追加
          </button>
        </div>
      )}

      <div ref={scrollRef} className={`flex-1 overflow-auto ${paddingClass} py-6`}>
        {isLoading ? (
          <p className="text-center text-sm text-muted">読み込み中...</p>
        ) : error ? (
          <p className="text-center text-sm text-update">{error}</p>
        ) : (
          <div className={settings.writingMode === "VERTICAL" ? "flex h-full justify-end" : "mx-auto max-w-2xl"}>
            <article
              className={
                settings.writingMode === "VERTICAL" ? `writing-vertical h-full ${fontClass}` : fontClass
              }
              style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight }}
            >
              <h1 className="mb-4 text-base font-bold">{title}</h1>
              <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            </article>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <button
          onClick={() => goTo(prevChapter)}
          disabled={!prevChapter}
          className="flex items-center gap-1 text-sm text-muted disabled:opacity-30"
        >
          <ChevronLeftIcon className="h-4 w-4" /> 前の話
        </button>
        <Link href={`/novels/${novelId}`} className="text-xs text-muted underline underline-offset-2">
          話一覧
        </Link>
        <button
          onClick={() => goTo(nextChapter)}
          disabled={!nextChapter}
          className="flex items-center gap-1 text-sm text-muted disabled:opacity-30"
        >
          次の話 <ChevronRightIcon className="h-4 w-4" />
        </button>
      </footer>

      <AddBookmarkDialog
        ref={bookmarkDialogRef}
        chapterId={chapterId}
        scrollPosition={bookmarkScroll}
        onAdded={() => setShowSettings(false)}
      />
    </div>
  );
}
