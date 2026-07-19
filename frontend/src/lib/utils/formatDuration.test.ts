import { describe, expect, it } from "vitest";
import { formatDuration } from "./formatDuration";

describe("formatDuration", () => {
  it("returns 0分 for zero seconds", () => {
    expect(formatDuration(0)).toBe("0分");
  });

  it("formats minutes only when under an hour", () => {
    expect(formatDuration(125 * 60)).toBe("2時間5分");
  });

  it("formats minutes only under an hour", () => {
    expect(formatDuration(45 * 60)).toBe("45分");
  });

  it("formats whole hours with 0 minutes", () => {
    expect(formatDuration(2 * 3600)).toBe("2時間0分");
  });
});
