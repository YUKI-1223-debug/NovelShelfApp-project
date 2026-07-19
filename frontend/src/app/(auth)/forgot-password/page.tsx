"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await authApi.requestPasswordReset(email);
    } finally {
      // メールアドレスが存在するかどうかに関わらず同じ結果を表示する（アカウント有無の推測を防ぐため）。
      setSubmitting(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <p className="text-sm text-foreground">
          ご入力いただいたメールアドレス宛にパスワード再設定用のメールを送信しました（該当するアカウントが存在する場合）。メールをご確認ください。
        </p>
        <Link href="/login" className="text-sm font-semibold text-accent-soft underline underline-offset-2">
          ログイン画面に戻る
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <p className="text-sm text-muted">登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-semibold text-muted">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "送信中..." : "再設定メールを送る"}
      </button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-accent-soft underline underline-offset-2">
          ログイン画面に戻る
        </Link>
      </p>
    </form>
  );
}
