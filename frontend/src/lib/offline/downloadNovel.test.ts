import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chapter } from "@/lib/api";
import { downloadNovelOffline, type DownloadProgress } from "./downloadNovel";
import { getCachedChapter, putCachedChapter } from "./chapterCache";

const { contentMock } = vi.hoisted(() => ({ contentMock: vi.fn() }));

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>();
  return { ...actual, novelsApi: { ...actual.novelsApi, content: contentMock } };
});

const NOVEL_ID = "novel-1";

function chapter(n: number): Chapter {
  return { id: `c${n}`, novelId: NOVEL_ID, chapterNo: n, title: `第${n}話`, arcTitle: null, publishedAt: null };
}

function contentOf(n: number) {
  return { chapterId: `c${n}`, title: `第${n}話`, bodyHtml: `<p>body ${n}</p>`, sourceUrl: `https://example.com/${n}` };
}

async function clearCache() {
  indexedDB.deleteDatabase("novelshelf-cache");
}

beforeEach(async () => {
  contentMock.mockReset();
  await clearCache();
});

describe("downloadNovelOffline", () => {
  it("fetches every chapter in chapterNo order and caches it", async () => {
    contentMock.mockImplementation((id: string) => Promise.resolve(contentOf(Number(id.slice(1)))));
    const progress: DownloadProgress[] = [];

    const result = await downloadNovelOffline(NOVEL_ID, [chapter(3), chapter(1), chapter(2)], (p) =>
      progress.push(p)
    );

    expect(contentMock.mock.calls.map((c) => c[0])).toEqual(["c1", "c2", "c3"]);
    expect(result).toEqual({ total: 3, saved: 3, skipped: 0, failed: 0, aborted: false });
    expect((await getCachedChapter("c2"))?.bodyHtml).toBe("<p>body 2</p>");
    expect(progress.at(-1)).toEqual({ done: 3, total: 3, failed: 0, currentTitle: "第3話" });
  });

  it("skips chapters already in the cache (resume)", async () => {
    await putCachedChapter({ chapterId: "c1", novelId: NOVEL_ID, chapterNo: 1, title: "第1話", bodyHtml: "old", sourceUrl: "u" });
    contentMock.mockImplementation((id: string) => Promise.resolve(contentOf(Number(id.slice(1)))));

    const result = await downloadNovelOffline(NOVEL_ID, [chapter(1), chapter(2)], () => {});

    expect(contentMock.mock.calls.map((c) => c[0])).toEqual(["c2"]);
    expect(result).toMatchObject({ saved: 1, skipped: 1, failed: 0 });
    expect((await getCachedChapter("c1"))?.bodyHtml).toBe("old");
  });

  it("retries transient failures with backoff, then records a permanent failure without stopping", async () => {
    contentMock.mockImplementation((id: string) => {
      if (id === "c1") return Promise.reject(new Error("network"));
      return Promise.resolve(contentOf(Number(id.slice(1))));
    });

    const result = await downloadNovelOffline(NOVEL_ID, [chapter(1), chapter(2)], () => {}, {
      backoffMs: [1, 1, 1],
    });

    expect(contentMock.mock.calls.filter((c) => c[0] === "c1")).toHaveLength(3);
    expect(result).toMatchObject({ saved: 1, failed: 1 });
    expect(await getCachedChapter("c2")).toBeDefined();
  });

  it("stops early when aborted and reports aborted", async () => {
    const controller = new AbortController();
    contentMock.mockImplementation((id: string) => {
      controller.abort();
      return Promise.resolve(contentOf(Number(id.slice(1))));
    });

    const result = await downloadNovelOffline(
      NOVEL_ID,
      [chapter(1), chapter(2), chapter(3)],
      () => {},
      { signal: controller.signal }
    );

    expect(result.aborted).toBe(true);
    expect(result.saved).toBe(1);
    expect(contentMock).toHaveBeenCalledTimes(1);
  });

  it("propagates a 401 so the caller can send the user back to login", async () => {
    const { ApiError } = await import("@/lib/api");
    contentMock.mockRejectedValue(new ApiError(401, "expired"));

    await expect(
      downloadNovelOffline(NOVEL_ID, [chapter(1)], () => {})
    ).rejects.toBeInstanceOf(ApiError);
  });
});
