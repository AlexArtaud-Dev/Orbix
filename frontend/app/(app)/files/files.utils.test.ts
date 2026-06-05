import { describe, it, expect } from "vitest";
import { formatSize, applyFilter, applySort } from "./files.utils";
import type { FileEntry } from "@/services/files";

function makeEntry(name: string, isDir: boolean, size: number | null = null, modifiedAt = "2026-01-01T00:00:00Z"): FileEntry {
  return { name, path: name, isDir, size, modifiedAt };
}

describe("formatSize", () => {
  it("returns — for null", () => {
    expect(formatSize(null)).toBe("—");
  });

  it("formats bytes", () => {
    expect(formatSize(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatSize(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatSize(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });

  it("formats 0 bytes", () => {
    expect(formatSize(0)).toBe("0 B");
  });
});

describe("applyFilter", () => {
  const entries: FileEntry[] = [
    makeEntry("documents", true),
    makeEntry("photos", true),
    makeEntry("readme.md", false, 100),
    makeEntry("data.csv", false, 200),
  ];

  it("returns all entries when filter is null", () => {
    expect(applyFilter(entries, null)).toHaveLength(4);
  });

  it("filters by name case-insensitively", () => {
    const result = applyFilter(entries, { type: "name", value: "DOC" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("documents");
  });

  it("filters by name partial match", () => {
    const result = applyFilter(entries, { type: "name", value: ".md" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("readme.md");
  });

  it("filters kind=folder returns only directories", () => {
    const result = applyFilter(entries, { type: "kind", value: "folder" });
    expect(result.every((e) => e.isDir)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("filters kind=file returns only files", () => {
    const result = applyFilter(entries, { type: "kind", value: "file" });
    expect(result.every((e) => !e.isDir)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no name matches", () => {
    const result = applyFilter(entries, { type: "name", value: "xyz" });
    expect(result).toHaveLength(0);
  });
});

describe("applySort", () => {
  const entries: FileEntry[] = [
    makeEntry("beta", true, null, "2026-02-01T00:00:00Z"),
    makeEntry("alpha", true, null, "2026-01-01T00:00:00Z"),
    makeEntry("zoo.txt", false, 300, "2026-03-01T00:00:00Z"),
    makeEntry("ant.txt", false, 100, "2026-01-15T00:00:00Z"),
    makeEntry("mid.txt", false, 200, "2026-02-15T00:00:00Z"),
  ];

  it("default sort: dirs first then name asc", () => {
    const result = applySort(entries, null, "asc");
    expect(result[0].name).toBe("alpha");
    expect(result[1].name).toBe("beta");
    expect(result[2].name).toBe("ant.txt");
    expect(result[3].name).toBe("mid.txt");
    expect(result[4].name).toBe("zoo.txt");
  });

  it("folders always before files regardless of sort column", () => {
    const result = applySort(entries, "name", "asc");
    const firstFileIdx = result.findIndex((e) => !e.isDir);
    const lastDirIdx = result.map((e) => e.isDir).lastIndexOf(true);
    expect(lastDirIdx).toBeLessThan(firstFileIdx);
  });

  it("sort by name asc", () => {
    const result = applySort(entries, "name", "asc");
    const dirs = result.filter((e) => e.isDir).map((e) => e.name);
    const files = result.filter((e) => !e.isDir).map((e) => e.name);
    expect(dirs).toEqual(["alpha", "beta"]);
    expect(files).toEqual(["ant.txt", "mid.txt", "zoo.txt"]);
  });

  it("sort by name desc", () => {
    const result = applySort(entries, "name", "desc");
    const files = result.filter((e) => !e.isDir).map((e) => e.name);
    expect(files).toEqual(["zoo.txt", "mid.txt", "ant.txt"]);
  });

  it("sort by size asc (dirs have size -1, always first)", () => {
    const result = applySort(entries, "size", "asc");
    const files = result.filter((e) => !e.isDir).map((e) => e.size);
    expect(files).toEqual([100, 200, 300]);
  });

  it("sort by size desc", () => {
    const result = applySort(entries, "size", "desc");
    const files = result.filter((e) => !e.isDir).map((e) => e.size);
    expect(files).toEqual([300, 200, 100]);
  });

  it("sort by modified asc", () => {
    const result = applySort(entries, "modified", "asc");
    const files = result.filter((e) => !e.isDir).map((e) => e.name);
    expect(files).toEqual(["ant.txt", "mid.txt", "zoo.txt"]);
  });

  it("sort by modified desc", () => {
    const result = applySort(entries, "modified", "desc");
    const files = result.filter((e) => !e.isDir).map((e) => e.name);
    expect(files).toEqual(["zoo.txt", "mid.txt", "ant.txt"]);
  });

  it("does not mutate original array", () => {
    const original = [...entries];
    applySort(entries, "name", "desc");
    expect(entries).toEqual(original);
  });
});
