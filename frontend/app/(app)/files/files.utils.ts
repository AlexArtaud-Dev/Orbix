import type { FileEntry } from "@/services/files";

export function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export type SortCol = "name" | "size" | "modified" | null;
export type SortDir = "asc" | "desc";
export type FilterState = { type: "name" | "kind"; value: string } | null;

export function applyFilter(entries: FileEntry[], filter: FilterState): FileEntry[] {
  if (!filter) return entries;
  if (filter.type === "name")
    return entries.filter((e) => e.name.toLowerCase().includes(filter.value.toLowerCase()));
  if (filter.type === "kind")
    return entries.filter((e) => (filter.value === "folder" ? e.isDir : !e.isDir));
  return entries;
}

export function applySort(entries: FileEntry[], sortCol: SortCol, sortDir: SortDir): FileEntry[] {
  return [...entries].sort((a, b) => {
    // Folders always before files
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    if (sortCol === null) return a.name.localeCompare(b.name);
    let cmp = 0;
    if (sortCol === "name") cmp = a.name.localeCompare(b.name);
    else if (sortCol === "size") cmp = (a.size ?? -1) - (b.size ?? -1);
    else if (sortCol === "modified") cmp = a.modifiedAt.localeCompare(b.modifiedAt);
    return sortDir === "asc" ? cmp : -cmp;
  });
}
