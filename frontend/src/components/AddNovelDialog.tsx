"use client";

import { forwardRef, useState, type FormEvent } from "react";
import { ApiError, novelsApi, shelfApi } from "@/lib/api";
import { toStandaloneExternalHref, useIsStandalone } from "@/lib/utils/useIsStandalone";

interface AddNovelDialogProps {
  onAdded: () => void;
}

// 各小説サイトの検索ページを新しいタブで開くためのURL。ブラウザのクロスオリジン制限により、
// 開いたタブのURLをこちら側から自動で読み取ることはできない（詳細はdocs/DECISIONS.md参照）ため、
// 検索→対象ページのURLをコピー→このダイアログに戻って「追加」を押すとクリップボードから
// 自動で読み取る、という二段構えのフローにしている。
// なろうのR18作品はnovel18.syosetu.com単体に統一された検索ページがなく、
// ノクターン/ムーンライト/ミッドナイトのブランドごとに検索ページが分かれているため、
// 1つにまとめず個別のボタンにしている（実機確認でURLが異なると判明、2026-07-19）。
const SEARCH_LINKS = [
  { label: "なろう", url: "https://yomou.syosetu.com/search.php" },
  { label: "ノクターン", url: "https://noc.syosetu.com/search/" },
  { label: "ムーンライト", url: "https://mnlt.syosetu.com/search/" },
  { label: "ミッドナイト", url: "https://mid.syosetu.com/search/" },
  { label: "カクヨム", url: "https://kakuyomu.jp/search" },
  { label: "ハーメルン", url: "https://syosetu.org/search/" },
  { label: "ハーメルン(R18)", url: "https://h.syosetu.org/search/" },
];

export const AddNovelDialog = forwardRef<HTMLDialogElement, AddNovelDialogProps>(function AddNovelDialog(
  { onAdded },
  ref
) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isStandalone = useIsStandalone();

  function closeDialog() {
    if (ref && "current" in ref) ref.current?.close();
  }

  // クリップボード読み取りに対応していないブラウザ（iOS Safari等）や、権限拒否時は
  // 例外を投げずnullを返す。呼び出し側は「手動で貼り付けてください」にフォールバックする。
  async function readUrlFromClipboard(): Promise<string | null> {
    try {
      if (!navigator.clipboard?.readText) return null;
      const text = (await navigator.clipboard.readText()).trim();
      return /^https?:\/\//.test(text) ? text : null;
    } catch {
      return null;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let targetUrl = url.trim();
      if (!targetUrl) {
        // URL欄が空のまま「追加」を押した場合のみ、クリップボードから自動取得を試みる
        // （明示的な貼り付け操作を挟まないため、ユーザーが空欄のまま押した=クリップボードの
        // URLを使いたい、という意図とみなす）。
        const fromClipboard = await readUrlFromClipboard();
        if (!fromClipboard) {
          setError("URLを入力するか、コピーしてから「追加」を押してください。");
          setSubmitting(false);
          return;
        }
        targetUrl = fromClipboard;
        setUrl(fromClipboard);
      }
      const novel = await novelsApi.resolve(targetUrl);
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
            なろう（ncode.syosetu.com、R18のnovel18.syosetu.comも可）・カクヨム（kakuyomu.jp）・ハーメルン（syosetu.org、R18のh.syosetu.orgも可）のURLは作品情報を取得します。pixiv小説等その他のサイトはリンクのみ登録されます（あとでタイトルを編集できます）。
          </p>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-muted">検索ページを開く:</p>
          <div className="flex flex-wrap gap-1.5">
            {SEARCH_LINKS.map((site) => (
              <a
                key={site.label}
                href={isStandalone ? toStandaloneExternalHref(site.url) : site.url}
                target={isStandalone ? undefined : "_blank"}
                rel={isStandalone ? undefined : "noopener noreferrer"}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
              >
                {site.label}
              </a>
            ))}
          </div>
        </div>
        <input
          type="url"
          placeholder="URLを貼り付け、または空欄のまま「追加」でコピー済みURLを使用"
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
