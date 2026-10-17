import { describe, expect, it } from "vitest";
import { sharePathFromAppUrl } from "./shareUrl";

describe("sharePathFromAppUrl", () => {
  it("converts a shared text (Android ACTION_SEND)", () => {
    const appUrl = `novelshelf://share?text=${encodeURIComponent("作品名 https://ncode.syosetu.com/n1234ab/")}`;
    const path = sharePathFromAppUrl(appUrl);

    expect(path).not.toBeNull();
    expect(new URLSearchParams(path!.split("?")[1]).get("text")).toBe("作品名 https://ncode.syosetu.com/n1234ab/");
  });

  it("converts a shared url (iOS Share Extension)", () => {
    const appUrl = `novelshelf://share?url=${encodeURIComponent("https://kakuyomu.jp/works/1177354054880000000")}`;

    expect(sharePathFromAppUrl(appUrl)).toBe(
      `/share?url=${encodeURIComponent("https://kakuyomu.jp/works/1177354054880000000")}`
    );
  });

  it("ignores other urls", () => {
    expect(sharePathFromAppUrl("novelshelf://other?url=x")).toBeNull();
    expect(sharePathFromAppUrl("https://example.com/share?url=x")).toBeNull();
    expect(sharePathFromAppUrl("novelshelf://share")).toBeNull();
    expect(sharePathFromAppUrl("not a url")).toBeNull();
  });
});
