"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { settingsApi, type UserSettings } from "@/lib/api";
import { applyTheme } from "@/lib/theme/applyTheme";

const DEFAULT_SETTINGS: UserSettings = {
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
};

interface SettingsContextValue {
  settings: UserSettings;
  isLoading: boolean;
  update: (patch: Partial<UserSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    settingsApi
      .get()
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        applyTheme(s.darkMode);
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
      const saved = await settingsApi.update(next);
      setSettings(saved);
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
