import { describe, expect, it } from "vitest";
import { coverGradient } from "./colorHash";

describe("coverGradient", () => {
  it("returns the same gradient for the same seed", () => {
    expect(coverGradient("novel-123")).toEqual(coverGradient("novel-123"));
  });

  it("returns a [from, to] hex color pair", () => {
    const [from, to] = coverGradient("novel-abc");
    expect(from).toMatch(/^#[0-9a-f]{6}$/i);
    expect(to).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("distributes different seeds across the palette", () => {
    const seeds = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const results = new Set(seeds.map((s) => coverGradient(s)[0]));
    expect(results.size).toBeGreaterThan(1);
  });
});
