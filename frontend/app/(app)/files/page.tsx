"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Folder, File, ChevronRight, Home, Copy, Info, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, X, Search } from "lucide-react";
import { filesService, type FileEntry, type FileStat } from "@/services/files";
import { formatSize, applyFilter, applySort, type SortCol, type SortDir, type FilterState } from "./files.utils";
import { ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 border-b last:border-0 text-sm">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="break-all">{children}</span>
    </div>
  );
}

export default function FilesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = searchParams.get("path") ?? "";

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stat, setStat] = useState<FileStat | null>(null);
  const [statLoading, setStatLoading] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState<FilterState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await filesService.list(currentPath);
      setEntries(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [currentPath, t]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await filesService.list(currentPath);
      setEntries(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setRefreshing(false);
    }
  }, [currentPath, t]);

  useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const navigate = (path: string) => {
    setSortCol(null);
    setSortDir("asc");
    router.push(`/files${path ? `?path=${encodeURIComponent(path)}` : ""}`);
  };

  const breadcrumbs = currentPath ? currentPath.split("/").filter(Boolean) : [];

  const openProperties = async (entry: FileEntry) => {
    setStatLoading(true);
    setStat(null);
    try {
      const data = await filesService.stat(entry.path);
      setStat(data);
    } catch {
      toast.error(t("common.error"));
      setStatLoading(false);
    } finally {
      setStatLoading(false);
    }
  };

  const handleSort = (col: "name" | "size" | "modified") => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const resetSort = () => {
    setSortCol(null);
    setSortDir("asc");
  };

  const filteredEntries = applyFilter(entries, filter);
  const sortedEntries = applySort(filteredEntries, sortCol, sortDir);

  const SortIcon = ({ col }: { col: "name" | "size" | "modified" }) => {
    if (sortCol !== col) return <ChevronsUpDown className="size-3 opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp className="size-3" />
      : <ChevronDown className="size-3" />;
  };

  const copyPath = (path: string) => {
    void navigator.clipboard.writeText(path).then(() => toast.success(t("files.copied")));
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("files.title")}</h1>
        <p className="text-muted-foreground">{t("files.subtitle")}</p>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => navigate("")}
          >
            <Home className="size-3.5" />
            {t("files.root")}
          </button>
          {breadcrumbs.map((segment, i) => {
            const path = breadcrumbs.slice(0, i + 1).join("/");
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={path} className="flex items-center gap-1">
                <ChevronRight className="size-3.5" />
                {isLast ? (
                  <span className="text-foreground font-medium">{segment}</span>
                ) : (
                  <button className="hover:text-foreground transition-colors" onClick={() => navigate(path)}>
                    {segment}
                  </button>
                )}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          {sortCol !== null && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={resetSort}
            >
              <X className="size-3" />
              Reset sort
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder={t("files.filterByName")}
            value={filter?.type === "name" ? filter.value : ""}
            onChange={(e) => {
              const v = e.target.value;
              setFilter(v ? { type: "name", value: v } : null);
            }}
          />
        </div>
        <Button
          variant={filter?.type === "kind" && filter.value === "folder" ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setFilter((f) =>
            f?.type === "kind" && f.value === "folder" ? null : { type: "kind", value: "folder" }
          )}
        >
          <Folder className="size-3.5" />
          {t("files.typeFolder")}
        </Button>
        <Button
          variant={filter?.type === "kind" && filter.value === "file" ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setFilter((f) =>
            f?.type === "kind" && f.value === "file" ? null : { type: "kind", value: "file" }
          )}
        >
          <File className="size-3.5" />
          {t("files.typeFile")}
        </Button>
      </div>

      {/* File list */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : entries.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("files.empty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-muted-foreground text-xs uppercase tracking-wide select-none">
                  <th className="py-2 pl-4 pr-2 text-left font-medium">
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort("name")}>
                      {t("files.colName")}<SortIcon col="name" />
                    </button>
                  </th>
                  <th className="py-2 px-2 text-right font-medium w-28">
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto" onClick={() => handleSort("size")}>
                      {t("files.colSize")}<SortIcon col="size" />
                    </button>
                  </th>
                  <th className="py-2 pl-8 pr-4 text-left font-medium w-52">
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort("modified")}>
                      {t("files.colModified")}<SortIcon col="modified" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => (
                  <ContextMenu key={entry.path}>
                    <ContextMenuTrigger asChild>
                      <tr className={`border-b last:border-0 transition-colors cursor-context-menu ${entry.isDir ? "bg-primary/[0.03] hover:bg-primary/[0.07]" : "hover:bg-muted/30"}`}>
                        <td className="py-2 pl-4 pr-2">
                          <button
                            className="flex items-center gap-2 hover:text-primary transition-colors disabled:cursor-default disabled:hover:text-inherit"
                            disabled={!entry.isDir}
                            onClick={() => entry.isDir && navigate(entry.path)}
                          >
                            {entry.isDir ? (
                              <Folder className="size-4 text-primary shrink-0" />
                            ) : (
                              <File className="size-4 text-muted-foreground shrink-0" />
                            )}
                            <span className={entry.isDir ? "font-medium text-foreground" : "text-foreground/70"}>{entry.name}</span>
                          </button>
                        </td>
                        <td className="py-2 px-2 text-right text-muted-foreground tabular-nums">
                          {formatSize(entry.size)}
                        </td>
                        <td className="py-2 pl-8 pr-4 text-muted-foreground">
                          {formatDate(entry.modifiedAt)}
                        </td>
                      </tr>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-44">
                      <ContextMenuGroup>
                        <ContextMenuItem onClick={() => void openProperties(entry)}>
                          <Info className="size-4" />
                          {t("files.properties")}
                        </ContextMenuItem>
                      </ContextMenuGroup>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Properties dialog */}
      <Dialog open={!!stat || statLoading} onOpenChange={(open) => { if (!open) setStat(null); }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {stat
                ? <>{stat.isDir ? <Folder className="size-4 text-primary" /> : <File className="size-4 text-muted-foreground" />}{stat.name}</>
                : t("files.propTitle")}
            </DialogTitle>
          </DialogHeader>

          {statLoading && <p className="text-sm text-muted-foreground py-4">{t("common.loading")}</p>}

          {stat && (
            <div className="mt-1">
              <PropRow label={t("files.propType")}>
                {stat.isDir ? t("files.typeFolder") : t("files.typeFile")}
                {stat.extension && <span className="text-muted-foreground ml-1 text-xs">({stat.extension})</span>}
              </PropRow>

              <PropRow label={t("files.propSize")}>
                {formatSize(stat.size)}
                {stat.size > 0 && (
                  <span className="text-muted-foreground text-xs ml-1">({stat.size.toLocaleString()} bytes)</span>
                )}
              </PropRow>

              {stat.itemCount !== null && (
                <PropRow label={t("files.propItems")}>{stat.itemCount.toLocaleString()}</PropRow>
              )}


              <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 border-b text-sm">
                <span className="text-muted-foreground font-medium">{t("files.propFullPath")}</span>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-mono text-xs truncate flex-1" title={stat.fullPath}>{stat.fullPath}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 shrink-0"
                    onClick={() => copyPath(stat.fullPath)}
                    aria-label={t("files.copyPath")}
                  >
                    <Copy className="size-3" />
                  </Button>
                </div>
              </div>


              <PropRow label={t("files.propCreated")}>{formatDate(stat.createdAt)}</PropRow>
              <PropRow label={t("files.propModified")}>{formatDate(stat.modifiedAt)}</PropRow>


              <PropRow label={t("files.propMode")}>{stat.mode}</PropRow>
              <PropRow label={t("files.propOwner")}>{stat.uid} / {stat.gid}</PropRow>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
