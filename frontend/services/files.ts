import { api } from "@/lib/api";

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number | null;
  modifiedAt: string;
}

export interface FileStat {
  name: string;
  path: string;
  fullPath: string;
  isDir: boolean;
  size: number;
  itemCount: number | null;
  createdAt: string;
  modifiedAt: string;
  mode: string;
  uid: number;
  gid: number;
  extension: string | null;
}

export const filesService = {
  list: (relPath = "") =>
    api.get<FileEntry[]>(`/api/files?path=${encodeURIComponent(relPath)}`),

  stat: (relPath: string) =>
    api.get<FileStat>(`/api/files/stat?path=${encodeURIComponent(relPath)}`),
};
