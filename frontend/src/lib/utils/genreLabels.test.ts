import { describe, expect, it } from "vitest";
import { genreLabel, genreOptionsForSite } from "./genreLabels";

describe("genreLabel", () => {
  it("maps known Narou genre codes to Japanese labels", () => {
    expect(genreLabel("NAROU", "201")).toBe("ハイファンタジー〔ファンタジー〕");
    expect(genreLabel("NAROU", "9999")).toBe("その他");
  });

  it("maps single-digit Narou codes to R18 nocgenre labels", () => {
    expect(genreLabel("NAROU", "1")).toBe("ノクターン(男性向け)");
    expect(genreLabel("NAROU", "4")).toBe("ミッドナイト");
  });

  it("falls back to the raw code for an unknown Narou genre", () => {
    expect(genreLabel("NAROU", "12345")).toBe("12345");
  });

  it("maps known Kakuyomu genre codes to Japanese labels", () => {
    expect(genreLabel("KAKUYOMU", "FANTASY")).toBe("異世界ファンタジー");
    expect(genreLabel("KAKUYOMU", "LOVE_STORY")).toBe("恋愛");
  });

  it("falls back to the raw code for an unknown Kakuyomu genre", () => {
    expect(genreLabel("KAKUYOMU", "ESSAY")).toBe("ESSAY");
  });

  it("returns the raw code for sites without a known mapping", () => {
    expect(genreLabel("HAMELN", "whatever")).toBe("whatever");
  });

  it("returns an empty string for missing codes", () => {
    expect(genreLabel("NAROU", null)).toBe("");
    expect(genreLabel("NAROU", undefined)).toBe("");
  });
});

describe("genreOptionsForSite", () => {
  it("returns options for Narou and Kakuyomu", () => {
    expect(genreOptionsForSite("NAROU").length).toBeGreaterThan(0);
    expect(genreOptionsForSite("KAKUYOMU").length).toBeGreaterThan(0);
  });

  it("returns an empty list for sites without a genre vocabulary", () => {
    expect(genreOptionsForSite("HAMELN")).toEqual([]);
    expect(genreOptionsForSite(null)).toEqual([]);
  });
});
