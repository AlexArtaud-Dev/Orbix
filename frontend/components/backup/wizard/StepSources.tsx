"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Plus, X, Folder, File, Globe, Tag, AlertTriangle, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SourcePicker } from "../SourcePicker";
import type { HttpVaultItem } from "@/services/vault";
import type { RequestParam } from "@/services/backups";
import type { InputItem } from "@/services/input";

export type { RequestParam };

export interface SourceFormItem {
  path: string;
  type: "file" | "folder" | "url" | "input";
  exclude: string[];
  vaultId?: string;
  requestParams?: RequestParam[];
  transferMode?: "stream" | "buffer";
  inputId?: string;
}

interface StepSourcesProps {
  data: SourceFormItem[];
  onChange: (data: SourceFormItem[]) => void;
  httpVaultItems?: HttpVaultItem[];
  inputItems?: InputItem[];
}

export function StepSources({
  data,
  onChange,
  httpVaultItems = [],
  inputItems = [],
}: StepSourcesProps) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [inputDialogOpen, setInputDialogOpen] = useState(false);

  const addSource = (paths: string[]) => {
    const path = paths[0];
    if (!path || data.some((s) => s.path === path)) return;
    const hasExt = /\.[^/\\]+$/.test(path);
    onChange([...data, { path, type: hasExt ? "file" : "folder", exclude: [] }]);
  };

  const addUrl = (item: SourceFormItem) => {
    if (!item.path || data.some((s) => s.path === item.path)) return;
    onChange([...data, item]);
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold">{t("backups.wizard.stepSources")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("backups.wizard.stepSourcesDesc")}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <FolderOpen className="size-3.5" />
            {t("backups.sources.addPath")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setUrlDialogOpen(true)}>
            <Globe className="size-3.5" />
            {t("backups.sources.addUrl")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setInputDialogOpen(true)}>
            <Cpu className="size-3.5" />
            {t("backups.sources.addInput")}
          </Button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("backups.sources.noSources")}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="size-3.5" />
              {t("backups.sources.addPath")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setUrlDialogOpen(true)}>
              <Globe className="size-3.5" />
              {t("backups.sources.addUrl")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setInputDialogOpen(true)}>
              <Cpu className="size-3.5" />
              {t("backups.sources.addInput")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((source, idx) =>
            source.type === "url" ? (
              <UrlSourceCard
                key={`url-${source.path}`}
                source={source}
                httpVaultItems={httpVaultItems}
                onRemove={() => removeSource(idx)}
                onUpdate={(patch) => updateSource(idx, patch)}
              />
            ) : source.type === "input" ? (
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

      <SourcePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={[]}
        onSelect={addSource}
        singleSelect
      />

      <UrlSourceDialog
        open={urlDialogOpen}
        httpVaultItems={httpVaultItems}
        onClose={() => setUrlDialogOpen(false)}
        onAdd={addUrl}
      />

      <InputSourceDialog
        open={inputDialogOpen}
        inputItems={inputItems}
        alreadyAdded={data.filter((s) => s.type === "input").map((s) => s.inputId!).filter(Boolean)}
        onClose={() => setInputDialogOpen(false)}
        onAdd={addInput}
      />
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

// ─── URL source card ──────────────────────────────────────────────────────────

interface UrlSourceCardProps {
  source: SourceFormItem;
  httpVaultItems: HttpVaultItem[];
  onRemove: () => void;
  onUpdate: (patch: Partial<SourceFormItem>) => void;
}

function UrlSourceCard({ source, httpVaultItems, onRemove, onUpdate }: UrlSourceCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const vaultName = httpVaultItems.find((v) => v.id === source.vaultId)?.name;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Globe className="size-4 shrink-0 text-primary" />
        <span className="flex-1 truncate font-mono text-xs font-medium">{source.path}</span>
        {vaultName && (
          <span className="text-xs text-muted-foreground rounded-full border px-1.5 py-0.5 shrink-0 max-w-[120px] truncate">
            {vaultName}
          </span>
        )}
        <span className="text-xs text-muted-foreground rounded-full border px-1.5 py-0.5 shrink-0">
          {t("backups.sources.urlBadge")}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
          title="Configure"
        >
          <Tag className="size-3.5" />
        </Button>
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

      {expanded && (
        <div className="border-t px-3 py-3 space-y-3">
          {/* Vault selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t("backups.sources.vaultOptional")}
            </label>
            <Select
              value={source.vaultId ?? "none"}
              onValueChange={(v) => onUpdate({ vaultId: v === "none" ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={t("backups.sources.vaultPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("backups.sources.noVault")}</SelectItem>
                {httpVaultItems.length === 0 ? (
                  <SelectItem value="__empty__" disabled>
                    {t("backups.sources.noVaultItems")}
                  </SelectItem>
                ) : (
                  httpVaultItems.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Transfer mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("backups.sources.transferMode")}
            </label>
            <Select
              value={source.transferMode ?? "stream"}
              onValueChange={(v) =>
                onUpdate({ transferMode: v as "stream" | "buffer" })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stream">{t("backups.sources.transferModeStream")}</SelectItem>
                <SelectItem value="buffer">{t("backups.sources.transferModeBuffer")}</SelectItem>
              </SelectContent>
            </Select>
            {(source.transferMode ?? "stream") === "buffer" && (
              <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <AlertTriangle className="size-3.5 shrink-0 text-amber-500 mt-0.5" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t("backups.sources.transferModeBufferWarning")}
                </p>
              </div>
            )}
          </div>

          {/* Request params */}
          <RequestParamsEditor
            params={source.requestParams ?? []}
            httpVaultItems={httpVaultItems}
            onChange={(params) => onUpdate({ requestParams: params })}
          />
        </div>
      )}
    </div>
  );
}

// ─── RequestParams editor ─────────────────────────────────────────────────────

interface RequestParamsEditorProps {
  params: RequestParam[];
  httpVaultItems: HttpVaultItem[];
  onChange: (params: RequestParam[]) => void;
}

function RequestParamsEditor({ params, httpVaultItems, onChange }: RequestParamsEditorProps) {
  const { t } = useTranslation();
  const [newParam, setNewParam] = useState<RequestParam>({
    in: "header",
    key: "",
    valueType: "literal",
    value: "",
  });

  const addParam = () => {
    if (!newParam.key.trim()) return;
    onChange([...params, { ...newParam, key: newParam.key.trim() }]);
    setNewParam({ in: "header", key: "", valueType: "literal", value: "" });
  };

  const removeParam = (idx: number) => onChange(params.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{t("backups.sources.requestParams")}</p>

      {params.length > 0 && (
        <div className="space-y-1">
          {params.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-md border px-2 py-1">
              <span className="shrink-0 rounded-sm bg-muted px-1 py-0.5 text-[10px] font-mono uppercase">
                {p.in}
              </span>
              <span className="flex-1 min-w-0 font-mono text-xs truncate">
                <span className="text-foreground">{p.key}</span>
                <span className="text-muted-foreground mx-1">=</span>
                <span className="text-muted-foreground">
                  {p.valueType === "literal" ? p.value : `vault:${p.vaultField}`}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeParam(idx)}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* New param row */}
      <div className="grid grid-cols-[80px_1fr_1fr_auto] gap-1.5 items-end">
        <div>
          <Select
            value={newParam.in}
            onValueChange={(v) => setNewParam((p) => ({ ...p, in: v as RequestParam["in"] }))}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="header">{t("backups.sources.paramHeader")}</SelectItem>
              <SelectItem value="query">{t("backups.sources.paramQuery")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          value={newParam.key}
          onChange={(e) => setNewParam((p) => ({ ...p, key: e.target.value }))}
          placeholder={t("backups.sources.paramKey")}
          className="h-7 text-xs font-mono"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParam(); } }}
        />
        <Input
          value={newParam.value ?? ""}
          onChange={(e) => setNewParam((p) => ({ ...p, value: e.target.value }))}
          placeholder={t("backups.sources.paramValue")}
          className="h-7 text-xs"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParam(); } }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0"
          onClick={addParam}
          disabled={!newParam.key.trim()}
        >
          <Plus className="size-3" />
        </Button>
      </div>
      {httpVaultItems.length > 0 && (
        <p className="text-xs text-muted-foreground">{t("backups.sources.paramVault")}: use vault field name in value with vault: prefix</p>
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

// ─── URL source add dialog ────────────────────────────────────────────────────

interface UrlSourceDialogProps {
  open: boolean;
  httpVaultItems: HttpVaultItem[];
  onClose: () => void;
  onAdd: (item: SourceFormItem) => void;
}

function UrlSourceDialog({ open, httpVaultItems, onClose, onAdd }: UrlSourceDialogProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [vaultId, setVaultId] = useState<string>("");

  const handleAdd = () => {
    if (!url.trim()) return;
    onAdd({
      type: "url",
      path: url.trim(),
      exclude: [],
      vaultId: vaultId || undefined,
      requestParams: [],
    });
    setUrl("");
    setVaultId("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg space-y-4">
        <h3 className="font-semibold text-base">{t("backups.sources.urlTitle")}</h3>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("backups.sources.urlLabel")}</label>
            <Input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("backups.sources.urlPlaceholder")}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
            <p className="text-xs text-muted-foreground">{t("backups.sources.urlHint")}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("backups.sources.vaultOptional")}</label>
            <Select value={vaultId || "none"} onValueChange={(v) => setVaultId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("backups.sources.vaultPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("backups.sources.noVault")}</SelectItem>
                {httpVaultItems.length === 0 ? (
                  <SelectItem value="__empty__" disabled>
                    {t("backups.sources.noVaultItems")}
                  </SelectItem>
                ) : (
                  httpVaultItems.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleAdd} disabled={!url.trim()}>
            <Plus className="size-3.5" />
            {t("backups.sources.addUrl")}
          </Button>
        </div>
      </div>
    </div>
  );
}
