import { describe, expect, it } from "vitest";
import { assertTimeZone, detectSystemTimeZone, formatLocal } from "../src/engine/time.js";

describe("formatLocal", () => {
  it("converts UTC to Brisbane time", () => {
    expect(formatLocal("2026-09-17T09:00:00.000Z", "Australia/Brisbane")).toBe("2026-09-17 19:00 (GMT+10)");
  });

  it("rolls over to the next day", () => {
    expect(formatLocal("2026-09-17T15:00:00.000Z", "Australia/Brisbane")).toBe("2026-09-18 01:00 (GMT+10)");
  });

  it("follows daylight saving time", () => {
    expect(formatLocal("2026-09-17T09:00:00.000Z", "Europe/Berlin")).toBe("2026-09-17 11:00 (GMT+2)");
    expect(formatLocal("2026-01-15T09:00:00.000Z", "Europe/Berlin")).toBe("2026-01-15 10:00 (GMT+1)");
  });
});

describe("detectSystemTimeZone", () => {
  it("returns a configured zone", () => {
    expect(detectSystemTimeZone("Australia/Brisbane")).toBe("Australia/Brisbane");
  });

  it("ignores UTC, which usually means the zone was never set", () => {
    expect(detectSystemTimeZone("UTC")).toBeUndefined();
    expect(detectSystemTimeZone("Etc/UTC")).toBeUndefined();
  });
});

describe("assertTimeZone", () => {
  it("accepts IANA names", () => {
    expect(() => assertTimeZone("Asia/Taipei")).not.toThrow();
  });

  it("rejects unknown names", () => {
    expect(() => assertTimeZone("Brisbane")).toThrow(/Unknown time zone/);
  });
});
