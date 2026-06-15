"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Folder, File, X, Filter, FileSearch, MousePointerClick, Loader2,
} from "lucide-react";
import { vaultService, type SshMatchEntry } from "@/services/vault";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import type { SshSource } from "./SshFileBrowser";

interface Props {
  vaultId: string;
  sources: SshSource[];
  onChange: (sources: SshSource[]) => void;
}

interface FilterTestState {
  srcPath: string;
  pattern: string;
  recursive: boolean;
  loading: boolean;
  files?: SshMatchEntry[];
  error?: string;
}

const DATE_VARS = ["{YYYY}", "{MM}", "{DD}", "{HH}"];

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SshSourcesList({ vaultId, sources, onChange }: Props) {
  const { t } = useTranslation();
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());
  const [filterTest, setFilterTest] = useState<FilterTestState | null>(null);

  const removeSource = (idx: number) => {
    const removed = sources[idx];
    setExpandedFilters((prev) => { const next = new Set(prev); next.delete(removed.path); return next; });
    onChange(sources.filter((_, i) => i !== idx));
  };

  const updateSource = (idx: number, patch: Partial<SshSource>) => {
    onChange(sources.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const toggleFilter = (srcPath: string) => {
    setExpandedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(srcPath)) next.delete(srcPath);
      else next.add(srcPath);
      return next;
    });
  };

  const clearFilter = (idx: number) => {
    const srcPath = sources[idx].path;
    updateSource(idx, { namePattern: undefined });
    setExpandedFilters((prev) => { const next = new Set(prev); next.delete(srcPath); return next; });
  };

  const insertVar = (idx: number, v: string) => {
    updateSource(idx, { namePattern: (sources[idx].namePattern ?? "") + v });
  };

  const testFilter = async (src: SshSource) => {
    if (!src.namePattern) return;
    setFilterTest({ srcPath: src.path, pattern: src.namePattern, recursive: src.recursive, loading: true });
    try {
      const files = await vaultService.matchSsh(vaultId, src.path, src.namePattern, src.recursive);
      setFilterTest((prev) => prev ? { ...prev, loading: false, files } : null);
    } catch (e) {
      setFilterTest((prev) => prev ? { ...prev, loading: false, error: (e as Error).message } : null);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <Label className="shrink-0 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t("input.ssh.selectedSources")} ({sources.length})
        </Label>

        {sources.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed gap-3 text-center px-6 py-10">
            <MousePointerClick className="size-8 text-muted-foreground/25" />
            <p className="text-sm text-muted-foreground">{t("input.ssh.noSourcesHint")}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-0.5">
            {sources.map((src, idx) => {
              const filterVisible = expandedFilters.has(src.path) || !!src.namePattern;
              const switchId = `src-rec-${idx}`;
              return (
                <div key={src.path} className="rounded-lg border overflow-hidden bg-card">
                  {/* Path row */}
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                      {src.isDirectory
                        ? <Folder className="size-3.5 text-yellow-600" />
                        : <File className="size-3.5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium" title={src.path}>
                        {src.path.split("/").pop()}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground" title={src.path}>
                        {src.path.split("/").slice(0, -1).join("/") || "/"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeSource(idx)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>

                  {/* Options strip */}
                  <div className="border-t bg-muted/40 px-3 py-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      {src.isDirectory && (
                        <>
                          <Switch
                            id={switchId}
                            checked={src.recursive}
                            onCheckedChange={(v) => updateSource(idx, { recursive: v })}
                            className="scale-[0.8] origin-left"
                          />
                          <Label htmlFor={switchId} className="text-xs text-muted-foreground font-normal cursor-pointer select-none">
                            {t("input.ssh.recursive")}
                          </Label>
                          <div className="w-px h-3 bg-border ml-auto" />
                        </>
                      )}
                      {!filterVisible && (
                        <button
                          type="button"
                          onClick={() => toggleFilter(src.path)}
                          className={`flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ${src.isDirectory ? "" : "ml-auto"}`}
                        >
                          <Filter className="size-3" />
                          {t("input.ssh.addFilter")}
                        </button>
                      )}
                    </div>

                    {filterVisible && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Filter className="size-3 shrink-0 text-muted-foreground" />
                          <Input
                            value={src.namePattern ?? ""}
                            onChange={(e) => updateSource(idx, { namePattern: e.target.value || undefined })}
                            placeholder="*.conf | *.json"
                            className="h-6 flex-1 min-w-0 font-mono text-xs bg-background"
                          />
                          {src.namePattern && vaultId && (
                            <button
                              type="button"
                              onClick={() => void testFilter(src)}
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                              title={t("input.ssh.testFilter")}
                            >
                              <FileSearch className="size-3.5" />
                            </button>
                          )}
                          <button type="button" onClick={() => clearFilter(idx)} className="shrink-0 text-muted-foreground hover:text-destructive">
                            <X className="size-3" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1 pl-4">
                          {DATE_VARS.map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => insertVar(idx, v)}
                              className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        <p className="pl-4 text-[10px] text-muted-foreground/60">
                          {t("input.ssh.multiPatternHint")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter test dialog */}
      <Dialog open={!!filterTest} onOpenChange={(open) => { if (!open) setFilterTest(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="size-4" />
              {t("input.ssh.testFilterTitle")}
            </DialogTitle>
            {filterTest && (() => {
              const parts = filterTest.srcPath.split("/").filter(Boolean);
              const shortPath = parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : `/${parts.join("/")}`;
              return (
                <DialogDescription className="flex flex-wrap items-center gap-1 text-xs">
                  <code className="rounded bg-muted px-1 py-0.5 font-mono">{filterTest.pattern}</code>
                  <span className="text-muted-foreground">in</span>
                  <code className="rounded bg-muted px-1 py-0.5 font-mono" title={filterTest.srcPath}>{shortPath}</code>
                  {filterTest.recursive && <span className="text-muted-foreground italic">· recursive</span>}
                </DialogDescription>
              );
            })()}
          </DialogHeader>
          <div className="mt-1">
            {filterTest?.loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />{t("common.loading")}
              </div>
            )}
            {filterTest?.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{filterTest.error}</p>
            )}
            {filterTest?.files && !filterTest.loading && (
              filterTest.files.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{t("input.ssh.testFilterEmpty")}</p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {t("input.ssh.testFilterCount", { count: filterTest.files.length })}
                  </p>
                  <div className="max-h-[380px] overflow-y-auto rounded-md border divide-y">
                    {filterTest.files.map((f) => (
                      <div key={f.path} className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/40">
                        <File className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 min-w-0 truncate text-sm" title={f.path}>{f.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatSize(f.size)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
