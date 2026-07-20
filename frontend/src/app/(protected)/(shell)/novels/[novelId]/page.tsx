"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BookCover } from "@/components/BookCover";
import { ChevronLeftIcon, PencilIcon } from "@/components/icons";
import {
  ApiError,
  novelsApi,
  readingApi,
  shelfApi,
  tagsApi,
  type BookshelfEntry,
  type Chapter,
  type NovelDetail,
  type ReadingPosition,
  type ShelfStatus,
  type Tag,
} from "@/lib/api";
import { putCachedChapter } from "@/lib/offline/chapterCache";

const STATUS_LABEL: Record<ShelfStatus, string> = {
  READING: "読書中",
  COMPLETED: "読了",
  READ_LATER: "あとで読む",
};

export default function NovelDetailPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const router = useRouter();

  const [novel, setNovel] = useState<NovelDetail | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [position, setPosition] = useState<ReadingPosition | null>(null);
  const [shelfEntry, setShelfEntry] = useState<BookshelfEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [savingTag, setSavingTag] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [novelRes, chaptersRes, shelfList] = await Promise.all([
        novelsApi.detail(novelId),
        novelsApi.chapters(novelId),
        shelfApi.list(),
      ]);
      setNovel(novelRes);
      setChapters(chaptersRes);
      setShelfEntry(shelfList.find((e) => e.novel.id === novelId) ?? null);
      try {
        setPosition(await readingApi.getPosition(novelId));
      } catch {
        setPosition(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "作品情報の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    queueMicrotask(() => load());
  }, [load]);

  useEffect(() => {
    queueMicrotask(() => {
      tagsApi.list().then(setAllTags).catch(() => {});
    });
  }, []);

  async function addToShelf() {
    const entry = await shelfApi.add(novelId, "READING");
    setShelfEntry(entry);
  }

  async function updateStatus(status: ShelfStatus) {
    if (!shelfEntry) return;
    const updated = await shelfApi.update(shelfEntry.id, { status });
    setShelfEntry(updated);
  }

  async function removeFromShelf() {
    if (!shelfEntry) return;
    await shelfApi.remove(shelfEntry.id);
    setShelfEntry(null);
  }

  async function addTag(e: FormEvent) {
    e.preventDefault();
    const name = tagInput.trim();
    if (!name || !shelfEntry) return;
    setSavingTag(true);
    try {
      let tag = allTags.find((t) => t.name === name);
      if (!tag) {
        tag = await tagsApi.create(name);
        setAllTags((prev) => [...prev, tag as Tag]);
      }
      if (shelfEntry.tags.some((t) => t.id === tag!.id)) {
        setTagInput("");
        return;
      }
      const tagIds = [...shelfEntry.tags.map((t) => t.id), tag.id];
      const updated = await shelfApi.update(shelfEntry.id, { tagIds });
      setShelfEntry(updated);
      setTagInput("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "タグの追加に失敗しました。");
    } finally {
      setSavingTag(false);
    }
  }

  async function removeTag(tagId: string) {
    if (!shelfEntry) return;
    const tagIds = shelfEntry.tags.filter((t) => t.id !== tagId).map((t) => t.id);
    const updated = await shelfApi.update(shelfEntry.id, { tagIds });
    setShelfEntry(updated);
  }

  function startEditingTitle() {
    setTitleDraft(novel?.title ?? "");
    setEditingTitle(true);
  }

  async function saveTitle() {
    const title = titleDraft.trim();
    if (!title || !novel) return;
    setSavingTitle(true);
    try {
      const updated = await novelsApi.updateTitle(novel.id, title);
      setNovel(updated);
      setEditingTitle(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "タイトルの更新に失敗しました。");
    } finally {
      setSavingTitle(false);
    }
  }

  async function downloadAll() {
    setDownloading(true);
    setDownloadMessage(null);
    try {
      const contents = await novelsApi.downloadAll(novelId);
      for (const c of contents) {
        await putCachedChapter({
          chapterId: c.chapterId,
          novelId,
          chapterNo: c.chapterNo,
          title: c.title,
          bodyHtml: c.bodyHtml,
          sourceUrl: c.sourceUrl,
        });
      }
      setDownloadMessage(`全${contents.length}話をこの端末に保存しました。`);
    } catch (err) {
      setDownloadMessage(err instanceof ApiError ? err.message : "オフライン保存に失敗しました。");
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) {
    return <p className="p-6 text-center text-sm text-muted">読み込み中...</p>;
  }
  if (error || !novel) {
    return <p className="p-6 text-center text-sm text-update">{error ?? "作品が見つかりません。"}</p>;
  }

  const continueChapterId = position?.chapterId ?? chapters[0]?.id;

  return (
    <div className="flex flex-col gap-5 px-4 pt-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted">
        <ChevronLeftIcon className="h-4 w-4" /> 戻る
      </button>

      <div className="flex gap-4">
        <BookCover novelId={novel.id} title={novel.title} className="w-28 shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          {editingTitle ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
              />
              <button
                onClick={saveTitle}
                disabled={savingTitle}
                className="shrink-0 rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground disabled:opacity-50"
              >
                保存
              </button>
              <button
                onClick={() => setEditingTitle(false)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted"
              >
                取消
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-bold leading-snug">{novel.title}</h1>
              {chapters.length === 0 && (
                <button onClick={startEditingTitle} aria-label="タイトルを編集" className="shrink-0 text-muted">
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          <Link href={`/authors/${encodeURIComponent(novel.author)}`} className="text-sm text-accent-soft underline underline-offset-2">
            {novel.author}
          </Link>
          <p className="text-xs text-muted">
            {novel.site ?? "外部リンク"} ・ {novel.status === "COMPLETED" ? "完結" : "連載中"} ・ 全
            {novel.totalChapters}話
          </p>
        </div>
      </div>

      {novel.synopsis && <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{novel.synopsis}</p>}

      <div className="flex flex-col gap-2">
        {continueChapterId ? (
          <Link
            href={`/novels/${novel.id}/chapters/${continueChapterId}`}
            className="rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-foreground"
          >
            {position ? "続きから読む" : "読み始める"}
          </Link>
        ) : (
          // continueChapterIdはchapters[0]?.idからも導出されるため、ここに来る時点で
          // chaptersは必ず空(＝アプリ内で読める話が無い)。外部サイトへの導線を表示する。
          <a
            href={novel.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-foreground"
          >
            外部サイトで読む
          </a>
        )}

        {shelfEntry ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
            <div className="flex gap-2">
              {(Object.keys(STATUS_LABEL) as ShelfStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                    shelfEntry.status === s ? "border-accent bg-accent-tint text-accent-soft" : "border-border text-muted"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {shelfEntry.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="flex items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1 text-[11px] font-medium text-accent-soft"
                >
                  {tag.name}
                  <button
                    onClick={() => removeTag(tag.id)}
                    aria-label={`タグ「${tag.name}」を削除`}
                    className="text-accent-soft/70 hover:text-accent-soft"
                  >
                    ×
                  </button>
                </span>
              ))}
              <form onSubmit={addTag} className="flex items-center gap-1">
                <input
                  list="existing-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="タグを追加"
                  className="w-24 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={savingTag || !tagInput.trim()}
                  className="text-[11px] font-semibold text-accent-soft disabled:opacity-40"
                >
                  追加
                </button>
              </form>
              <datalist id="existing-tags">
                {allTags.map((tag) => (
                  <option key={tag.id} value={tag.name} />
                ))}
              </datalist>
            </div>
            <button onClick={removeFromShelf} className="text-xs text-muted underline underline-offset-2">
              本棚から削除
            </button>
          </div>
        ) : (
          <button
            onClick={addToShelf}
            className="rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent-soft"
          >
            本棚に追加
          </button>
        )}

        {chapters.length > 0 && (
          <div className="flex flex-col gap-1">
            <button
              onClick={downloadAll}
              disabled={downloading}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              {downloading ? "取得中...(話数が多いと数分かかります)" : "全話をオフライン保存"}
            </button>
            {downloadMessage && <p className="text-xs text-muted">{downloadMessage}</p>}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 pb-6">
        <h2 className="text-sm font-bold text-muted">話一覧（全{chapters.length}話）</h2>
        {chapters.map((c) => (
          <Link
            key={c.id}
            href={`/novels/${novel.id}/chapters/${c.id}`}
            className={`flex items-center justify-between rounded-lg px-2 py-2.5 text-sm hover:bg-card ${
              c.id === position?.chapterId ? "bg-accent-tint text-accent-soft" : ""
            }`}
          >
            <span className="truncate">
              第{c.chapterNo}話 {c.title}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
