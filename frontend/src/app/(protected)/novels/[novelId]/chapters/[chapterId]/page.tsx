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
import { queuePendingPosition } from "@/lib/offline/positionQueue";

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
      // 保存済みの読書位置がない(＝初めて開く話)場合も、縦書きでは開始位置(右端)まで
      // 明示的にスクロールする必要があるため、既定値として0(先頭)を入れておく。
      restoreFractionRef.current = 0;

      readingApi
        .getPosition(novelId)
        .then((pos) => {
          if (!cancelled && pos.chapterId === chapterId) {
            restoreFractionRef.current = pos.scrollPosition / 100;
          }
        })
        .catch(() => {});

      // オフラインキャッシュは「ネットワークが使えない場合のフォールバック」としてのみ使う。
      // キャッシュを優先すると、サーバー側で本文が更新（誤字修正・不具合修正等）されても
      // 二度と反映されなくなってしまうため（2026-07-19、ユーザー報告で判明）。
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
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          const cached = await getCachedChapter(chapterId);
          if (!cancelled && cached) {
            setTitle(cached.title);
            setBodyHtml(cached.bodyHtml);
            setFromCache(true);
          } else if (!cancelled) {
            setError("本文の取得に失敗しました。");
          }
        }
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
    const scrollPosition = computeScrollFraction();
    readingApi.putPosition(novelId, chapterId, scrollPosition).catch((err) => {
      // オフライン等でネットワーク自体が失敗した場合のみキューに積む。
      // ApiError（401など、サーバーが応答した上での失敗）は再試行しても直らないためキューに積まない。
      if (!(err instanceof ApiError)) {
        queuePendingPosition(novelId, chapterId, scrollPosition).catch(() => {});
      }
    });

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

  const goTo = useCallback(
    (chapter: Chapter | undefined) => {
      if (!chapter) return;
      saveProgress();
      router.push(`/novels/${novelId}/chapters/${chapter.id}`);
    },
    [saveProgress, router, novelId]
  );

  // 本文の最後までスクロールしたあと、さらにスクロールしようとしたら次の話へ自動的に移動する。
  // 「最後に到達した瞬間」ではなく、そこからさらに一定時間スクロール操作が続いた場合のみ発火させることで、
  // 最終行を読み終えた直後に意図せず次の話へ飛んでしまうのを防ぐ。
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !nextChapter) return;
    let reachedEndAt: number | null = null;
    let advanced = false;

    function handleScroll() {
      if (advanced) return;
      const fraction = computeScrollFraction() / 100;
      if (fraction >= 0.995) {
        if (reachedEndAt === null) {
          reachedEndAt = Date.now();
        } else if (Date.now() - reachedEndAt > 400) {
          advanced = true;
          goTo(nextChapter);
        }
      } else {
        reachedEndAt = null;
      }
    }

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [chapterId, nextChapter, computeScrollFraction, goTo]);

  const fontClass = settings.fontFamily === "MINCHO" ? "reader-text-mincho" : "reader-text-gothic";
  const paddingClass = MARGIN_PADDING[settings.marginSize] ?? MARGIN_PADDING.MEDIUM;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5 text-sm">
        <button onClick={() => router.push(`/novels/${novelId}`)} className="flex items-center gap-1 text-muted">
          <ChevronLeftIcon className="h-4 w-4" /> 戻る
        </button>
        <span className="truncate px-2 text-xs text-muted">
          {currentChapter ? `第${currentChapter.chapterNo}話 / ${chapters.length}話` : ""}
          {fromCache && " ・ オフライン"}
        </span>
        <div className="flex items-center gap-3">
          <Link href={`/novels/${novelId}`} className="text-xs text-muted underline underline-offset-2">
            話一覧
          </Link>
          <button onClick={() => setShowSettings((v) => !v)} className="font-serif text-base font-bold text-muted">
            Aa
          </button>
        </div>
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

      <div ref={scrollRef} className={`min-h-0 flex-1 overflow-auto ${paddingClass} py-6`}>
        {isLoading ? (
          <p className="text-center text-sm text-muted">読み込み中...</p>
        ) : error ? (
          <p className="text-center text-sm text-update">{error}</p>
        ) : (
          <div className={settings.writingMode === "VERTICAL" ? "flex h-full" : "mx-auto max-w-2xl"}>
            {/* justify-endではなくml-autoで右寄せする: はみ出た内容がjustify-content側の
                開始方向(左)に隠れると多くのブラウザでスクロール可能領域として認識されない
                (flexboxのoverflow既知の挙動)ため、はみ出ない場合だけ右寄せされるml-autoを使う。 */}
            <article
              className={
                settings.writingMode === "VERTICAL"
                  ? `writing-vertical ml-auto h-full ${fontClass}`
                  : fontClass
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
          onClick={() => goTo(nextChapter)}
          disabled={!nextChapter}
          className="flex items-center gap-1 text-sm text-muted disabled:opacity-30"
        >
          次の話 <ChevronRightIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => goTo(prevChapter)}
          disabled={!prevChapter}
          className="flex items-center gap-1 text-sm text-muted disabled:opacity-30"
        >
          <ChevronLeftIcon className="h-4 w-4" /> 前の話
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
