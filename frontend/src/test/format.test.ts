import { describe, expect, it } from "vitest";
import { compactMoney, date, dateTime, money, percent, titleize } from "../utils/format";

describe("format helpers", () => {
  it("formats money with the Indian grouping convention", () => {
    expect(money("128837.5", "INR")).toContain("1,28,837.50");
  });

  it("returns an em dash for missing money", () => {
    expect(money(null)).toBe("—");
    expect(money(undefined)).toBe("—");
  });

  it("compacts lakh and crore amounts", () => {
    expect(compactMoney(153000)).toBe("INR 1.53 L");
    expect(compactMoney(25300000)).toBe("INR 2.53 Cr");
  });

  it("parses ISO dates for display", () => {
    expect(date("2026-02-14")).toMatch(/2026/);
    expect(date(null)).toBe("—");
  });

  it("treats naive timestamps as UTC", () => {
    const formatted = dateTime("2026-02-14T10:30:00");
    expect(formatted).toMatch(/2026/);
    expect(dateTime(null)).toBe("—");
  });

  it("formats percentages and labels", () => {
    expect(percent(0.7345, 1)).toBe("73.5%");
    expect(titleize("field_accuracy_macro")).toBe("Field Accuracy Macro");
  });
});
