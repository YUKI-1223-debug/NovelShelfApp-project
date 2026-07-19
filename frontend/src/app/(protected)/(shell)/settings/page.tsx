"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
      <span>{label}</span>
      {children}
    </div>
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        active ? "border-accent bg-accent-tint text-accent-soft" : "border-border text-muted"
      }`}
    >
      {children}
    </button>
  );
}

export default function SettingsPage() {
  const { settings, isLoading, update } = useSettings();
  const { logout } = useAuth();

  return (
    <div className="flex flex-col gap-4 pt-6">
      <h1 className="px-4 text-xl font-bold">設定</h1>

      {isLoading ? (
        <p className="px-4 text-sm text-muted">読み込み中...</p>
      ) : (
        <div className="flex flex-col">
          <p className="px-4 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted">読書</p>

          <Row label="ダークモード">
            <button
              onClick={() => update({ darkMode: !settings.darkMode })}
              className={`h-6 w-10 rounded-full transition-colors ${settings.darkMode ? "bg-accent" : "bg-border"}`}
            >
              <span
                className={`block h-4 w-4 translate-x-1 rounded-full bg-card transition-transform ${
                  settings.darkMode ? "translate-x-5" : ""
                }`}
              />
            </button>
          </Row>

          <Row label="表示方向">
            <div className="flex gap-1.5">
              <SegButton active={settings.writingMode === "VERTICAL"} onClick={() => update({ writingMode: "VERTICAL" })}>
                縦書き
              </SegButton>
              <SegButton
                active={settings.writingMode === "HORIZONTAL"}
                onClick={() => update({ writingMode: "HORIZONTAL" })}
              >
                横書き
              </SegButton>
            </div>
          </Row>

          <Row label="フォント">
            <div className="flex gap-1.5">
              <SegButton active={settings.fontFamily === "MINCHO"} onClick={() => update({ fontFamily: "MINCHO" })}>
                明朝
              </SegButton>
              <SegButton active={settings.fontFamily === "GOTHIC"} onClick={() => update({ fontFamily: "GOTHIC" })}>
                ゴシック
              </SegButton>
            </div>
          </Row>

          <Row label="文字サイズ">
            <div className="flex items-center gap-2">
              <button
                onClick={() => update({ fontSize: Math.max(12, settings.fontSize - 1) })}
                className="h-7 w-7 rounded-full border border-border text-sm"
              >
                −
              </button>
              <span className="w-10 text-center text-xs">{settings.fontSize}px</span>
              <button
                onClick={() => update({ fontSize: Math.min(28, settings.fontSize + 1) })}
                className="h-7 w-7 rounded-full border border-border text-sm"
              >
                ＋
              </button>
            </div>
          </Row>

          <Row label="行間">
            <div className="flex items-center gap-2">
              <button
                onClick={() => update({ lineHeight: Math.max(1.2, Math.round((settings.lineHeight - 0.1) * 10) / 10) })}
                className="h-7 w-7 rounded-full border border-border text-sm"
              >
                −
              </button>
              <span className="w-10 text-center text-xs">{settings.lineHeight.toFixed(1)}</span>
              <button
                onClick={() => update({ lineHeight: Math.min(2.6, Math.round((settings.lineHeight + 0.1) * 10) / 10) })}
                className="h-7 w-7 rounded-full border border-border text-sm"
              >
                ＋
              </button>
            </div>
          </Row>

          <Row label="余白">
            <div className="flex gap-1.5">
              {(["SMALL", "MEDIUM", "LARGE"] as const).map((m) => (
                <SegButton key={m} active={settings.marginSize === m} onClick={() => update({ marginSize: m })}>
                  {m === "SMALL" ? "狭い" : m === "MEDIUM" ? "標準" : "広い"}
                </SegButton>
              ))}
            </div>
          </Row>

          <Row label="ページ送り">
            <div className="flex gap-1.5">
              <SegButton active={settings.pageMode === "SCROLL"} onClick={() => update({ pageMode: "SCROLL" })}>
                スクロール
              </SegButton>
              <SegButton active={settings.pageMode === "PAGINATION"} onClick={() => update({ pageMode: "PAGINATION" })}>
                ページ送り
              </SegButton>
            </div>
          </Row>

          <p className="px-4 pb-1 pt-6 text-xs font-bold uppercase tracking-wide text-muted">アカウント</p>
          <button onClick={logout} className="px-4 py-3 text-left text-sm text-update">
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
