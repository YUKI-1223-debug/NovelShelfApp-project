"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { settingsApi, type UserSettings } from "@/lib/api";
import { applyTheme } from "@/lib/theme/applyTheme";

export const DEFAULT_SETTINGS: UserSettings = {
  darkMode: false,
  writingMode: "VERTICAL",
  fontFamily: "MINCHO",
  fontSize: 16,
  lineHeight: 1.8,
  marginSize: "MEDIUM",
  backgroundColor: "DEFAULT",
  theme: "DEFAULT",
  pageMode: "SCROLL",
  shelfSortOrder: "ADDED_DESC",
  pageTurnGesture: "TAP",
};

/** 表示設定は端末ごとに保存する(個人利用アプリ化 フェーズ2 設計書 §7-3、ユーザー判断 6)。 */
export const SETTINGS_STORAGE_KEY = "novelshelf.settings.v1";

export function loadLocalSettings(): UserSettings | null {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    // 項目が増えたときに古い保存値でも動くよう、既定値に重ねる
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<UserSettings>) };
  } catch {
    return null;
  }
}

function saveLocalSettings(settings: UserSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage が使えない環境では、この起動のあいだだけ反映する
  }
}

interface SettingsContextValue {
  settings: UserSettings;
  isLoading: boolean;
  update: (patch: Partial<UserSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * 表示設定(縦横・フォント・文字サイズ・行間・余白・背景・テーマ・ページめくり・ダークモード・本棚の並び順)。
 *
 * 端末の localStorage だけを読み書きし、サーバーには保存しない(端末ごとに違う設定にできる。オフラインでも効く)。
 * この端末で初めて起動したときだけ、サーバーの今の値(GET /settings)を取り込んで初期値にする
 * (それまで全端末共通だった設定を失わないため)。サーバーの user_settings は消さず、読むだけにする。
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // localStorage は静的エクスポートの事前描画では読めないので、初期値ではなくマウント後に読む
    // (effect 内で同期的に setState しないよう、マイクロタスクに回す)
    const local = loadLocalSettings();
    if (local) {
      queueMicrotask(() => {
        setSettings(local);
        applyTheme(local.darkMode);
        setIsLoading(false);
      });
      return;
    }

    let cancelled = false;
    settingsApi
      .get()
      .then((s) => {
        if (cancelled) return;
        const imported = { ...DEFAULT_SETTINGS, ...s };
        saveLocalSettings(imported);
        setSettings(imported);
        applyTheme(imported.darkMode);
      })
      .catch(() => {
        // 取り込めなかったときは既定値で表示する(保存はしないので、次の起動でもう一度取り込みを試す)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(
    async (patch: Partial<UserSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      applyTheme(next.darkMode);
      saveLocalSettings(next);
    },
    [settings]
  );

  return <SettingsContext.Provider value={{ settings, isLoading, update }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
