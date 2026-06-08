"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Plus, X, Folder, File, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SourcePicker } from "../SourcePicker";

export interface SourceFormItem {
  path: string;
  type: "file" | "folder";
  exclude: string[];
}

interface StepSourcesProps {
  data: SourceFormItem[];
  onChange: (data: SourceFormItem[]) => void;
}

export function StepSources({ data, onChange }: StepSourcesProps) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);

  const addSource = (paths: string[]) => {
    const path = paths[0];
    if (!path || data.some((s) => s.path === path)) return;
    const hasExt = /\.[^/\\]+$/.test(path);
    onChange([...data, { path, type: hasExt ? "file" : "folder", exclude: [] }]);
  };

  const removeSource = (idx: number) => onChange(data.filter((_, i) => i !== idx));

  const addExclude = (idx: number, pattern: string) => {
    if (!pattern.trim() || data[idx].exclude.includes(pattern.trim())) return;
    onChange(data.map((s, i) => i === idx ? { ...s, exclude: [...s.exclude, pattern.trim()] } : s));
  };

  const removeExclude = (sourceIdx: number, pattern: string) => {
    onChange(data.map((s, i) => i === sourceIdx ? { ...s, exclude: s.exclude.filter((e) => e !== pattern) } : s));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold">{t("backups.wizard.stepSources")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("backups.wizard.stepSourcesDesc")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <FolderOpen className="size-3.5" />
          {t("backups.sources.addPath")}
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("backups.sources.noSources")}</p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setPickerOpen(true)}>
            <Plus className="size-3.5" />
            {t("backups.sources.addPath")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((source, idx) => (
            <SourceCard
              key={source.path}
              source={source}
              onRemove={() => removeSource(idx)}
              onAddExclude={(p) => addExclude(idx, p)}
              onRemoveExclude={(p) => removeExclude(idx, p)}
            />
          ))}
        </div>
      )}

      <SourcePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={[]}
        onSelect={addSource}
        singleSelect
      />
    </div>
  );
}

interface SourceCardProps {
  source: SourceFormItem;
  onRemove: () => void;
  onAddExclude: (pattern: string) => void;
  onRemoveExclude: (pattern: string) => void;
}

function SourceCard({ source, onRemove, onAddExclude, onRemoveExclude }: SourceCardProps) {
  const { t } = useTranslation();
  const [addingPattern, setAddingPattern] = useState(false);
  const [patternInput, setPatternInput] = useState("");

  const commitPattern = () => {
    if (patternInput.trim()) {
      onAddExclude(patternInput.trim());
      setPatternInput("");
    }
    setAddingPattern(false);
  };

  return (
    <div className="rounded-lg border bg-card">
      {/* Path row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {source.type === "folder" ? (
          <Folder className="size-4 shrink-0 text-primary" />
        ) : (
          <File className="size-4 shrink-0 text-muted-foreground" />
        )}

        <span className={cn("flex-1 truncate font-mono text-xs", source.type === "folder" && "font-medium")}>
          {source.path}
        </span>

        <span className="text-xs text-muted-foreground rounded-full border px-1.5 py-0.5 shrink-0">
          {source.type === "folder" ? t("backups.sources.folderBadge") : t("backups.sources.fileBadge")}
        </span>

        {/* Add exclusion button — only for folders */}
        {source.type === "folder" && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setAddingPattern(true)}
            aria-label={t("backups.sources.addExclusion")}
            title={t("backups.sources.addExclusion")}
          >
            <Tag className="size-3.5" />
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Exclusion chips + inline add */}
      {source.type === "folder" && (source.exclude.length > 0 || addingPattern) && (
        <div className="border-t px-3 py-2 space-y-2">
          {source.exclude.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {source.exclude.map((pattern) => (
                <span
                  key={pattern}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-mono"
                >
                  {pattern}
                  <button
                    type="button"
                    onClick={() => onRemoveExclude(pattern)}
                    className="ml-0.5 hover:text-destructive transition-colors"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {addingPattern && (
            <div className="flex gap-2">
              <Input
                autoFocus
                value={patternInput}
                onChange={(e) => setPatternInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitPattern(); }
                  if (e.key === "Escape") { setPatternInput(""); setAddingPattern(false); }
                }}
                placeholder={t("backups.sources.patternPlaceholder")}
                className="h-7 text-xs font-mono flex-1"
              />
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={commitPattern}
                disabled={!patternInput.trim()}
              >
                {t("backups.sources.addPattern")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => { setPatternInput(""); setAddingPattern(false); }}
              >
                <X className="size-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
