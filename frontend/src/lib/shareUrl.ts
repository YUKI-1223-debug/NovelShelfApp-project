/**
 * 共有シートから届いた {@code novelshelf://share?url=...} / {@code novelshelf://share?text=...} を、
 * アプリ内の /share 画面のパスに変換する(個人利用アプリ化 S2-7・S2-8)。
 *
 * Android は MainActivity が ACTION_SEND を、iOS は Share Extension が共有された内容を、この形の URL にして本体へ渡す。
 * 対象外の URL のときは null。
 */
export function sharePathFromAppUrl(appUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(appUrl);
  } catch {
    return null;
  }
  // novelshelf://share?... は host が "share"(ブラウザの実装によっては pathname が "//share")
  const isShare =
    parsed.protocol === "novelshelf:" && (parsed.host === "share" || parsed.pathname.replace(/^\/+/, "") === "share");
  if (!isShare) return null;

  const params = new URLSearchParams();
  const url = parsed.searchParams.get("url");
  const text = parsed.searchParams.get("text");
  if (url) params.set("url", url);
  if (text) params.set("text", text);
  if (!url && !text) return null;
  return `/share?${params.toString()}`;
}
