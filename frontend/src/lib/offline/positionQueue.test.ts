import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, readingApi } from "@/lib/api";
import { flushPendingPositions, queuePendingPosition } from "./positionQueue";

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>();
  return { ...actual, readingApi: { ...actual.readingApi, putPosition: vi.fn() } };
});

const putPosition = vi.mocked(readingApi.putPosition);

describe("positionQueue", () => {
  beforeEach(async () => {
    putPosition.mockReset();
    // 前のテストで残ったキューを空にする
    putPosition.mockResolvedValue({} as never);
    await flushPendingPositions();
    putPosition.mockReset();
  });

  it("sends the time the position was read (not the time it was flushed)", async () => {
    const readAt = Date.UTC(2026, 9, 18, 1, 23, 45);
    await queuePendingPosition("novel-1", "chapter-3", 0.42, readAt);
    putPosition.mockResolvedValue({} as never);

    await flushPendingPositions();

    expect(putPosition).toHaveBeenCalledWith("novel-1", "chapter-3", 0.42, new Date(readAt).toISOString());
  });

  it("keeps the position queued when the network is still down", async () => {
    await queuePendingPosition("novel-2", "chapter-1", 0.1, Date.now());
    putPosition.mockRejectedValueOnce(new Error("offline"));
    await flushPendingPositions();

    putPosition.mockResolvedValue({} as never);
    await flushPendingPositions();

    expect(putPosition).toHaveBeenCalledTimes(2);
  });

  it("drops the position when the server rejects it", async () => {
    await queuePendingPosition("novel-3", "chapter-1", 0.1, Date.now());
    putPosition.mockRejectedValueOnce(new ApiError(404, "not found"));
    await flushPendingPositions();

    putPosition.mockResolvedValue({} as never);
    await flushPendingPositions();

    expect(putPosition).toHaveBeenCalledTimes(1);
  });
});
