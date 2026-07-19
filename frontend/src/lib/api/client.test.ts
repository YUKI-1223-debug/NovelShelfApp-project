import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./client";
import { clearTokens, setTokens, setUnauthorizedHandler } from "./tokenStore";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch", () => {
  beforeEach(() => {
    clearTokens();
    setUnauthorizedHandler(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { hello: "world" }))
    );

    const result = await apiFetch<{ hello: string }>("/ping", { auth: false });

    expect(result).toEqual({ hello: "world" });
  });

  it("throws ApiError with the server message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(404, { message: "見つかりません" }))
    );

    await expect(apiFetch("/missing", { auth: false })).rejects.toMatchObject({
      status: 404,
      message: "見つかりません",
    });
  });

  it("automatically refreshes the access token once on 401 and retries", async () => {
    setTokens("expired-access-token", "valid-refresh-token");

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        callCount++;
        if (url.includes("/auth/refresh")) {
          return jsonResponse(200, {
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
            expiresIn: 1800,
          });
        }
        if (callCount === 1) {
          return jsonResponse(401, { message: "unauthorized" });
        }
        return jsonResponse(200, { ok: true });
      })
    );

    const result = await apiFetch<{ ok: boolean }>("/shelf");

    expect(result).toEqual({ ok: true });
  });

  it("calls the unauthorized handler when refresh fails", async () => {
    setTokens("expired-access-token", "invalid-refresh-token");
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/auth/refresh")) {
          return jsonResponse(401, { message: "invalid refresh token" });
        }
        return jsonResponse(401, { message: "unauthorized" });
      })
    );

    await expect(apiFetch("/shelf")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalled();
  });
});
