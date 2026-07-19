"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, novelsApi, shelfApi, type NovelDetail } from "@/lib/api";

type Result = { status: "loading" } | { status: "success"; novel: NovelDetail } | { status: "error"; message: string };

function extractUrl(searchParams: URLSearchParams): string | null {
  // Web Share Target APIはurl/text両方に共有元のURLを入れてくることがあるため両方見る。
  const url = searchParams.get("url");
  if (url) return url;
  const text = searchParams.get("text");
  if (text) {
    const match = text.match(/https?:\/\/\S+/);
    if (match) return match[0];
  }
  return null;
}

function SharePageContent() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<Result>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      const url = extractUrl(searchParams);
      if (!url) {
        setResult({ status: "error", message: "共有されたURLが見つかりませんでした。" });
        return;
      }

      try {
        const novel = await novelsApi.resolve(url);
        await shelfApi.add(novel.id, "READING");
        if (!cancelled) setResult({ status: "success", novel });
      } catch (err) {
        if (!cancelled) {
          setResult({
            status: "error",
            message: err instanceof ApiError ? err.message : "作品の取得に失敗しました。",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      {result.status === "loading" && <p className="text-sm text-muted">本棚に追加しています...</p>}

      {result.status === "success" && (
        <>
          <p className="text-sm text-foreground">
            「{result.novel.title}」を本棚に追加しました。
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href={`/novels/${result.novel.id}`}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
            >
              作品を見る
            </Link>
            <Link href="/" className="text-sm text-muted underline underline-offset-2">
              本棚に戻る
            </Link>
          </div>
        </>
      )}

      {result.status === "error" && (
        <>
          <p className="text-sm text-update">{result.message}</p>
          <Link href="/" className="text-sm text-muted underline underline-offset-2">
            本棚に戻る
          </Link>
        </>
      )}
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={null}>
      <SharePageContent />
    </Suspense>
  );
}
