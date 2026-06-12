import { describe, it, expect } from "vitest";
import {
  formatSize,
  formatDuration,
  formatDay,
  formatMonth,
  groupByMonth,
} from "./dashboard.utils";

describe("formatSize", () => {
  it("returns — for null", () => {
    expect(formatSize(null)).toBe("—");
  });

  it("formats bytes (< 1024)", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(formatSize(1024)).toBe("1.0 KB");
    expect(formatSize(2048)).toBe("2.0 KB");
    expect(formatSize(153600)).toBe("150.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatSize(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });
});

describe("formatDuration", () => {
  it("returns — for null", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("formats milliseconds (< 1000ms)", () => {
    expect(formatDuration(0)).toBe("0ms");
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("formats seconds (< 60s)", () => {
    expect(formatDuration(1000)).toBe("1.0s");
    expect(formatDuration(7500)).toBe("7.5s");
    expect(formatDuration(59999)).toBe("60.0s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(60000)).toBe("1m 0s");
    expect(formatDuration(90000)).toBe("1m 30s");
    expect(formatDuration(3661000)).toBe("61m 1s");
  });
});

describe("formatDay", () => {
  it("formats a UTC date string without timezone shift", () => {
    const result = formatDay("2026-06-12");
    expect(result).toMatch(/12/);
    expect(result).toMatch(/juin/i);
  });

  it("formats the first day of the month", () => {
    const result = formatDay("2026-01-01");
    expect(result).toMatch(/01/);
    expect(result).toMatch(/janv/i);
  });

  it("is timezone-safe: '2026-06-12' maps to June 12 regardless of local timezone", () => {
    // If this used local time instead of UTC, UTC+X timezones could shift the date
    const result = formatDay("2026-06-12");
    expect(result).not.toMatch(/11/); // must not show June 11
    expect(result).toMatch(/12/);
  });
});

describe("formatMonth", () => {
  it("formats YYYY-MM string as short month + 2-digit year", () => {
    const result = formatMonth("2026-06");
    expect(result).toMatch(/juin/i);
    expect(result).toMatch(/26/);
  });

  it("formats January correctly", () => {
    const result = formatMonth("2025-01");
    expect(result).toMatch(/janv/i);
    expect(result).toMatch(/25/);
  });

  it("is UTC-safe: '2026-06' always resolves to June", () => {
    const result = formatMonth("2026-06");
    expect(result).not.toMatch(/mai/i);
  });
});

describe("groupByMonth", () => {
  it("returns empty array for empty input", () => {
    expect(groupByMonth([])).toEqual([]);
  });

  it("groups daily entries by YYYY-MM month key", () => {
    const input = [
      { date: "2026-05-30", success: 1, error: 0 },
      { date: "2026-05-31", success: 2, error: 1 },
      { date: "2026-06-01", success: 0, error: 1 },
    ];
    const result = groupByMonth(input);
    expect(result).toHaveLength(2);

    const may = result.find((r) => r.date === "2026-05");
    expect(may).toBeDefined();
    expect(may?.success).toBe(3);
    expect(may?.error).toBe(1);

    const june = result.find((r) => r.date === "2026-06");
    expect(june).toBeDefined();
    expect(june?.success).toBe(0);
    expect(june?.error).toBe(1);
  });

  it("preserves insertion order (chronological months)", () => {
    const input = [
      { date: "2026-03-15", success: 1, error: 0 },
      { date: "2026-04-10", success: 2, error: 0 },
      { date: "2026-05-01", success: 3, error: 0 },
    ];
    const result = groupByMonth(input);
    expect(result.map((r) => r.date)).toEqual(["2026-03", "2026-04", "2026-05"]);
  });

  it("sums success and error counts within the same month", () => {
    const input = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-06-0${i + 1}`,
      success: 2,
      error: 1,
    }));
    const [result] = groupByMonth(input);
    expect(result.success).toBe(10);
    expect(result.error).toBe(5);
  });
});
