import { beforeEach, describe, expect, it } from "vitest";
import { applyTheme } from "./applyTheme";

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.clear();
  });

  it("sets data-theme=dark and persists it when darkMode is true", () => {
    applyTheme(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("novelshelf.darkMode")).toBe("1");
  });

  it("sets data-theme=light and persists it when darkMode is false", () => {
    applyTheme(false);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("novelshelf.darkMode")).toBe("0");
  });
});
