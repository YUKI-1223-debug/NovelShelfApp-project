import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, NETWORK_ERROR_EVENT } from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { hello: "world" })));

    const result = await apiFetch<{ hello: string }>("/ping");

    expect(result).toEqual({ hello: "world" });
  });

  it("throws ApiError with the server message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { message: "見つかりません" })));

    await expect(apiFetch("/missing")).rejects.toMatchObject({ status: 404, message: "見つかりません" });
  });

  it("does not send an Authorization header (login is replaced by owner mode)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/shelf");

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("maps 401 to ApiError(401) without retrying or refreshing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { message: "unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/shelf")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries GET up to twice on network errors", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/shelf")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry PUT, throws a plain Error (retriable for offline queues) and reports it", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const listener = vi.fn();
    window.addEventListener(NETWORK_ERROR_EVENT, listener);

    const error = await apiFetch("/reading/positions/x", { method: "PUT", body: {} }).catch((e: unknown) => e);

    // ApiError でないこと: downloadNovel.ts / positionQueue.ts は「ApiError でない = 通信の失敗」として再試行する
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(NETWORK_ERROR_EVENT, listener);
  });

  it("times out when the server does not answer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));

    const promise = apiFetch("/shelf", { method: "POST", timeoutMs: 1_000 });
    const assertion = expect(promise).rejects.not.toBeInstanceOf(ApiError);
    await vi.advanceTimersByTimeAsync(1_000);

    await assertion;
  });
});
