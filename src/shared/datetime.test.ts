import { describe, expect, it } from "vitest";
import { formatDateTime } from "./datetime";

describe("formatDateTime", () => {
  it("formats to YYYY-MM-DD HH:mm in local time", () => {
    const out = formatDateTime("2026-06-30T08:05:00");
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(out).toBe("2026-06-30 08:05");
  });
});
