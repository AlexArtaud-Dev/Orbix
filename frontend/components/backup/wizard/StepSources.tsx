"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Plus, X, Folder, File, Tag, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SourcePicker } from "../SourcePicker";
import type { InputItem } from "@/services/input";

export interface SourceFormItem {
  path: string;
  type: "file" | "folder" | "input";
  exclude: string[];
  inputId?: string;
}

interface StepSourcesProps {
  mode: "local" | "input";
  data: SourceFormItem[];
  onChange: (data: SourceFormItem[]) => void;
  inputItems?: InputItem[];
}

export function StepSources({
  mode,
  data,
  onChange,
  inputItems = [],
}: StepSourcesProps) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inputDialogOpen, setInputDialogOpen] = useState(false);

  const addSource = (paths: string[]) => {
    const path = paths[0];
    if (!path || data.some((s) => s.path === path)) return;
    const hasExt = /\.[^/\\]+$/.test(path);
    onChange([...data, { path, type: hasExt ? "file" : "folder", exclude: [] }]);
  };

  const addInput = (input: InputItem) => {
    if (data.some((s) => s.inputId === input.id)) return;
    onChange([...data, { path: input.name, type: "input", exclude: [], inputId: input.id }]);
  };

  const removeSource = (idx: number) => onChange(data.filter((_, i) => i !== idx));

  const updateSource = (idx: number, patch: Partial<SourceFormItem>) =>
    onChange(data.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const addExclude = (idx: number, pattern: string) => {
    if (!pattern.trim() || data[idx].exclude.includes(pattern.trim())) return;
    updateSource(idx, { exclude: [...data[idx].exclude, pattern.trim()] });
  };

  const removeExclude = (sourceIdx: number, pattern: string) =>
    updateSource(sourceIdx, {
      exclude: data[sourceIdx].exclude.filter((e) => e !== pattern),
    });

  const addButton = mode === "local" ? (
    <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
      <FolderOpen className="size-3.5" />
      {t("backups.sources.addPath")}
    </Button>
  ) : (
    <Button type="button" variant="outline" size="sm" onClick={() => setInputDialogOpen(true)}>
      <Cpu className="size-3.5" />
      {t("backups.sources.addInput")}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold">{t("backups.wizard.stepSources")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "local"
              ? t("backups.wizard.stepSourcesDescLocal")
              : t("backups.wizard.stepSourcesDescInput")}
          </p>
        </div>
        <div className="flex gap-2">{addButton}</div>
      </div>

      {data.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {mode === "local"
              ? t("backups.sources.noSourcesLocal")
              : t("backups.sources.noSourcesInput")}
          </p>
          <div className="mt-4 flex justify-center gap-2">{addButton}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((source, idx) =>
            source.type === "input" ? (
              <InputSourceCard
                key={`input-${source.inputId ?? idx}`}
                source={source}
                onRemove={() => removeSource(idx)}
              />
            ) : (
              <SourceCard
                key={source.path}
                source={source}
                onRemove={() => removeSource(idx)}
                onAddExclude={(p) => addExclude(idx, p)}
                onRemoveExclude={(p) => removeExclude(idx, p)}
              />
            )
          )}
        </div>
      )}

      {mode === "local" && (
        <SourcePicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          selected={[]}
          onSelect={addSource}
          singleSelect
        />
      )}

      {mode === "input" && (
        <InputSourceDialog
          open={inputDialogOpen}
          inputItems={inputItems}
          alreadyAdded={data.filter((s) => s.type === "input").map((s) => s.inputId!).filter(Boolean)}
          onClose={() => setInputDialogOpen(false)}
          onAdd={addInput}
        />
      )}
    </div>
  );
}

// ─── File/folder source card ──────────────────────────────────────────────────

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

// ─── Input source card ────────────────────────────────────────────────────────

interface InputSourceCardProps {
  source: SourceFormItem;
  onRemove: () => void;
}

function InputSourceCard({ source, onRemove }: InputSourceCardProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Cpu className="size-4 shrink-0 text-primary" />
        <span className="flex-1 truncate text-sm font-medium">{source.path}</span>
        <span className="text-xs text-muted-foreground rounded-full border px-1.5 py-0.5 shrink-0">
          {t("backups.sources.inputBadge")}
        </span>
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
    </div>
  );
}

// ─── Input source add dialog ──────────────────────────────────────────────────

interface InputSourceDialogProps {
  open: boolean;
  inputItems: InputItem[];
  alreadyAdded: string[];
  onClose: () => void;
  onAdd: (input: InputItem) => void;
}

function InputSourceDialog({
  open,
  inputItems,
  alreadyAdded,
  onClose,
  onAdd,
}: InputSourceDialogProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg space-y-4">
        <div>
          <h3 className="font-semibold text-base">{t("backups.sources.inputTitle")}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t("backups.sources.inputSubtitle")}</p>
        </div>

        {inputItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("backups.sources.noInputItems")}</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {inputItems.map((input) => {
              const already = alreadyAdded.includes(input.id);
              return (
                <button
                  key={input.id}
                  type="button"
                  disabled={already}
                  onClick={() => { onAdd(input); onClose(); }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    already
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:border-primary/50 hover:bg-muted/30 cursor-pointer",
                  )}
                >
                  <Cpu className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{input.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {(input.config as { baseUrl?: string }).baseUrl ?? "—"}
                    </p>
                  </div>
                  {already && (
                    <span className="text-xs text-muted-foreground shrink-0">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
