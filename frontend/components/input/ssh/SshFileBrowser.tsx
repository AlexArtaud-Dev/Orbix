"use client";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SshBrowserBase } from "@/components/ssh/SshBrowserBase";
import type { SshBrowseEntry } from "@/services/vault";

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

export function SshFileBrowser({ vaultId, sources, onChange }: Props) {
  const addSource = (entry: SshBrowseEntry, fullPath: string) => {
    if (sources.some((s) => s.path === fullPath)) return;
    onChange([
      ...sources,
      { path: fullPath, isDirectory: entry.type === "directory", recursive: false },
    ]);
  };

  const removeSource = (path: string) =>
    onChange(sources.filter((s) => s.path !== path));

  return (
    <SshBrowserBase
      vaultId={vaultId}
      isSelected={(_entry, fullPath) => sources.some((s) => s.path === fullPath)}
      renderAction={(entry, fullPath) => {
        const selected = sources.some((s) => s.path === fullPath);
        return (
          <Button
            type="button"
            variant={selected ? "default" : "outline"}
            size="icon-sm"
            onClick={() =>
              selected ? removeSource(fullPath) : addSource(entry, fullPath)
            }
          >
            {selected ? <X className="size-3" /> : <Plus className="size-3" />}
          </Button>
        );
      }}
    />
  );
}
