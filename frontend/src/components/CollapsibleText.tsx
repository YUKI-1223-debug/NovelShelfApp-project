"use client";

import { useState } from "react";

// 4行(line-clamp-4)に収まらなそうな長さの目安。スマホ幅(1行およそ20〜25字)で4行を超える長さ
const COLLAPSE_CHARS = 100;
const COLLAPSE_LINES = 4;

/** 長いときだけ折りたたむか。改行の数か文字数で判定する(表示の高さを測ると描画のたびに計測が要るため)。 */
export function shouldCollapse(text: string): boolean {
  return text.length > COLLAPSE_CHARS || text.split("\n").length > COLLAPSE_LINES;
}

/**
 * 長い文章を最初は4行までにして、「続きを表示」で全文を出す。作品の説明文が長いと、
 * 下までスクロールしないと「続きから読む」を押せなかったため(2026-10-19 ユーザー要望)。
 */
export function CollapsibleText({ text, className = "" }: { text: string; className?: string }) {
  const collapsible = shouldCollapse(text);
  const [expanded, setExpanded] = useState(false);
  const clamped = collapsible && !expanded;

  return (
    <div>
      <p className={`whitespace-pre-wrap ${clamped ? "line-clamp-4" : ""} ${className}`}>{text}</p>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1 text-xs text-accent-soft underline underline-offset-2"
        >
          {expanded ? "閉じる" : "続きを表示"}
        </button>
      )}
    </div>
  );
}
