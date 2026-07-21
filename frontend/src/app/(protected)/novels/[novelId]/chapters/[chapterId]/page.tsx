"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AddBookmarkDialog } from "@/components/AddBookmarkDialog";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { ApiError, novelsApi, readingApi } from "@/lib/api";
import type { Chapter } from "@/lib/api";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { getCachedChapter, putCachedChapter } from "@/lib/offline/chapterCache";
import { queuePendingPosition } from "@/lib/offline/positionQueue";
import { useVolumeButtonPaging } from "@/lib/reader/useVolumeButtonPaging";
import {
  getVolumeButtonPagingPref,
  getVolumeButtonPagingPrefServerSnapshot,
  setVolumeButtonPagingPref,
  subscribeVolumeButtonPagingPref,
} from "@/lib/reader/volumeButtonPagingPref";

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

interface LineExtent {
  left: number;
  right: number;
}

// 実際にレンダリングされた本文中の各行の占有範囲(left〜right)を直接測定する（1文字ずつ
// Rangeを作ってgetClientRects()を見る）。同じ行の文字は縦書きでは同一x（サブピクセル単位で
// ほぼ一致）を共有するため、四捨五入したleftをキーに集約する。r.leftは文字グリフの左端
// （中心ではない）であり、行と行の間の本当の空白の位置を正確に求めるにはrightも必要になる
// （下のcomputeVerticalPageBoundaries参照）。CSS側の値をJS側で事前に「予測」する方式は、
// ブラウザの内部レイアウト計算との間で数px単位のズレが生じることがあった（実機検証で確認、
// docs/DECISIONS.mdの2026-07-19エントリ参照）ため、必ず実測値を使う。
function measureVerticalLines(articleEl: HTMLElement, scrollLeft: number): LineExtent[] {
  const lines = new Map<number, LineExtent>();
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
        const left = r.left + scrollLeft;
        const right = r.right + scrollLeft;
        const key = Math.round(left);
        const cur = lines.get(key);
        if (cur) {
          cur.left = Math.min(cur.left, left);
          cur.right = Math.max(cur.right, right);
        } else {
          lines.set(key, { left, right });
        }
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
    const left = r.left + scrollLeft;
    const key = Math.round(left);
    if (!lines.has(key)) lines.set(key, { left, right: r.right + scrollLeft });
  }
  return [...lines.values()].sort((a, b) => b.left - a.left); // 降順 = 読み順（右から左）
}

interface VerticalPageBoundary {
  scrollLeft: number;
  width: number;
}

// 縦書きページ送りは、CSS多段組(columns)を一切使わず、スクロールモードと同じ自然な
// レイアウト（1本の連続した横スクロール帯）のまま、実測した各行の占有範囲を画面幅ぴったりに
// 収まる行数ごとにグルーピングしてページを構成する。column-gapに一切依存しないため、
// CSS多段組+vertical-rlの組み合わせで起きていたページ境界の文字見切れ問題（column-gapが
// vertical-rlの多段組で正しく反映されない、実機検証で複数回確認済み。docs/DECISIONS.md参照）
// を構造的に回避できる。
//
// 重要: 各ページのグループ幅は行の占有幅が離散的なため画面幅ぴったりにはならない
// （通常やや狭い）。この差分を吸収するため、スクロール領域自体の幅を「画面幅」ではなく
// 「そのページのグループ幅ちょうど」に動的に変え、中央寄せして表示する
// （JSX側でoverflow:hiddenの内側コンテナ幅をページごとに切り替える）。これにより、
// スクロール領域の外側に隣接ページの行がはみ出す余地が原理的に無くなり、
// 見切れが起こり得ない（実測ベースの自動テストで複数のフォント設定・画面幅の組み合わせで
// 見切れゼロを確認済み）。
function computeVerticalPageBoundaries(lines: LineExtent[], viewportWidth: number, scrollWidth: number): VerticalPageBoundary[] {
  const n = lines.length;
  if (n === 0) return [{ scrollLeft: 0, width: Math.max(1, viewportWidth) }];
  const boundaries: VerticalPageBoundary[] = [];
  let start = 0;
  while (start < n) {
    let end = start;
    while (end + 1 < n && lines[start].right - lines[end + 1].left <= viewportWidth) {
      end++;
    }
    // 1pxの安全マージンを両端に確保し、サブピクセル丸めの影響を吸収する。
    const rawScrollLeft = Math.floor(lines[end].left) - 1;
    const rawWidth = Math.ceil(lines[start].right - lines[end].left) + 2;
    boundaries.push({
      scrollLeft: Math.max(0, rawScrollLeft),
      width: Math.min(viewportWidth, rawWidth, Math.max(1, scrollWidth)),
    });
    start = end + 1;
  }
  return boundaries;
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
  // 音量ボタンでのページ送りは端末のハードウェア機能に依存するため、サーバー同期される
  // UserSettingsではなく端末ローカルのlocalStorageにON/OFFを保持する（既定OFF: 常時無音
  // オーディオを再生する裏技のため、意図せず有効になることを避ける）。
  const volumeButtonPaging = useSyncExternalStore(
    subscribeVolumeButtonPagingPref,
    getVolumeButtonPagingPref,
    getVolumeButtonPagingPrefServerSnapshot
  );
  const toggleVolumeButtonPaging = useCallback(() => {
    setVolumeButtonPagingPref(!getVolumeButtonPagingPref());
  }, []);
  // ページ送りモード: 横書きはCSS多段組(columns)で本文を「画面ぴったりの列」に分割し、
  // scrollLeftを列幅ぶんずつ動かすことでページをめくる。縦書きはCSS columnsを使わず、
  // 実測した行位置ベースでページ境界を算出する（下のcomputeVerticalPageBoundaries参照。
  // vertical-rl+columnsの組み合わせでcolumn-gapが正しく反映されない問題があったため。
  // docs/DECISIONS.md参照）。
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  // CSS columnsのcolumn-widthは「目安」であり、コンテナ幅が自動(auto)のままだと実際の列幅が
  // 微妙にずれてページ境界と画面幅が一致しなくなる（文字が両端で半端に見切れる原因になっていた）。
  // 一度自然なレイアウトでscrollWidthを測り、画面幅の整数倍に切り上げた値をwidthとして明示指定し
  // 再レイアウトさせることで、ブラウザに列幅を画面幅ちょうどへ強制的に揃え直させる（2パス測定）。
  const [pinnedWidth, setPinnedWidth] = useState<number | null>(null);
  // ページ送りモードで話を切り替えた直後は、実測ベースのページ境界計算が終わるまで
  // 一瞬「1ページ目」の内容がそのまま見えてしまい、そこから目的のページ（次の話の先頭、
  // または前の話の末尾）へ一瞬で飛ぶ「別の内容が一瞬見える」現象が起きていた。
  // 位置確定（下の2つのuseEffect参照）が終わるまでvisibility:hiddenで隠すために使う
  // （display:noneにすると計測できなくなるためvisibilityを使う）。話を切り替えた瞬間に
  // falseへ戻す。
  const [isPositioned, setIsPositioned] = useState(false);
  // 縦書き時の各ページの(scrollLeft, 幅)。measureVerticalLines/computeVerticalPageBoundariesで
  // 実測して埋める。横書きはcolumnWidth+columnGap=画面幅の単純な等間隔で問題ないため使わない。
  const pageBoundariesRef = useRef<VerticalPageBoundary[]>([]);
  const isPaged = settings.pageMode === "PAGINATION";
  const isVerticalPaged = isPaged && settings.writingMode === "VERTICAL";
  const isHorizontalPaged = isPaged && settings.writingMode === "HORIZONTAL";
  const marginPx = MARGIN_PX[settings.marginSize] ?? MARGIN_PX.MEDIUM;

  const scrollRef = useRef<HTMLDivElement>(null);
  // 縦書きページ送り専用: scrollRefは画面全幅のまま(タップ判定用)、実際にスクロール・
  // クリップされるのはこの内側コンテナ。幅をページごとに動的に変える（下のarticle参照）。
  const vPagerRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const bookmarkDialogRef = useRef<HTMLDialogElement>(null);
  const startedAtRef = useRef<number>(0);
  const restoreFractionRef = useRef<number | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const justSwipedRef = useRef(false);

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
      setIsPositioned(false);
      if (vPagerRef.current) vPagerRef.current.style.width = "";
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      startedAtRef.current = Date.now();

      // 話末での二回タップ・音量ボタン等で「前の話の末尾」を明示的に指定して遷移してきた場合、
      // URLに?pos=endが付与される（goToのtoEndオプション参照）。この場合は保存済みの読書位置
      // より常にこちらを優先する（ユーザーが明示的に末尾へ戻る操作をしたため）。
      const openAtEnd = new URLSearchParams(window.location.search).get("pos") === "end";
      if (openAtEnd) {
        restoreFractionRef.current = 1;
        window.history.replaceState(null, "", window.location.pathname);
      } else {
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
      }

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

  // ページ送りモード時、ビューポート(スクロール領域)の実サイズを1ページ分の幅・高さとして測っておく
  // （横書きはCSS columnsの列幅に、縦書きは実測ベースのページ境界算出に使う）。
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
  // CSS columnsを使うのは横書きのみ（縦書きは別の実測ベース処理を下で行う）。
  useEffect(() => {
    if (!isHorizontalPaged || isLoading || !bodyHtml || viewportSize.width === 0) {
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
  }, [isHorizontalPaged, isLoading, bodyHtml, viewportSize, settings.fontSize, settings.lineHeight, settings.marginSize]);

  // 第2パス(横書きのみ): pinnedWidthを明示指定して再レイアウトされた後、scrollWidthは画面幅
  // ちょうどの整数倍になっているはず（CSS columnsはwidthが明示されると列幅をその幅に厳密に
  // 合わせて再配分するため、実機検証で確認済み）。ここで初めて総ページ数を確定し、直前の
  // スクロール位置復元(上のuseEffect)の後に現在位置を最寄りのページ境界へスナップする。
  useEffect(() => {
    if (!isHorizontalPaged || isLoading || !bodyHtml || viewportSize.width === 0 || pinnedWidth === null) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (!el) return;
        const w = viewportSize.width;

        // columnWidth+columnGap=画面幅ちょうどになるよう構成しているため、
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
        setIsPositioned(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isHorizontalPaged, isLoading, bodyHtml, viewportSize, pinnedWidth]);

  // 縦書き+ページ送り: CSS columnsを使わず、スクロールモードと同じ自然なレイアウトのまま
  // 実際の行の占有範囲を実測し、画面幅ぴったりに収まる行数ごとにページを算出する
  // （関数コメント参照）。pinnedWidthのような幅の固定は不要な代わりに、ページごとに
  // スクロール領域自体の幅(vPagerRef)を動的に切り替える。
  useEffect(() => {
    if (!isVerticalPaged || isLoading || !bodyHtml || viewportSize.width === 0 || viewportSize.height === 0) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const pager = vPagerRef.current;
        const article = articleRef.current;
        if (!pager || !article) return;

        const lines = measureVerticalLines(article, pager.scrollLeft);
        const boundaries = computeVerticalPageBoundaries(lines, viewportSize.width, article.scrollWidth);
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
            const dist = Math.abs(b.scrollLeft - pager.scrollLeft);
            if (dist < bestDist) {
              bestDist = dist;
              current = idx;
            }
          });
        }
        current = Math.max(0, Math.min(count - 1, current));
        setPageIndex(current);
        pager.style.width = `${boundaries[current].width}px`;
        pager.scrollLeft = boundaries[current].scrollLeft;
        setIsPositioned(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isVerticalPaged, isLoading, bodyHtml, viewportSize, settings.fontSize, settings.lineHeight, settings.marginSize]);

  const computeScrollFraction = useCallback(() => {
    // 縦書きページ送りはページごとにスクロール領域の幅・scrollLeftの基準が変わるため、
    // ピクセル単位のスクロール量ではなく現在のページ番号を進捗として使う。
    if (isVerticalPaged) {
      return (pageIndex / Math.max(1, pageCount - 1)) * 100;
    }
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
  }, [settings.writingMode, isVerticalPaged, pageIndex, pageCount]);

  // 話末に到達しているかどうか。スクロール量ではなく残りスクロール可能量で判定することで、
  // 本文が画面に収まりきって元々スクロールできない話でも「末尾にいる」扱いにできる。
  const isAtChapterEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return false;
    if (settings.writingMode === "VERTICAL") {
      const max = el.scrollWidth - el.clientWidth;
      return max <= 0 || el.scrollLeft <= max * 0.005;
    }
    const max = el.scrollHeight - el.clientHeight;
    return max <= 0 || el.scrollTop >= max * 0.995;
  }, [settings.writingMode]);

  // 話頭に到達しているかどうか。isAtChapterEndと対になる判定（0%/100%の向きが逆）。
  const isAtChapterStart = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return false;
    if (settings.writingMode === "VERTICAL") {
      const max = el.scrollWidth - el.clientWidth;
      return max <= 0 || el.scrollLeft >= max * 0.995;
    }
    const max = el.scrollHeight - el.clientHeight;
    return max <= 0 || el.scrollTop <= max * 0.005;
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

  // スマホでアプリを裏に回す(タブ切り替え/ホーム画面に戻る等)と、しばらくしてOS側でページが
  // 破棄されることがあり、その場合上のアンマウント時保存(cleanup)は実行されない。次に開いた時に
  // 古い保存位置（話の先頭等）まで戻ってしまう不具合の原因だったため、非表示になった時点でも
  // 保存しておく。pagehideはvisibilitychangeより後に発火しない場合がある(bfcache等)ため両方登録する。
  useEffect(() => {
    const handleHide = () => {
      if (document.hidden) saveProgress();
    };
    document.addEventListener("visibilitychange", handleHide);
    window.addEventListener("pagehide", saveProgress);
    return () => {
      document.removeEventListener("visibilitychange", handleHide);
      window.removeEventListener("pagehide", saveProgress);
    };
  }, [saveProgress]);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  // toEnd: 遷移先の話を末尾（最終ページ／スクロール最下部相当）から開く。前の話へ「戻る」操作
  // （話頭での二回タップ、音量ボタン等）で使う。URLに?pos=endを付与し、遷移先のマウント時に
  // 読み込みuseEffectが解釈する（該当箇所参照）。
  const goTo = useCallback(
    (chapter: Chapter | undefined, options?: { toEnd?: boolean }) => {
      if (!chapter) return;
      saveProgress();
      const suffix = options?.toEnd ? "?pos=end" : "";
      router.push(`/novels/${novelId}/chapters/${chapter.id}${suffix}`);
    },
    [saveProgress, router, novelId]
  );

  // ページ送りモードでのページ移動。末尾ページより先に進もうとしたら次の話へ、
  // 先頭ページより前に戻ろうとしたら前の話の末尾へ移動する。
  const goToPage = useCallback(
    (index: number) => {
      if (viewportSize.width === 0) return;
      if (index < 0) {
        goTo(prevChapter, { toEnd: true });
        return;
      }
      if (index >= pageCount) {
        goTo(nextChapter);
        return;
      }
      setPageIndex(index);
      if (settings.writingMode === "VERTICAL") {
        // 実測したページの(scrollLeft, 幅)を使う。理由はページ数確定処理と同じ。
        const pager = vPagerRef.current;
        const boundary = pageBoundariesRef.current[index];
        if (!pager || !boundary) return;
        pager.style.width = `${boundary.width}px`;
        pager.scrollLeft = boundary.scrollLeft;
      } else {
        const el = scrollRef.current;
        if (!el || pinnedWidth === null) return;
        el.scrollLeft = index * viewportSize.width;
      }
    },
    [viewportSize.width, pinnedWidth, pageCount, goTo, nextChapter, prevChapter, settings.writingMode]
  );

  // 音量ボタン・将来のキーボード操作等、タップ以外の入力からもページ送りできるようにする共通処理。
  // ページ送りモードではgoToPageへ委譲し、スクロールモードでは画面1枚分弱ずつスクロールする
  // （端に達している場合は前後の話へ移動する。話頭に戻る場合は前の話の末尾から開く）。
  const pageForward = useCallback(() => {
    if (isPaged) {
      goToPage(pageIndex + 1);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    if (isAtChapterEnd()) {
      goTo(nextChapter);
      return;
    }
    if (settings.writingMode === "VERTICAL") {
      el.scrollLeft = Math.max(0, el.scrollLeft - el.clientWidth * 0.9);
    } else {
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = Math.min(max, el.scrollTop + el.clientHeight * 0.9);
    }
  }, [isPaged, goToPage, pageIndex, settings.writingMode, isAtChapterEnd, goTo, nextChapter]);

  const pageBack = useCallback(() => {
    if (isPaged) {
      goToPage(pageIndex - 1);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    if (isAtChapterStart()) {
      goTo(prevChapter, { toEnd: true });
      return;
    }
    if (settings.writingMode === "VERTICAL") {
      const max = el.scrollWidth - el.clientWidth;
      el.scrollLeft = Math.min(max, el.scrollLeft + el.clientWidth * 0.9);
    } else {
      el.scrollTop = Math.max(0, el.scrollTop - el.clientHeight * 0.9);
    }
  }, [isPaged, goToPage, pageIndex, settings.writingMode, isAtChapterStart, goTo, prevChapter]);

  useVolumeButtonPaging(volumeButtonPaging, pageForward, pageBack);

  const DOUBLE_TAP_MS = 300;
  // スワイプ判定の閾値。SWIPE_MAX_OFF_AXISは、指が斜めに大きくブレた場合や縦スクロールの
  // 意図と誤認しないようにするための直交方向の許容量。
  const SWIPE_MIN_DISTANCE = 50;
  const SWIPE_MAX_OFF_AXIS = 60;

  // ページ送りモードでのタップ/スワイプ操作は設定(settings.pageTurnGesture)でどちらか一方を
  // 選べるようにしている（両方同時に有効だと、スワイプの指離しでタップも誤発火しかねないため）。
  function handleContentTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (!isPaged || settings.pageTurnGesture !== "SWIPE") return;
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function handleContentTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (!isPaged || settings.pageTurnGesture !== "SWIPE" || !swipeStartRef.current) return;
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const t = e.changedTouches[0];
    const deltaX = t.clientX - start.x;
    const deltaY = t.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE || Math.abs(deltaY) > SWIPE_MAX_OFF_AXIS) return;
    // 縦書き(右→左に読み進む)は横書きと前後の向きが逆になる（タップ判定と同じ理由）。
    const isVertical = settings.writingMode === "VERTICAL";
    const isForwardSwipe = isVertical ? deltaX > 0 : deltaX < 0;
    if (isForwardSwipe) {
      pageForward();
    } else {
      pageBack();
    }
    // 指を離した後、ブラウザ/端末によってはこのtouchendの後にclickイベントが合成される
    // ことがあり、そのままだと下のhandleContentClickでヘッダー/フッターの表示切替
    // （200msのスライドアニメーション）まで毎回余計に発生してしまう。ページ送りの
    // 描画と競合して「たまに反応が遅い」ように見える原因になっていたため、直後の
    // clickは無視する。
    justSwipedRef.current = true;
  }

  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    if (justSwipedRef.current) {
      justSwipedRef.current = false;
      return;
    }
    if (isPaged) {
      if (settings.pageTurnGesture !== "TAP") {
        setChromeVisible((v) => !v);
        setShowSettings(false);
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const xRatio = (e.clientX - rect.left) / rect.width;
      // 縦書き(右→左に読み進む)は横書きと左右のタップ方向が逆になる:
      // 画面左側タップで「次のページ」、右側タップで「前のページ」。
      const isVertical = settings.writingMode === "VERTICAL";
      if (xRatio < 0.3) {
        goToPage(isVertical ? pageIndex + 1 : pageIndex - 1);
      } else if (xRatio > 0.7) {
        goToPage(isVertical ? pageIndex - 1 : pageIndex + 1);
      } else {
        setChromeVisible((v) => !v);
        setShowSettings(false);
      }
      return;
    }

    // 話末で画面左側をダブルタップしたら次の話へ、話頭で画面右側をダブルタップしたら
    // 前の話の末尾へ移動する。1回目のタップは二回タップ待ちのため即座にはトグルせず、
    // 猶予時間内に2回目が来なければ通常どおりイマーシブ表示のトグルとして扱う。
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const isNextChapterTarget = xRatio < 0.3 && nextChapter && isAtChapterEnd();
    const isPrevChapterTarget = xRatio > 0.7 && prevChapter && isAtChapterStart();
    if (isNextChapterTarget || isPrevChapterTarget) {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
        if (isNextChapterTarget) {
          goTo(nextChapter);
        } else {
          goTo(prevChapter, { toEnd: true });
        }
        return;
      }
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        setChromeVisible((v) => !v);
        setShowSettings(false);
      }, DOUBLE_TAP_MS);
      return;
    }

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
    setChromeVisible((v) => !v);
    setShowSettings(false);
  }

  const fontClass = settings.fontFamily === "MINCHO" ? "reader-text-mincho" : "reader-text-gothic";
  const paddingClass = MARGIN_PADDING[settings.marginSize] ?? MARGIN_PADDING.MEDIUM;

  // 横書きページ送り専用: columnWidth+columnGap=画面幅ちょうどになるよう構成し、
  // コンテナのpadding-left/rightにmarginPxを設定することで、どのページを表示しても
  // 両端に余白ができる（列と列の間の隙間が前後のページの余白に見える、という仕掛け）。
  // 縦書きページ送りはCSS columnsを使わないため、この計算は不要（下のarticleで分岐）。
  const columnWidth = Math.max(1, viewportSize.width - marginPx * 2);
  const columnGap = viewportSize.width - columnWidth;
  const effectivePadding = columnGap / 2;

  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      <div
        ref={scrollRef}
        onClick={handleContentClick}
        onTouchStart={handleContentTouchStart}
        onTouchEnd={handleContentTouchEnd}
        className={
          isPaged ? "absolute inset-0 overflow-hidden" : `absolute inset-0 overflow-auto ${paddingClass} py-6`
        }
      >
        {isLoading ? (
          <p className="text-center text-sm text-muted">読み込み中...</p>
        ) : error ? (
          <p className="text-center text-sm text-update">{error}</p>
        ) : isHorizontalPaged ? (
          viewportSize.width > 0 && (
            // 横書きページ送り: CSS多段組(columns)で本文を画面幅ぴったりの列に分割する。
            <article
              ref={articleRef}
              className={fontClass}
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
                // 話を切り替えた直後、実測でページ位置が確定するまでは「1ページ目」の内容が
                // 一瞬見えてしまう（目的のページへジャンプする前の状態）。display:noneだと
                // 計測できなくなるためvisibilityで隠す（isPositioned参照）。
                visibility: isPositioned ? "visible" : "hidden",
              }}
            >
              <h1 className="mb-4 text-base font-bold">{title}</h1>
              <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            </article>
          )
        ) : isVerticalPaged ? (
          viewportSize.width > 0 && (
            // 縦書きページ送り: CSS columnsを使わず、スクロールモードと同じ自然な
            // レイアウトのままarticleをレンダリングし、実測ベースでページ境界を算出する
            // （computeVerticalPageBoundariesのコメント参照）。各ページのグループ幅は
            // 画面幅ぴったりにはならないため、内側のvPagerRef自体の幅をページごとに
            // 動的に変えて中央寄せする（見切れが原理的に起こらない）。
            <div
              ref={vPagerRef}
              style={{
                height: viewportSize.height,
                width: viewportSize.width,
                overflow: "hidden",
                margin: "0 auto",
                // 横書きページ送りと同じ理由（上のコメント参照）。
                visibility: isPositioned ? "visible" : "hidden",
              }}
            >
              <article
                ref={articleRef}
                className={`writing-vertical ${fontClass}`}
                style={{
                  fontSize: settings.fontSize,
                  lineHeight: settings.lineHeight,
                  height: viewportSize.height,
                  boxSizing: "border-box",
                  paddingLeft: marginPx,
                  paddingRight: marginPx,
                  paddingTop: 24,
                  paddingBottom: 24,
                }}
              >
                <h1 className="mb-4 text-base font-bold">{title}</h1>
                <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              </article>
            </div>
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
            <button onClick={toggleVolumeButtonPaging} className="rounded-full border border-border px-3 py-1">
              音量ボタン送り: {volumeButtonPaging ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => update({ pageTurnGesture: settings.pageTurnGesture === "TAP" ? "SWIPE" : "TAP" })}
              className="rounded-full border border-border px-3 py-1"
            >
              ページ送り操作: {settings.pageTurnGesture === "TAP" ? "タップ" : "スワイプ"}
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
