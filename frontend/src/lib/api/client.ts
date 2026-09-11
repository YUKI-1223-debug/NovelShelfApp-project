import type { ApiErrorBody, AuthTokens } from "./types";
import { clearTokens, getAccessToken, getRefreshToken, notifyUnauthorized, setTokens } from "./tokenStore";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8081/api/v1";

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
  auth?: boolean;
}

// "invalid": サーバーがリフレッシュトークンを拒否した(期限切れ・失効済み) → ログアウトさせてよい。
// "network-error": リクエスト自体が通信エラーで失敗した → リフレッシュトークンが無効と決まった
// わけではないので、ここでログアウトさせてはいけない(長時間アプリを放置した直後は、端末が
// スリープから復帰してネットワークが再接続する瞬間と重なりやすく、通信が一時的に失敗しがち。
// これを"invalid"と区別せず毎回ログアウト扱いにしていたため、少し放置しただけでホーム画面
// 〈ログイン画面〉に戻されてしまう不具合になっていた。2026-09-12、ユーザー報告）。
type RefreshResult = "ok" | "invalid" | "network-error";

let refreshPromise: Promise<RefreshResult> | null = null;

async function refreshTokens(): Promise<RefreshResult> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return "invalid";

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return "invalid" as const;
        const tokens: AuthTokens = await res.json();
        setTokens(tokens.accessToken, tokens.refreshToken);
        return "ok" as const;
      })
      .catch(() => "network-error" as const)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body: ApiErrorBody = await res.json();
    return body.message ?? `リクエストに失敗しました (${res.status})`;
  } catch {
    return `リクエストに失敗しました (${res.status})`;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) {
      const token = getAccessToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && auth && getRefreshToken()) {
    const result = await refreshTokens();
    if (result === "ok") {
      res = await doFetch();
    } else if (result === "network-error") {
      // トークンは維持したまま、通常の通信エラーとして呼び出し元に委ねる
      // (ApiErrorではなくErrorを投げ、他の純粋な通信失敗と同じ扱い＝再試行可能にする。
      // downloadNovel.tsのretriable判定等、`instanceof ApiError`でない=再試行可という
      // 既存の使い分けに合わせる)。
      throw new Error("通信エラーが発生しました。電波状況を確認してもう一度お試しください。");
    } else {
      notifyUnauthorized();
      throw new ApiError(401, "認証の有効期限が切れました。再度ログインしてください。");
    }
  }

  if (res.status === 401 && auth) {
    clearTokens();
    notifyUnauthorized();
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
