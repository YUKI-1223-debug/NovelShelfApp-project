"use client";

import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { ApiError, statsApi, type BreakdownItem, type CalendarDay, type StatsSummary } from "@/lib/api";
import { formatDuration } from "@/lib/utils/formatDuration";

type Dimension = "site" | "author" | "month";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function StatsPage() {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [dimension, setDimension] = useState<Dimension>("site");
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      statsApi
        .summary()
        .then(setSummary)
        .catch((err) => setError(err instanceof ApiError ? err.message : "統計の取得に失敗しました。"));
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      statsApi.breakdown(dimension, "all").then(setBreakdown).catch(() => setBreakdown([]));
    });
  }, [dimension]);

  useEffect(() => {
    queueMicrotask(() => {
      statsApi.calendar(monthKey(cursor)).then(setCalendar).catch(() => setCalendar([]));
    });
  }, [cursor]);

  const maxCalendarSeconds = Math.max(1, ...calendar.map((d) => d.readingSeconds));
  const calendarByDate = new Map(calendar.map((d) => [d.date, d.readingSeconds]));

  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const cells: (string | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), i + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
  ];

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-6">
      <h1 className="text-xl font-bold">読書統計</h1>
      {error && <p className="text-sm text-update">{error}</p>}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
          <p className="text-lg font-bold tabular-nums">{summary?.totalCompletedNovels ?? "–"}</p>
          <p className="text-[10px] text-muted">読了作品数</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
          <p className="text-lg font-bold tabular-nums">{summary?.totalReadChapters ?? "–"}</p>
          <p className="text-[10px] text-muted">総読了話数</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
          <p className="text-lg font-bold tabular-nums">
            {summary ? formatDuration(summary.totalReadingSeconds) : "–"}
          </p>
          <p className="text-[10px] text-muted">総読書時間</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-muted">
            {cursor.getFullYear()}年{cursor.getMonth() + 1}月
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="rounded-full border border-border p-1"
              aria-label="前の月"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="rounded-full border border-border p-1"
              aria-label="次の月"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DOW.map((d) => (
            <span key={d} className="text-center text-[10px] text-muted">
              {d}
            </span>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const seconds = calendarByDate.get(date) ?? 0;
            const intensity = seconds === 0 ? 0 : Math.min(3, Math.ceil((seconds / maxCalendarSeconds) * 3));
            return (
              <div
                key={date}
                title={`${date}: ${formatDuration(seconds)}`}
                className="aspect-square rounded"
                style={{
                  background:
                    intensity === 0
                      ? "var(--border)"
                      : `color-mix(in srgb, var(--accent) ${intensity * 30 + 10}%, var(--border))`,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-1.5">
          {(["site", "author", "month"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDimension(d)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                dimension === d ? "border-accent bg-accent-tint text-accent-soft" : "border-border text-muted"
              }`}
            >
              {d === "site" ? "サイト別" : d === "author" ? "作者別" : "月別"}
            </button>
          ))}
        </div>
        {breakdown.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">まだデータがありません。</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {breakdown.map((item) => {
              const max = Math.max(...breakdown.map((b) => b.readingSeconds), 1);
              const pct = Math.max(4, (item.readingSeconds / max) * 100);
              return (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 truncate text-xs">{item.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-[11px] text-muted tabular-nums">
                    {formatDuration(item.readingSeconds)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
