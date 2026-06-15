"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, ChevronDown, PackageOpen, KeySquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { VarSetItem } from "@/services/vault";

export interface StepZipData {
  /** If true, bypass archiving entirely and send the single file as-is */
  noArchive: boolean;
  archiveFormat: "zip" | "tar" | "tar-gz" | "tar-bz2";
  zipCompression: "store" | "fast" | "default" | "best";
  /** null = existing password not changed (edit mode); "" = no password; string = new password */
  zipPassword: string | null;
  /** "slug.key" vault variable set reference — when set, overrides zipPassword at runtime */
  zipPasswordVaultRef: string;
  zipFilename: string;
}

const ARCHIVE_FORMATS: {
  value: StepZipData["archiveFormat"];
  ext: string;
  labelKey: string;
  descKey: string;
  supportsPassword: boolean;
  supportsCompression: boolean;
}[] = [
  { value: "zip",     ext: ".zip",     labelKey: "backups.zip.fmtZip",    descKey: "backups.zip.fmtZipDesc",    supportsPassword: true,  supportsCompression: true },
  { value: "tar",     ext: ".tar",     labelKey: "backups.zip.fmtTar",    descKey: "backups.zip.fmtTarDesc",    supportsPassword: false, supportsCompression: false },
  { value: "tar-gz",  ext: ".tar.gz",  labelKey: "backups.zip.fmtTarGz",  descKey: "backups.zip.fmtTarGzDesc",  supportsPassword: false, supportsCompression: true },
  { value: "tar-bz2", ext: ".tar.bz2", labelKey: "backups.zip.fmtTarBz2", descKey: "backups.zip.fmtTarBz2Desc", supportsPassword: false, supportsCompression: true },
];

const COMPRESSION_LEVELS: {
  value: StepZipData["zipCompression"];
  labelKey: string;
  exampleFrom: string;
  exampleTo: string;
  ratio: string;
}[] = [
  { value: "store",   labelKey: "backups.zip.compStore",   exampleFrom: "10 MB", exampleTo: "10 MB",   ratio: "0%"  },
  { value: "fast",    labelKey: "backups.zip.compFast",    exampleFrom: "10 MB", exampleTo: "~2.8 MB", ratio: "72%" },
  { value: "default", labelKey: "backups.zip.compDefault", exampleFrom: "10 MB", exampleTo: "~2.2 MB", ratio: "78%" },
  { value: "best",    labelKey: "backups.zip.compBest",    exampleFrom: "10 MB", exampleTo: "~2.0 MB", ratio: "80%" },
];

const FILENAME_VARS = [
  { key: "{{backup.name}}", example: "my-backup" },
  { key: "{{date}}",        example: "2026-06-05" },
  { key: "{{datetime}}",    example: "2026-06-05_14-30" },
  { key: "{{year}}",        example: "2026" },
  { key: "{{month}}",       example: "06" },
  { key: "{{day}}",         example: "05" },
];

interface StepZipProps {
  data: StepZipData;
  backupName: string;
  /** Hint: if the mode is "input" we show the noArchive option more prominently */
  backupMode?: "local" | "input";
  /**
   * Whether "send without archiving" is currently allowed given the selected sources.
   * Defaults to true so the component works without the prop (e.g. in Storybook / tests).
   */
  canNoArchive?: boolean;
  /** Human-readable reason why noArchive is blocked. Shown below the toggle when canNoArchive=false. */
  noArchiveReason?: string;
  /** Extension detected from the source input's last test (e.g. ".tar.gz"). Used in noArchive preview. */
  detectedExtension?: string;
  /** Variable sets available for vault password reference */
  varSets?: VarSetItem[];
  onChange: (data: StepZipData) => void;
}

export function StepZip({ data, backupName, backupMode, canNoArchive = true, noArchiveReason, detectedExtension, varSets = [], onChange }: StepZipProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [isVaultMode, setIsVaultMode] = useState(() => Boolean(data.zipPasswordVaultRef));
  const [vaultPickerOpen, setVaultPickerOpen] = useState(false);
  const [vaultSearch, setVaultSearch] = useState("");

  const set = (partial: Partial<StepZipData>) => onChange({ ...data, ...partial });

  const currentFormat = ARCHIVE_FORMATS.find((f) => f.value === data.archiveFormat) ?? ARCHIVE_FORMATS[0];

  // Shared variable resolver for filename preview
  const resolveFilenameVars = (template: string): string => {
    const now = new Date();
    const vars: Record<string, string> = {
      // Slug-ify backup name (mirrors backend: spaces → underscores, lowercase)
      "backup.name": (backupName || "backup").replace(/[^a-z0-9]/gi, "_").toLowerCase(),
      date: now.toISOString().slice(0, 10),
      datetime: now.toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "-"),
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1).padStart(2, "0"),
      day: String(now.getDate()).padStart(2, "0"),
    };
    return template.replace(/\{\{([^}]+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
  };

  // Preview the resolved filename with archive extension (normal mode)
  const previewFilename = (() => {
    const base = (data.zipFilename || `{{backup.name}}_{{date}}`).replace(
      /\.(zip|tar\.gz|tar\.bz2|tar)$/i, "",
    );
    return resolveFilenameVars(base) + currentFormat.ext;
  })();

  // Preview for noArchive mode (extension comes from detected response extension)
  const noArchivePreview = (() => {
    const ext = detectedExtension ?? "";
    if (!data.zipFilename) return `(auto)${ext}`;
    const base = resolveFilenameVars(data.zipFilename).replace(
      /\.(zip|tar\.gz|tar\.bz2|tar)$/i, "",
    );
    return base + ext;
  })();

  const insertVar = (key: string) => {
    const el = document.getElementById("zip-filename-input") as HTMLInputElement | null;
    const pos = el?.selectionStart ?? data.zipFilename.length;
    const end = el?.selectionEnd ?? pos;
    const next = data.zipFilename.slice(0, pos) + key + data.zipFilename.slice(end);
    set({ zipFilename: next });
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(pos + key.length, pos + key.length);
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">{t("backups.wizard.stepZip")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("backups.wizard.stepZipDesc")}</p>
      </div>

      {/* No-archive toggle */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border p-3 transition-colors",
          !canNoArchive
            ? "border-border opacity-60"
            : data.noArchive
              ? "border-primary bg-primary/5"
              : "border-border",
        )}
      >
        <PackageOpen
          className={cn(
            "size-5 mt-0.5 shrink-0",
            !canNoArchive || !data.noArchive ? "text-muted-foreground" : "text-primary",
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{t("backups.zip.noArchive")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("backups.zip.noArchiveDesc")}</p>
          {!canNoArchive && noArchiveReason && (
            <p className="text-xs text-muted-foreground mt-1">{noArchiveReason}</p>
          )}
          {canNoArchive && backupMode === "local" && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t("backups.zip.noArchiveLocalWarning")}</p>
          )}
        </div>
        <Switch
          checked={data.noArchive}
          onCheckedChange={(v) => set({ noArchive: v })}
          disabled={!canNoArchive}
          className="shrink-0"
        />
      </div>

      {/* noArchive: output filename field — shown OUTSIDE the grayed section */}
      {data.noArchive && (
        <FieldGroup>
          <Field>
            <FieldLabel>{t("backups.zip.noArchiveFilename")}</FieldLabel>
            <div className="flex gap-1.5">
              <Input
                id="zip-filename-input"
                value={data.zipFilename}
                onChange={(e) => set({ zipFilename: e.target.value })}
                placeholder={t("backups.zip.filenamePlaceholder")}
                className="font-mono flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="shrink-0">
                    {"{}"}
                    <ChevronDown className="size-3 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-2" align="end">
                  <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
                    {t("backups.zip.insertVariable")}
                  </p>
                  <div className="space-y-0.5">
                    {FILENAME_VARS.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVar(v.key)}
                        className="w-full flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted text-left"
                      >
                        <span className="font-mono text-primary">{v.key}</span>
                        <span className="text-muted-foreground">{v.example}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Preview */}
            <p className="text-xs text-muted-foreground mt-1">
              {t("backups.zip.filenamePreview")}{" "}
              <span className="font-mono">{noArchivePreview}</span>
            </p>

            {/* Hint — detected extension or generic hint */}
            <p className="text-xs text-muted-foreground">
              {detectedExtension
                ? t("backups.zip.noArchiveDetectedExt", { ext: detectedExtension })
                : t("backups.zip.noArchiveFilenameHint")}
            </p>
          </Field>
        </FieldGroup>
      )}

      {/* Format selector — disabled when noArchive */}
      <FieldGroup className={cn(data.noArchive && "opacity-40 pointer-events-none")}>
        <Field>
          <FieldLabel>{t("backups.zip.format")}</FieldLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ARCHIVE_FORMATS.map((fmt) => (
              <button
                key={fmt.value}
                type="button"
                onClick={() => {
                  const next: Partial<StepZipData> = { archiveFormat: fmt.value };
                  if (!fmt.supportsCompression) next.zipCompression = "default";
                  if (!fmt.supportsPassword) next.zipPassword = "";
                  set(next);
                }}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  data.archiveFormat === fmt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground",
                )}
              >
                <p className="font-mono text-sm font-semibold">{fmt.ext}</p>
                <p className="text-xs mt-0.5 opacity-70">{t(fmt.labelKey)}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t(currentFormat.descKey)}</p>
        </Field>

        {/* Compression level — only if format supports it */}
        {currentFormat.supportsCompression && (
          <Field>
            <FieldLabel>{t("backups.zip.compression")}</FieldLabel>
            <div className="flex gap-2">
              {COMPRESSION_LEVELS.map((lvl) => (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => set({ zipCompression: lvl.value })}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-2 text-left transition-colors",
                    data.zipCompression === lvl.value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
                  )}
                >
                  <p className="text-xs font-medium">{t(lvl.labelKey)}</p>
                  <p className={cn(
                    "text-[10px] mt-0.5 font-mono",
                    data.zipCompression === lvl.value ? "text-primary/70" : "opacity-50",
                  )}>
                    {lvl.exampleTo}
                  </p>
                </button>
              ))}
            </div>
            {/* Dynamic example for selected level */}
            {(() => {
              const sel = COMPRESSION_LEVELS.find((l) => l.value === data.zipCompression);
              return sel ? (
                <p className="text-xs text-muted-foreground">
                  {t("backups.zip.compExample")}{" "}
                  <span className="font-mono">{sel.exampleFrom}</span>
                  {" → "}
                  <span className="font-mono font-medium">{sel.exampleTo}</span>
                  {sel.ratio !== "0%" && (
                    <span className="ml-1 text-green-600 dark:text-green-400">
                      (−{sel.ratio} {t("backups.zip.compExampleSuffix")})
                    </span>
                  )}
                </p>
              ) : null;
            })()}
            <p className="text-xs text-muted-foreground/60">{t("backups.zip.compExampleNote")}</p>
          </Field>
        )}

        {/* Password — only for ZIP */}
        {currentFormat.supportsPassword && (
          <Field>
            <div className="flex items-center justify-between mb-1">
              <FieldLabel className="mb-0">{t("backups.zip.password")}</FieldLabel>
              {/* Toggle: literal vs vault variable */}
              <button
                type="button"
                onClick={() => {
                  if (isVaultMode) {
                    // Switch back to literal
                    set({ zipPasswordVaultRef: "" });
                    setIsVaultMode(false);
                  } else {
                    // Switch to vault mode
                    set({ zipPassword: "" });
                    setIsVaultMode(true);
                    setVaultPickerOpen(true);
                  }
                }}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  isVaultMode
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <KeySquare className="size-3 shrink-0" />
                {isVaultMode
                  ? t("backups.zip.passwordVaultActive")
                  : t("backups.zip.passwordUseVault")}
              </button>
            </div>

            {isVaultMode ? (
              /* Vault variable mode */
              <Popover
                open={vaultPickerOpen}
                onOpenChange={(o) => { setVaultPickerOpen(o); if (!o) setVaultSearch(""); }}
              >
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between font-mono text-xs">
                    <span className="truncate text-primary">
                      {data.zipPasswordVaultRef || t("backups.zip.passwordSelectVaultVar")}
                    </span>
                    <ChevronDown className="size-3 ml-1 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2" align="start">
                  <Input
                    value={vaultSearch}
                    onChange={(e) => setVaultSearch(e.target.value)}
                    placeholder={t("backups.zip.passwordSearchVault")}
                    className="text-xs h-7 mb-2"
                    autoFocus
                  />
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {varSets.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                        {t("backups.zip.passwordNoVarSets")}
                      </p>
                    ) : (
                      varSets
                        .map((vs) => {
                          const lower = vaultSearch.toLowerCase();
                          const setMatch = !vaultSearch || vs.name.toLowerCase().includes(lower);
                          const keys = setMatch
                            ? vs.variableKeys
                            : vs.variableKeys.filter((k) => k.toLowerCase().includes(lower));
                          return { vs, keys };
                        })
                        .filter(({ keys }) => keys.length > 0)
                        .map(({ vs, keys }) => (
                          <div key={vs.id}>
                            <p className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {vs.name}
                            </p>
                            {keys.map((key) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  set({ zipPasswordVaultRef: `${vs.slug}.${key}` });
                                  setVaultPickerOpen(false);
                                  setVaultSearch("");
                                }}
                                className={cn(
                                  "w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left transition-colors hover:bg-muted",
                                  data.zipPasswordVaultRef === `${vs.slug}.${key}` && "bg-primary/10 text-primary",
                                )}
                              >
                                <span className="font-mono flex-1 truncate">{`${vs.slug}.${key}`}</span>
                              </button>
                            ))}
                          </div>
                        ))
                    )}
                  </div>
                  {data.zipPasswordVaultRef && (
                    <button
                      type="button"
                      onClick={() => { set({ zipPasswordVaultRef: "" }); setIsVaultMode(false); setVaultPickerOpen(false); }}
                      className="mt-1 w-full rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 text-left"
                    >
                      {t("backups.zip.passwordClearVaultRef")}
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            ) : (
              /* Literal mode */
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={data.zipPassword ?? ""}
                  onChange={(e) => set({ zipPassword: e.target.value })}
                  placeholder={data.zipPassword === null ? t("backups.zip.passwordSet") : t("backups.zip.passwordHint")}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            )}

            {!isVaultMode && data.zipPassword === null && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t("backups.zip.passwordCurrentlySet")}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{t("backups.zip.passwordDesc")}</p>
          </Field>
        )}

        {/* Archive base filename — hidden in noArchive mode (shown above instead) */}
        {!data.noArchive && (
          <Field>
            <FieldLabel>{t("backups.zip.filename")}</FieldLabel>
            <div className="flex gap-1.5">
              <Input
                id="zip-filename-input"
                value={data.zipFilename}
                onChange={(e) => set({ zipFilename: e.target.value })}
                placeholder={t("backups.zip.filenamePlaceholder")}
                className="font-mono flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="shrink-0">
                    {"{}"}
                    <ChevronDown className="size-3 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-2" align="end">
                  <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
                    {t("backups.zip.insertVariable")}
                  </p>
                  <div className="space-y-0.5">
                    {FILENAME_VARS.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVar(v.key)}
                        className="w-full flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted text-left"
                      >
                        <span className="font-mono text-primary">{v.key}</span>
                        <span className="text-muted-foreground">{v.example}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Preview with correct extension */}
            <p className="text-xs text-muted-foreground mt-1">
              {t("backups.zip.filenamePreview")}{" "}
              <span className="font-mono">{previewFilename}</span>
            </p>
            <p className="text-xs text-muted-foreground">{t("backups.zip.filenameHint")}</p>
          </Field>
        )}
      </FieldGroup>
    </div>
  );
}
