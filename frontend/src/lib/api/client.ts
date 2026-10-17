import type { ApiErrorBody } from "./types";
import { isTauriPlatform } from "@/lib/platform";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8081/api/v1";

const DEFAULT_TIMEOUT_MS = 15_000;
const GET_RETRY_LIMIT = 2;
const RETRY_BASE_DELAY_MS = 500;

/** 通信エラー(サーバーに届かなかった)のときに window へ送るイベント。ConnectionBanner が受け取る */
export const NETWORK_ERROR_EVENT = "api:network-error";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** 打ち切るまでの時間(既定 15 秒) */
  timeoutMs?: number;
}

let tauriFetchPromise: Promise<typeof fetch> | null = null;

/**
 * Windows(Tauri)では `@tauri-apps/plugin-http` の fetch を使う(ネイティブ HTTP 層を通るので CORS の対象外)。
 * Android/iOS(Capacitor)は CapacitorHttp が通常の fetch をネイティブ実装に差し替えるので、そのままでよい。
 */
function platformFetch(): Promise<typeof fetch> {
  if (!isTauriPlatform()) return Promise.resolve(fetch);
  if (!tauriFetchPromise) {
    tauriFetchPromise = import("@tauri-apps/plugin-http").then((m) => m.fetch as unknown as typeof fetch);
  }
  return tauriFetchPromise;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * タイムアウト付きの fetch。CapacitorHttp が AbortSignal に対応していない場合に備え、
 * signal での中断に加えてタイマーとの競争でも打ち切る。
 */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const f = await platformFetch();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([f(url, { ...init, signal: controller.signal }), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function notifyNetworkError(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NETWORK_ERROR_EVENT));
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body: ApiErrorBody = await res.json();
    return body.message ?? `リクエストに失敗しました (${res.status})`;
  } catch {
    return `リクエストに失敗しました (${res.status})`;
  }
}

/**
 * 共通 API クライアント。ログインは廃止し、サーバー側のオーナー固定モード(tailnet 由来のリクエストを
 * オーナーとして扱う)で認証するので、トークンは送らない(個人利用アプリ化 フェーズ2 設計書 §4)。
 *
 * - GET だけ通信エラー時に2回まで再試行する。POST などは二重登録を防ぐため再試行しない
 * - 通信エラー(届かなかった・タイムアウト)は ApiError ではなく Error を投げる。オフライン保存
 *   (downloadNovel.ts)は「ApiError でない = 通信の失敗なので再試行してよい」として扱っている
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const retryLimit = method === "GET" ? GET_RETRY_LIMIT : 0;

  let res: Response;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetchWithTimeout(
        `${API_BASE_URL}${path}`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        },
        timeoutMs
      );
      break;
    } catch {
      if (attempt < retryLimit) {
        await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      notifyNetworkError();
      throw new Error("サーバーに接続できません。Tailscale が ON か確認してください。");
    }
  }

  if (res.status === 401) {
    throw new ApiError(401, "このネットワークからは使えません。Tailscale が ON か確認してください。");
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/** 接続確認用の URL(`/api/v1` の外にある Actuator)。 */
export function healthUrl(): string {
  return `${new URL(API_BASE_URL).origin}/actuator/health`;
}

/** サーバーにつながるかを確認する(5 秒で打ち切り)。 */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(healthUrl(), { method: "GET" }, 5_000);
    return res.ok;
  } catch {
    return false;
  }
}
