"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && isAuthenticated) {
      // "/"以外への相対パスのみ許可する（next経由の外部URLへのオープンリダイレクト対策）。
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
    }
  }, [isReady, isAuthenticated, router]);

  if (isReady && isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
