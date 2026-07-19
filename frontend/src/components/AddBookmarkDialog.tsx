"use client";

import { forwardRef, useState, type FormEvent } from "react";
import { ApiError, bookmarksApi } from "@/lib/api";

interface AddBookmarkDialogProps {
  chapterId: string;
  scrollPosition: number;
  onAdded: () => void;
}

export const AddBookmarkDialog = forwardRef<HTMLDialogElement, AddBookmarkDialogProps>(function AddBookmarkDialog(
  { chapterId, scrollPosition, onAdded },
  ref
) {
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function closeDialog() {
    if (ref && "current" in ref) ref.current?.close();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await bookmarksApi.create({ chapterId, name: name.trim(), memo: memo.trim() || undefined, scrollPosition });
      setName("");
      setMemo("");
      closeDialog();
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "しおりの作成に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="w-[min(90vw,26rem)] rounded-2xl border border-border bg-card p-0 text-foreground backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <h2 className="text-base font-bold">しおりを追加</h2>
        <input
          type="text"
          required
          placeholder="名前（例: 伏線が回収された瞬間）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <textarea
          placeholder="メモ（任意）"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {error && <p className="text-sm text-update">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={closeDialog} className="rounded-lg px-3 py-2 text-sm font-medium text-muted">
            キャンセル
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </form>
    </dialog>
  );
});
