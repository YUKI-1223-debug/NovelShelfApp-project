"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authApi, clearTokens, getAccessToken, setTokens, setUnauthorizedHandler } from "@/lib/api";

interface AuthContextValue {
  isAuthenticated: boolean;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    queueMicrotask(() => {
      setIsAuthenticated(!!getAccessToken());
      setIsReady(true);
    });

    setUnauthorizedHandler(() => {
      setIsAuthenticated(false);
      router.replace("/login");
    });
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isReady,
      login: async (email, password) => {
        const tokens = await authApi.login(email, password);
        setTokens(tokens.accessToken, tokens.refreshToken);
        setIsAuthenticated(true);
      },
      signup: async (email, password, displayName) => {
        const tokens = await authApi.signup(email, password, displayName);
        setTokens(tokens.accessToken, tokens.refreshToken);
        setIsAuthenticated(true);
      },
      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // トークンが既に無効でも、ローカルの状態は必ずクリアする
        }
        clearTokens();
        setIsAuthenticated(false);
        router.replace("/login");
      },
    }),
    [isAuthenticated, isReady, router]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
