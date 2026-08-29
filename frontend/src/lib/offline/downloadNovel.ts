// 「全話をオフライン保存」のクライアント分割実装。
// 旧実装は POST /novels/{id}/download の1本で全話を返していたが、話数×1秒以上かかり
// Cloudflare の約100秒応答制限（524）に当たるため、1話ずつ GET /chapters/{id}/content を
// 逐次取得する方式へ変更した（バックエンド改修は不要。docs/MIGRATION_to_minipc.md 9-3）。
"use client";

import { ApiError, novelsApi, type Chapter } from "@/lib/api";
import { getCachedChapterIdsForNovel, putCachedChapter } from "./chapterCache";

export interface DownloadProgress {
  done: number; // 保存済み + スキップ済み
  total: number;
  failed: number;
  currentTitle: string | null;
}

export interface DownloadResult {
  total: number;
  saved: number; // 今回新たに取得して保存した話数
  skipped: number; // 既にキャッシュ済みでスキップした話数
  failed: number; // リトライしても取得できなかった話数
  aborted: boolean;
}

const MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = [2000, 4000, 8000];

export interface DownloadOptions {
  signal?: AbortSignal;
  /** リトライ間隔（ms）。既定は 2s→4s→8s。テスト用に短縮できる。 */
  backoffMs?: number[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 作品の全話を端末内キャッシュ（IndexedDB）へ保存する。
 *
 * - 同時実行は必ず1（逐次 await）。サーバー側 NarouRateLimiter が全体で1秒間隔を
 *   強制しているため、クライアント側で追加のウェイトは入れない。
 * - 既にキャッシュ済みの話はスキップする（＝再実行で未保存分だけ取得＝再開）。
 * - 5xx / ネットワークエラーは 2s→4s→8s のバックオフで最大3回リトライ。
 *   それでも失敗した話は「失敗」として記録し、中断せず次へ進む（部分保存を許容）。
 * - 401（リフレッシュ不能）は回復不能なので即中断して呼び出し元へ投げる。
 */
export async function downloadNovelOffline(
  novelId: string,
  chapters: Chapter[],
  onProgress: (progress: DownloadProgress) => void,
  options: DownloadOptions = {},
): Promise<DownloadResult> {
  const { signal, backoffMs = DEFAULT_BACKOFF_MS } = options;
  const ordered = [...chapters].sort((a, b) => a.chapterNo - b.chapterNo);
  const cachedIds = await getCachedChapterIdsForNovel(novelId);
  const total = ordered.length;

  let saved = 0;
  let skipped = 0;
  let failed = 0;

  const emit = (currentTitle: string | null) =>
    onProgress({ done: saved + skipped, total, failed, currentTitle });

  for (const chapter of ordered) {
    if (signal?.aborted) break;

    if (cachedIds.has(chapter.id)) {
      skipped++;
      emit(chapter.title);
      continue;
    }

    for (let attempt = 1; ; attempt++) {
      if (signal?.aborted) break;
      try {
        const content = await novelsApi.content(chapter.id);
        await putCachedChapter({
          chapterId: chapter.id,
          novelId,
          chapterNo: chapter.chapterNo,
          title: content.title,
          bodyHtml: content.bodyHtml,
          sourceUrl: content.sourceUrl,
        });
        saved++;
        break;
      } catch (err) {
        // 認証切れ（apiFetch のリフレッシュでも回復できなかった）は続行不能
        if (err instanceof ApiError && err.status === 401) throw err;
        const retriable = !(err instanceof ApiError) || err.status >= 500;
        if (!retriable || attempt >= MAX_ATTEMPTS) {
          failed++;
          break;
        }
        await sleep(backoffMs[Math.min(attempt - 1, backoffMs.length - 1)]);
      }
    }
    emit(chapter.title);
  }

  return { total, saved, skipped, failed, aborted: signal?.aborted ?? false };
}
