import { describe, expect, it } from "vitest";
import { isServerSleepWindow } from "./serverSchedule";

describe("isServerSleepWindow", () => {
  // 2026-10-19 は月曜日、2026-10-17 は土曜日(端末のローカル時刻で判定する)
  it("is true on weekdays between 1:00 and 7:00", () => {
    expect(isServerSleepWindow(new Date(2026, 9, 19, 1, 0))).toBe(true);
    expect(isServerSleepWindow(new Date(2026, 9, 19, 6, 59))).toBe(true);
  });

  it("is false on weekdays outside the window", () => {
    expect(isServerSleepWindow(new Date(2026, 9, 19, 0, 59))).toBe(false);
    expect(isServerSleepWindow(new Date(2026, 9, 19, 7, 0))).toBe(false);
  });

  it("is false on weekends", () => {
    expect(isServerSleepWindow(new Date(2026, 9, 17, 3, 0))).toBe(false);
    expect(isServerSleepWindow(new Date(2026, 9, 18, 3, 0))).toBe(false);
  });
});
