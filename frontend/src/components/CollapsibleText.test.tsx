import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollapsibleText, shouldCollapse } from "./CollapsibleText";

describe("CollapsibleText", () => {
  it("does not collapse short text", () => {
    render(<CollapsibleText text="短い説明文" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("短い説明文").className).not.toContain("line-clamp-4");
  });

  it("collapses long text and expands/collapses on click", () => {
    const long = "あ".repeat(300);
    render(<CollapsibleText text={long} />);
    const p = screen.getByText(long);
    expect(p.className).toContain("line-clamp-4");

    fireEvent.click(screen.getByRole("button", { name: "続きを表示" }));
    expect(p.className).not.toContain("line-clamp-4");

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(p.className).toContain("line-clamp-4");
  });

  it("collapses text with many lines even if short", () => {
    expect(shouldCollapse("1\n2\n3\n4\n5")).toBe(true);
    expect(shouldCollapse("1\n2\n3\n4")).toBe(false);
  });
});
