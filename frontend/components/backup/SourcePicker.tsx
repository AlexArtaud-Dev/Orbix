"use client";
import { useState, useCallback } from "react";
import { FolderOpen, File, Folder, ChevronRight, Home, Check, X, Plus } from "lucide-react";
import { filesService, type FileEntry } from "@/services/files";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SourcePickerProps {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onSelect: (paths: string[]) => void;
}

export function SourcePicker({ open, onClose, selected, onSelect }: SourcePickerProps) {
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [localSelected, setLocalSelected] = useState<string[]>(selected);

  const load = useCallback(async (path: string) => {
    setLoading(true);
    setCurrentPath(path);
    try {
      const data = await filesService.list(path);
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = () => {
    setLocalSelected(selected);
    void load("");
  };

  const navigate = (path: string) => void load(path);

  const toggle = (path: string) => {
    setLocalSelected((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const confirm = () => {
    onSelect(localSelected);
    onClose();
  };

  const breadcrumbs = currentPath ? currentPath.split("/").filter(Boolean) : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
    >
      <DialogContent
        className="sm:max-w-2xl"
        aria-describedby={undefined}
        onOpenAutoFocus={() => handleOpen()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="size-4" />
            Select sources
          </DialogTitle>
        </DialogHeader>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap min-h-5">
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => navigate("")}
          >
            <Home className="size-3" />
            Root
          </button>
          {breadcrumbs.map((seg, i) => {
            const path = breadcrumbs.slice(0, i + 1).join("/");
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={path} className="flex items-center gap-1">
                <ChevronRight className="size-3" />
                {isLast ? (
                  <span className="text-foreground font-medium">{seg}</span>
                ) : (
                  <button className="hover:text-foreground transition-colors" onClick={() => navigate(path)}>
                    {seg}
                  </button>
                )}
              </span>
            );
          })}
        </div>

        {/* File list */}
        <div className="max-h-72 overflow-y-auto rounded-md border">
          {loading ? (
            <p className="p-4 text-xs text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">Empty folder</p>
          ) : (
            <ul>
              {entries.map((entry) => {
                const isSelected = localSelected.includes(entry.path);
                return (
                  <li
                    key={entry.path}
                    className="flex items-center gap-2 px-3 py-2 border-b last:border-0 text-sm hover:bg-muted/30 transition-colors"
                  >
                    <button
                      type="button"
                      className={`mr-1 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input"
                      }`}
                      onClick={() => toggle(entry.path)}
                      aria-label={isSelected ? "Deselect" : "Select"}
                    >
                      {isSelected && <Check className="size-2.5" />}
                    </button>

                    <button
                      type="button"
                      className="flex flex-1 items-center gap-2 min-w-0 text-left"
                      onClick={() => entry.isDir ? navigate(entry.path) : toggle(entry.path)}
                    >
                      {entry.isDir ? (
                        <Folder className="size-4 shrink-0 text-primary" />
                      ) : (
                        <File className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className={entry.isDir ? "font-medium" : "text-foreground/80"}>
                        {entry.name}
                      </span>
                      {entry.isDir && (
                        <ChevronRight className="size-3 ml-auto text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Selected summary */}
        {localSelected.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {localSelected.length} path(s) selected
            </p>
            <div className="flex flex-wrap gap-1">
              {localSelected.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  <span className="font-mono truncate max-w-48">{p}</span>
                  <button
                    type="button"
                    onClick={() => setLocalSelected((prev) => prev.filter((x) => x !== p))}
                    className="ml-0.5 cursor-pointer rounded-full hover:bg-primary/20"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm}>
            <Plus className="size-4" />
            Add {localSelected.length > 0 ? `(${localSelected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
