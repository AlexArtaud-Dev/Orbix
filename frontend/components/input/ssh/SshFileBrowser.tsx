"use client";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  File, ChevronRight, Home, Loader2, Plus, X, FolderOpen,
} from "lucide-react";
import { vaultService, type SshBrowseEntry } from "@/services/vault";
import { Button } from "@/components/ui/button";

export interface SshSource {
  path: string;
  isDirectory: boolean;
  recursive: boolean;
  namePattern?: string;
}

interface Props {
  vaultId: string;
  sources: SshSource[];
  onChange: (sources: SshSource[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SshFileBrowser({ vaultId, sources, onChange }: Props) {
  const { t } = useTranslation();
  const [path, setPath] = useState("/");
  const [entries, setEntries] = useState<SshBrowseEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [browsed, setBrowsed] = useState(false);

  const browse = useCallback(async (targetPath: string) => {
    if (!vaultId) { toast.error(t("input.ssh.noVault")); return; }
    setLoading(true);
    try {
      const result = await vaultService.browseSsh(vaultId, targetPath);
      setEntries(result.entries);
      setPath(result.path);
      setBrowsed(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [vaultId, t]);

  const navigateTo = (newPath: string) => void browse(newPath);
  const pathParts = path === "/" ? [] : path.split("/").filter(Boolean);

  const entryFullPath = (entry: SshBrowseEntry) =>
    `${path === "/" ? "" : path}/${entry.name}`;

  const isSelected = (entry: SshBrowseEntry) =>
    sources.some((s) => s.path === entryFullPath(entry));

  const addSource = (entry: SshBrowseEntry) => {
    const fullPath = entryFullPath(entry);
    if (sources.some((s) => s.path === fullPath)) return;
    onChange([...sources, { path: fullPath, isDirectory: entry.type === "directory", recursive: false }]);
  };

  const removeSource = (entryPath: string) =>
    onChange(sources.filter((s) => s.path !== entryPath));

  return (
    <div className="flex flex-col h-full min-h-[280px] rounded-lg border overflow-hidden">
      {/* Breadcrumb */}
      <div className="shrink-0 flex items-center gap-1 border-b px-3 py-2">
        <button
          type="button"
          onClick={() => navigateTo("/")}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Home className="size-3.5" />
        </button>
        {pathParts.length > 2 && (
          <span className="flex items-center gap-1 shrink-0">
            <ChevronRight className="size-3 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">…</span>
          </span>
        )}
        {(pathParts.length <= 2 ? pathParts : pathParts.slice(-2)).map((part, i) => {
          const actualIdx = pathParts.length <= 2 ? i : pathParts.length - 2 + i;
          const partial = "/" + pathParts.slice(0, actualIdx + 1).join("/");
          return (
            <span key={partial} className="flex items-center gap-1 min-w-0">
              <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
              <button
                type="button"
                onClick={() => navigateTo(partial)}
                title={partial}
                className="text-sm hover:underline truncate max-w-[120px]"
              >
                {part}
              </button>
            </span>
          );
        })}
        <div className="ml-auto shrink-0">
          {!browsed ? (
            <Button type="button" size="sm" onClick={() => void browse(path)} disabled={loading}>
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              {t("input.ssh.browse")}
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => void browse(path)} disabled={loading}>
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              {t("common.refresh")}
            </Button>
          )}
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!browsed && !loading && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("input.ssh.browseHint")}</p>
        )}
        {loading && (
          <p className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />{t("common.loading")}
          </p>
        )}
        {!loading && entries?.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">{t("input.ssh.emptyDir")}</p>
        )}
        {!loading && entries?.map((entry) => {
          const selected = isSelected(entry);
          const fullPath = entryFullPath(entry);
          return (
            <div
              key={entry.name}
              className={`flex items-center gap-2.5 border-b px-3 py-1.5 text-sm last:border-0 ${selected ? "bg-primary/5" : "hover:bg-muted/50"}`}
            >
              {entry.type === "directory" ? (
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => navigateTo(fullPath)}
                >
                  <FolderOpen className="size-4 shrink-0 text-yellow-500" />
                  <span className="truncate font-medium">{entry.name}</span>
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <File className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{entry.name}</span>
                </div>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">
                {entry.type === "file" ? formatSize(entry.size) : ""}
              </span>
              <Button
                type="button"
                variant={selected ? "default" : "outline"}
                size="icon-sm"
                onClick={() => (selected ? removeSource(fullPath) : addSource(entry))}
              >
                {selected ? <X className="size-3" /> : <Plus className="size-3" />}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
