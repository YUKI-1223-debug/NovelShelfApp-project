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

const MARGIN_PX: Record<string, number> = {
  SMALL: 12,
  MEDIUM: 24,
  LARGE: 40,
};

// 縦書き+ページ送りでは、CSS columns側の列幅計算(columnWidth/columnGap)をJS側で事前に
// 予測してscrollLeftを算出する方式だと、ブラウザの内部レイアウト計算との間で数px単位の
// ズレが生じ、ページ境界の文字が視覚的に見切れることがあった（実機検証で確認、
// docs/DECISIONS.mdの2026-07-19エントリ参照）。そのため縦書きでは「予測」をやめ、
// 実際にレンダリングされた各行の絶対x座標を直接測定し、行と行の間の実際の空白（＝本当に
// 何も描画されていない領域）の中央にページ境界(scrollLeft)を置く方式にする。
// 空白の中央である以上、多少の測定誤差があっても文字を切ることはない。
function measureLineStartXs(articleEl: HTMLElement, scrollLeft: number): number[] {
  const xs = new Set<number>();
  const walker = document.createTreeWalker(articleEl, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? "";
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i])) continue;
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      for (const r of range.getClientRects()) {
        if (r.width === 0 || r.height === 0) continue;
        // 同じ行内の文字は縦書きでは同一x（サブピクセル単位でほぼ一致）を共有するため、
        // 四捨五入して丸めることで同一行の文字を確実に同じ値へ集約する。
        xs.add(Math.round(r.left + scrollLeft));
      }
    }
  }
  // <p><br></p>のような空行（テキストノードを持たない）はテキストのスキャンだけでは
  // 検出できず、そこを本文中の隙間と誤認してページ境界を誤検出する原因になっていた
  // （実機検証で確認済み）。空行も1行分のスロットを占めるため、その位置も加える。
  for (const el of articleEl.querySelectorAll("p")) {
    if ((el.textContent ?? "").trim() !== "") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    xs.add(Math.round(r.left + scrollLeft));
  }
  return [...xs].sort((a, b) => b - a); // 降順 = 読み順（右から左）
}

// ページ(CSS多段組の列)境界を「行の間隔が明らかに広い場所」として実測値から直接検出する。
// 事前に「1ページ何行」と決め打ちしない: 決め打ちした行数がブラウザの実際のレイアウトと
// 1行でもズレると、境界が本文の途中に来てしまい文字が見切れる（実機検証で確認済み）。
// 通常の行間(同じ列内)より明らかに広い間隔だけを本当のページ境界とみなす方が頑健。
function computePageBoundariesFromLineXs(lineXs: number[], linePitch: number, scrollWidth: number): number[] {
  if (lineXs.length === 0) return [0];
  if (lineXs.length === 1) return [0];
  const deltas: number[] = [];
  for (let i = 1; i < lineXs.length; i++) {
    deltas.push(lineXs[i - 1] - lineXs[i]);
  }
  const sorted = [...deltas].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || linePitch;
  // 列間の隙間(column-gap)は通常の行間の1.4倍を大きく超えるはず。多少の実機ブレを
  // 吸収しつつ、通常の行間と誤検出しないよう閾値を設定する。
  const threshold = Math.max(median * 1.4, median + linePitch * 0.6);

  const boundaries: number[] = [];
  for (let i = 0; i < deltas.length; i++) {
    if (deltas[i] > threshold) {
      boundaries.push((lineXs[i] + lineXs[i + 1]) / 2);
    }
  }
  // 最後のページは文書の本当の先頭(x=0)まで表示する。
  boundaries.push(0);
  return boundaries.map((b) => Math.max(0, Math.min(scrollWidth, b)));
}

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
  // 読書画面はイマーシブ表示にする: ヘッダー/フッターは既定で隠しておき、本文をタップしたときだけ表示する。
  const [chromeVisible, setChromeVisible] = useState(false);
  const [bookmarkScroll, setBookmarkScroll] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  // ページ送りモード: CSS多段組(columns)で本文を「画面ぴったりの列」に分割し、
  // scrollLeftを列幅ぶんずつ動かすことでページをめくる。列がscrollWidth方向に増える性質は
  // 縦書き(vertical-rl)でも横書きでも変わらないことを実機検証済み（docs/DECISIONS.md参照）。
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  // CSS columnsのcolumn-widthは「目安」であり、コンテナ幅が自動(auto)のままだと実際の列幅が
  // 微妙にずれてページ境界と画面幅が一致しなくなる（文字が両端で半端に見切れる原因になっていた）。
  // 一度自然なレイアウトでscrollWidthを測り、画面幅の整数倍に切り上げた値をwidthとして明示指定し
  // 再レイアウトさせることで、ブラウザに列幅を画面幅ちょうどへ強制的に揃え直させる（2パス測定）。
  const [pinnedWidth, setPinnedWidth] = useState<number | null>(null);
  // 縦書き時のページ境界(scrollLeft目標値)。measureLineStartXs/computePageBoundariesFromLineXsで
  // 実測して埋める。横書きはcolumnWidth+columnGap=画面幅の単純な等間隔で問題ないため使わない。
  const pageBoundariesRef = useRef<number[]>([]);
  // 縦書き+ページ送りは、実測ベースの境界検出に切り替えても文字の見切れが解消しなかった
  // （column-gapがvertical-rlの多段組で正しく反映されていない可能性がある、実機検証中に
  // 判明。docs/DECISIONS.md参照）。直るまでは縦書き時はスクロール表示にフォールバックする。
  const isPaged = settings.pageMode === "PAGINATION" && settings.writingMode === "HORIZONTAL";
  const marginPx = MARGIN_PX[settings.marginSize] ?? MARGIN_PX.MEDIUM;

  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
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
      // 話が切り替わったら、イマーシブ表示を毎回既定の非表示状態からやり直す。
      setChromeVisible(false);
      setShowSettings(false);
      setPageIndex(0);
      setPinnedWidth(null);
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

  // ページ送りモードでは、CSS columnsのピン留め幅が確定するまでscrollWidthが変動するため、
  // ここで一度スクロール位置を設定してもピン留め後にずれてしまう
  // （復元後にscrollWidthが変わり、初期ページが1つずれる不具合の原因になっていた）。
  // 復元処理自体は下の第2パスのuseEffectがrestoreFractionRefを直接見て行う。
  useEffect(() => {
    if (isPaged || isLoading || !bodyHtml || restoreFractionRef.current === null) return;
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
  }, [isPaged, isLoading, bodyHtml, settings.writingMode]);

  // ページ送りモード時、ビューポート(スクロール領域)の実サイズをCSS columnsの列幅に使うため測っておく。
  useEffect(() => {
    if (!isPaged) return;
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPaged]);

  // 第1パス: widthを明示指定しない自然なレイアウトでscrollWidthを測り、画面幅の整数倍に
  // 切り上げた値をpinnedWidthとして確定する（切り上げなので本文が入りきらなくなることはない）。
  // レイアウト内容に影響する依存値が変わるたびpinnedWidthを一旦nullに戻し、測り直す。
  useEffect(() => {
    if (!isPaged || isLoading || !bodyHtml || viewportSize.width === 0) {
      return;
    }
    // Reactのstate更新を介さず直接styleを外し、次のペイントで自然な幅に戻してから測る
    // （setPinnedWidth(null)をここで同期的に呼ぶとcascading renderの警告対象になるため）。
    if (articleRef.current) articleRef.current.style.width = "";
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (!el) return;
        const w = viewportSize.width;
        const count = Math.max(1, Math.ceil(Math.max(el.scrollWidth, w) / w));
        setPinnedWidth(count * w);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isPaged, isLoading, bodyHtml, viewportSize, settings.fontSize, settings.lineHeight, settings.writingMode, settings.marginSize]);

  // 第2パス: pinnedWidthを明示指定して再レイアウトされた後、scrollWidthは画面幅ちょうどの
  // 整数倍になっているはず（CSS columnsはwidthが明示されると列幅をその幅に厳密に合わせて
  // 再配分するため、実機検証で確認済み）。ここで初めて総ページ数を確定し、直前のスクロール位置
  // 復元(上のuseEffect)の後に現在位置を最寄りのページ境界へスナップする。
  useEffect(() => {
    if (!isPaged || isLoading || !bodyHtml || viewportSize.width === 0 || pinnedWidth === null) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = scrollRef.current;
        const article = articleRef.current;
        if (!el || !article) return;
        const w = viewportSize.width;

        if (settings.writingMode === "VERTICAL") {
          // 縦書き: 実測した行のx座標から、行間隔が明らかに広い場所（＝本当のページ境界）を
          // 直接検出する（上のコメント参照。「1ページ何行」を事前に決め打ちしない）。
          const linePitch = settings.fontSize * settings.lineHeight;
          const lineXs = measureLineStartXs(article, el.scrollLeft);
          const boundaries = computePageBoundariesFromLineXs(lineXs, linePitch, pinnedWidth);
          pageBoundariesRef.current = boundaries;
          const count = boundaries.length;
          setPageCount(count);

          let current: number;
          if (restoreFractionRef.current !== null) {
            current = Math.round(restoreFractionRef.current * (count - 1));
            restoreFractionRef.current = null;
          } else {
            // 現在のscrollLeftに最も近い境界を探す（設定変更などでの再計算時、現在位置を維持する）。
            current = 0;
            let bestDist = Infinity;
            boundaries.forEach((b, idx) => {
              const dist = Math.abs(b - el.scrollLeft);
              if (dist < bestDist) {
                bestDist = dist;
                current = idx;
              }
            });
          }
          current = Math.max(0, Math.min(count - 1, current));
          setPageIndex(current);
          el.scrollLeft = boundaries[current];
          return;
        }

        // 横書き: columnWidth+columnGap=画面幅ちょうどになるよう構成しているため、
        // 単純な等間隔ステップで問題ない（実機検証でクリーンなことを確認済み）。
        const count = Math.max(1, Math.round(pinnedWidth / w));
        setPageCount(count);
        let rawIndex;
        if (restoreFractionRef.current !== null) {
          rawIndex = restoreFractionRef.current * (count - 1);
          restoreFractionRef.current = null;
        } else {
          rawIndex = el.scrollLeft / w;
        }
        const current = Math.max(0, Math.min(count - 1, Math.round(rawIndex)));
        setPageIndex(current);
        el.scrollLeft = current * w;
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isPaged, isLoading, bodyHtml, viewportSize, pinnedWidth, settings.writingMode, settings.fontSize, settings.lineHeight]);

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

  // ページ送りモードでのページ移動。末尾ページより先に進もうとしたら次の話へ、
  // 先頭ページより前には戻らない（前の話への自動遷移はしない仕様、フッターのボタンを使う）。
  const goToPage = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      if (!el || viewportSize.width === 0 || pinnedWidth === null) return;
      if (index < 0) return;
      if (index >= pageCount) {
        goTo(nextChapter);
        return;
      }
      setPageIndex(index);
      if (settings.writingMode === "VERTICAL") {
        // 実測したページ境界（本当に空白な場所）を使う。理由はページ数確定処理と同じ。
        const boundary = pageBoundariesRef.current[index];
        el.scrollLeft = boundary !== undefined ? boundary : 0;
      } else {
        el.scrollLeft = index * viewportSize.width;
      }
    },
    [viewportSize.width, pinnedWidth, pageCount, goTo, nextChapter, settings.writingMode]
  );

  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isPaged) {
      setChromeVisible((v) => !v);
      setShowSettings(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    if (xRatio < 0.3) {
      goToPage(pageIndex - 1);
    } else if (xRatio > 0.7) {
      goToPage(pageIndex + 1);
    } else {
      setChromeVisible((v) => !v);
      setShowSettings(false);
    }
  }

  // 本文の最後までスクロールしたあと、さらにスクロールしようとしたら次の話へ自動的に移動する。
  // 「最後に到達した瞬間」ではなく、そこからさらに一定時間スクロール操作が続いた場合のみ発火させることで、
  // 最終行を読み終えた直後に意図せず次の話へ飛んでしまうのを防ぐ。ページ送りモードでは
  // goToPage側でページ境界を超えた遷移を扱うため、この監視は不要（scrollイベント自体発生しない）。
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !nextChapter || isPaged) return;
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
  }, [chapterId, nextChapter, computeScrollFraction, goTo, isPaged]);

  const fontClass = settings.fontFamily === "MINCHO" ? "reader-text-mincho" : "reader-text-gothic";
  const paddingClass = MARGIN_PADDING[settings.marginSize] ?? MARGIN_PADDING.MEDIUM;

  // 縦書きは1行の送り幅がfontSize*lineHeightの整数倍になる性質があり、columnWidthがその
  // 整数倍ちょうどでないと最後の半端な1行分がページ境界をまたいで隣のページにわずかに
  // はみ出す（文字が両端で見切れる原因になっていた、実機検証で確認済み）。そのため
  // columnWidthは行送りピッチの整数倍に切り下げる。
  //
  // 重要: columnGapは「画面幅-columnWidth」ではなく「2*実効パディング」でなければならない。
  // 総ページ幅(=padding*2 + N*columnWidth + (N-1)*columnGap)が画面幅の整数倍(N*画面幅)に
  // きれいに telescoping するのは、columnGap=2*padding のときに限られる
  // （columnWidth+columnGap=画面幅は必要条件だが、それだけでは総幅の端数が消えない）。
  // そのため、columnWidthを行送りピッチの倍数に切り下げた分だけ、逆算した実効パディングを
  // 少し広げて帳尻を合わせる（ユーザー設定のmarginPxに対して数px程度大きくなるのみ）。
  const rawColumnWidth = Math.max(1, viewportSize.width - marginPx * 2);
  const linePitch = settings.fontSize * settings.lineHeight;
  const columnWidth =
    settings.writingMode === "VERTICAL"
      ? Math.max(linePitch, Math.floor(rawColumnWidth / linePitch) * linePitch)
      : rawColumnWidth;
  const columnGap = viewportSize.width - columnWidth;
  const effectivePadding = columnGap / 2;

  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      <div
        ref={scrollRef}
        onClick={handleContentClick}
        className={
          isPaged ? "absolute inset-0 overflow-hidden" : `absolute inset-0 overflow-auto ${paddingClass} py-6`
        }
      >
        {isLoading ? (
          <p className="text-center text-sm text-muted">読み込み中...</p>
        ) : error ? (
          <p className="text-center text-sm text-update">{error}</p>
        ) : isPaged ? (
          viewportSize.width > 0 && (
            // ページ送りモード: CSS多段組(columns)で本文を画面幅ぴったりの列に分割する。
            // columnWidth+columnGap=画面幅になるようにし、コンテナのpadding-left/rightに
            // marginPxを設定することで、どのページを表示しても両端に余白ができる
            // （列と列の間の隙間が前後のページの余白に見える、という仕掛け）。
            // 縦書き(vertical-rl)でも列はscrollWidth方向（x軸）に増えるため同じCSSで成立する
            // （goToPage/スナップ処理側でスクロール方向のみ縦書き用に反転している）。
            <article
              ref={articleRef}
              className={`${settings.writingMode === "VERTICAL" ? "writing-vertical" : ""} ${fontClass}`}
              style={{
                fontSize: settings.fontSize,
                lineHeight: settings.lineHeight,
                columnWidth,
                columnGap,
                // column-fillの既定値balanceは列の高さを均等化しようと詰め方を調整するため、
                // 列幅=画面幅という前提が崩れてページ境界がずれる（文字の食い違いの原因になっていた）。
                // autoにして各列を先頭から順に高さいっぱいまで詰めさせることで、列幅を厳密に一定に保つ。
                columnFill: "auto",
                height: viewportSize.height,
                // pinnedWidthが決まるまでは自然な幅(auto)でレイアウトさせ、そこから求めた
                // 画面幅ちょうどの整数倍を明示widthとして指定し直すことで列幅を強制的に揃える。
                width: pinnedWidth ?? undefined,
                boxSizing: "border-box",
                paddingLeft: effectivePadding,
                paddingRight: effectivePadding,
                paddingTop: 24,
                paddingBottom: 24,
              }}
            >
              <h1 className="mb-4 text-base font-bold">{title}</h1>
              <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            </article>
          )
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

      {/* ヘッダーと設定パネルは1つのブロックとしてまとめて画面上端からスライドイン/アウトさせる。
          本文タップで表示・非表示を切り替えるイマーシブ表示（既定は非表示）。 */}
      <div
        className={`absolute inset-x-0 top-0 z-10 transition-transform duration-200 ${
          chromeVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-border bg-background px-4 py-2.5 text-sm">
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
      </div>

      <footer
        className={`absolute inset-x-0 bottom-0 z-10 flex items-center justify-between border-t border-border bg-background px-4 py-2.5 transition-transform duration-200 ${
          chromeVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <button
          onClick={() => goTo(nextChapter)}
          disabled={!nextChapter}
          className="flex items-center gap-1 text-sm text-muted disabled:opacity-30"
        >
          次の話 <ChevronRightIcon className="h-4 w-4" />
        </button>
        {isPaged && (
          <span className="text-xs text-muted">
            {pageIndex + 1} / {pageCount}
          </span>
        )}
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
