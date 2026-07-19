"use client";

import { forwardRef, useState, type FormEvent } from "react";
import { ApiError, novelsApi, shelfApi } from "@/lib/api";

interface AddNovelDialogProps {
  onAdded: () => void;
}

export const AddNovelDialog = forwardRef<HTMLDialogElement, AddNovelDialogProps>(function AddNovelDialog(
  { onAdded },
  ref
) {
  const [url, setUrl] = useState("");
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
      const novel = await novelsApi.resolve(url.trim());
      await shelfApi.add(novel.id, "READING");
      setUrl("");
      closeDialog();
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "作品の取得に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="w-[min(90vw,26rem)] rounded-2xl border border-border bg-card p-0 text-foreground backdrop:bg-black/40"
      onClose={() => {
        setUrl("");
        setError(null);
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-base font-bold">作品を追加</h2>
          <p className="mt-1 text-xs text-muted">
            なろう（ncode.syosetu.com）のURLは作品情報を取得します。他サイトはリンクのみ登録されます。
          </p>
        </div>
        <input
          type="url"
          required
          placeholder="https://ncode.syosetu.com/xxxxxx/"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {error && <p className="text-sm text-update">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeDialog}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-foreground"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
          >
            {submitting ? "取得中..." : "追加"}
          </button>
        </div>
      </form>
    </dialog>
  );
});
