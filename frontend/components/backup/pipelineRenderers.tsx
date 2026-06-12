"use client";

/**
 * Pipeline renderer registry.
 *
 * Each module that introduces a new source type or output type registers its
 * renderer here. The pipeline component looks up the registry at render time
 * and falls back to a generic renderer for unknown types.
 *
 * To add a new output type (e.g. "sftp"):
 *   import { registerOutputRenderer } from "./pipelineRenderers";
 *   registerOutputRenderer("sftp", { icon: Server, ... DetailContent: SftpDetail });
 */

import { useState } from "react";
import {
  Globe, Plug, Mail, Send,
  FileText, Folder, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BackupSource, BackupOutput } from "@/services/backups";
import type { Contact } from "@/services/contacts";
import type { InputItem } from "@/services/input";

// ─── Context ──────────────────────────────────────────────────────────────────

export interface PipelineVaultInfo {
  name:     string;
  user:     string;
  host:     string;
  fromAddr: string;
}

export interface PipelineContext {
  contacts:      Map<string, Contact>;
  inputMap:      Map<string, InputItem>;
  vaultsMap:     Map<string, PipelineVaultInfo>;
  templatesMap:  Map<string, string>; // id → name
}

export const EMPTY_CONTEXT: PipelineContext = {
  contacts:     new Map(),
  inputMap:     new Map(),
  vaultsMap:    new Map(),
  templatesMap: new Map(),
};

// ─── Renderer interfaces ──────────────────────────────────────────────────────

export interface PipelineSourceRenderer {
  icon:      React.ElementType;
  bg:        string;
  iconColor: string;
  glow:      string;
  ring:      string;
  label:    (source: BackupSource, ctx: PipelineContext) => string;
  sublabel: (source: BackupSource, ctx: PipelineContext) => string;
  DetailContent: React.ComponentType<{ source: BackupSource; ctx: PipelineContext }>;
}

export interface PipelineOutputRenderer {
  icon:      React.ElementType;
  bg:        string;
  iconColor: string;
  glow:      string;
  ring:      string;
  label:    (output: BackupOutput) => string;
  DetailContent: React.ComponentType<{ output: BackupOutput; index: number; ctx: PipelineContext }>;
}

// ─── Registries ───────────────────────────────────────────────────────────────

export const SOURCE_RENDERERS: Record<string, PipelineSourceRenderer> = {};
export const OUTPUT_RENDERERS: Record<string, PipelineOutputRenderer> = {};

export function registerSourceRenderer(type: string, r: PipelineSourceRenderer) {
  SOURCE_RENDERERS[type] = r;
}
export function registerOutputRenderer(type: string, r: PipelineOutputRenderer) {
  OUTPUT_RENDERERS[type] = r;
}

export function getSourceRenderer(type: string): PipelineSourceRenderer {
  return SOURCE_RENDERERS[type] ?? genericSourceRenderer(type);
}
export function getOutputRenderer(type: string): PipelineOutputRenderer {
  return OUTPUT_RENDERERS[type] ?? genericOutputRenderer(type);
}

// ─── Shared detail primitives ─────────────────────────────────────────────────

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-8 gap-y-3">{children}</dl>;
}

export function Field({
  label, value, full,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", full && "col-span-2")}>
      <dt className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/65">
        {label}
      </dt>
      <dd className="text-xs text-foreground/90 leading-snug">{value}</dd>
    </div>
  );
}

export function Chip({
  children,
  color = "muted",
  className,
}: {
  children: React.ReactNode;
  color?: "muted" | "amber" | "sky" | "green" | "teal" | "red";
  className?: string;
}) {
  const colors: Record<string, string> = {
    muted:  "bg-muted text-muted-foreground",
    amber:  "bg-amber-500/18 text-amber-600 dark:text-amber-400",
    sky:    "bg-sky-500/18 text-sky-600 dark:text-sky-400",
    green:  "bg-green-500/18 text-green-600 dark:text-green-400",
    teal:   "bg-teal-500/18 text-teal-600 dark:text-teal-400",
    red:    "bg-red-500/18 text-red-600 dark:text-red-400",
  };
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none",
      colors[color], className,
    )}>
      {children}
    </span>
  );
}

// ─── URL source renderer ──────────────────────────────────────────────────────

function UrlSourceDetail({ source }: { source: BackupSource; ctx: PipelineContext }) {
  let hostname = source.path;
  try { hostname = new URL(source.path).hostname; } catch { /* ignore */ }

  const params = (source.requestParams ?? []) as Array<{
    in: string; key: string; valueType: string;
  }>;

  return (
    <FieldGrid>
      <Field label="Host" value={<span className="font-mono">{hostname}</span>} />
      <Field label="Transfer" value={
        <Chip color={source.transferMode === "buffer" ? "amber" : "sky"}>
          {source.transferMode ?? "stream"}
        </Chip>
      } />
      {params.length > 0 && (
        <Field label={`${params.length} param${params.length > 1 ? "s" : ""}`} value={
          <div className="space-y-1 mt-0.5">
            {params.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono text-foreground/70">
                <Chip color="muted" className="text-[9px]">{p.in}</Chip>
                <span>{p.key}</span>
                {p.valueType === "vault" && <Chip color="amber" className="text-[9px]">vault</Chip>}
              </div>
            ))}
          </div>
        } full />
      )}
    </FieldGrid>
  );
}

registerSourceRenderer("url", {
  icon: Globe,
  bg: "bg-purple-500/18",
  iconColor: "text-purple-500",
  glow: "shadow-[0_0_18px_rgba(168,85,247,0.35)]",
  ring: "ring-purple-400/60",
  label: (s) => {
    try { return new URL(s.path).hostname; } catch { return s.path.slice(0, 18); }
  },
  sublabel: () => "URL",
  DetailContent: UrlSourceDetail,
});

// ─── Input module source renderer ─────────────────────────────────────────────

const INPUT_TYPE_LABELS: Record<string, string> = {
  "http-rest":  "HTTP REST",
  "digiposte":  "Digiposte",
  "sftp":       "SFTP",
};

function InputSourceDetail({ source, ctx }: { source: BackupSource; ctx: PipelineContext }) {
  const item = source.inputId ? ctx.inputMap.get(source.inputId) : undefined;

  return (
    <FieldGrid>
      {item ? (
        <>
          <Field label="Name"  value={item.name} />
          <Field label="Type"  value={
            <Chip color="teal">{INPUT_TYPE_LABELS[item.type] ?? item.type}</Chip>
          } />
          <Field label="Status" value={
            item.lastTestStatus === "ok"
              ? <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 className="size-3" /> Operational</span>
              : item.lastTestStatus === "error"
              ? <span className="flex items-center gap-1 text-red-500"><XCircle className="size-3" /> Error</span>
              : <span className="flex items-center gap-1 text-muted-foreground"><Clock className="size-3" /> Never tested</span>
          } />
          <Field label="Transfer" value={
            <Chip color={source.transferMode === "buffer" ? "amber" : "sky"}>
              {source.transferMode ?? "stream"}
            </Chip>
          } />
        </>
      ) : (
        <>
          <Field label="Input ID" value={<span className="font-mono">{source.inputId ?? "—"}</span>} />
          <Field label="Transfer" value={
            <Chip color={source.transferMode === "buffer" ? "amber" : "sky"}>
              {source.transferMode ?? "stream"}
            </Chip>
          } />
        </>
      )}
    </FieldGrid>
  );
}

registerSourceRenderer("input", {
  icon: Plug,
  bg: "bg-teal-500/18",
  iconColor: "text-teal-500",
  glow: "shadow-[0_0_18px_rgba(20,184,166,0.35)]",
  ring: "ring-teal-400/60",
  label: (s, ctx) => {
    const item = s.inputId ? ctx.inputMap.get(s.inputId) : undefined;
    return item?.name ?? (s.inputId ? s.inputId.slice(0, 10) + "…" : "Input");
  },
  sublabel: (s, ctx) => {
    const item = s.inputId ? ctx.inputMap.get(s.inputId) : undefined;
    return INPUT_TYPE_LABELS[item?.type ?? ""] ?? "Input";
  },
  DetailContent: InputSourceDetail,
});

// ─── Email output renderer ────────────────────────────────────────────────────

const MAX_RECIPIENTS_SHOWN = 5;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/65 mb-2">
      {children}
    </p>
  );
}

function EmailOutputDetail({ output, index, ctx }: {
  output: BackupOutput;
  index:  number;
  ctx:    PipelineContext;
}) {
  const [expanded, setExpanded] = useState(false);

  const vault = ctx.vaultsMap.get(output.vaultId);

  type RecipientEntry = { id: string; kind: "To" | "Cc" | "Bcc" };
  const allRecipients: RecipientEntry[] = [
    ...output.recipientsTo.map((id)  => ({ id, kind: "To"  as const })),
    ...output.recipientsCc.map((id)  => ({ id, kind: "Cc"  as const })),
    ...output.recipientsBcc.map((id) => ({ id, kind: "Bcc" as const })),
  ];
  const shown  = expanded ? allRecipients : allRecipients.slice(0, MAX_RECIPIENTS_SHOWN);
  const hidden = allRecipients.length - MAX_RECIPIENTS_SHOWN;

  function resolveRecipient(id: string): string {
    const c = ctx.contacts.get(id);
    if (!c) return id.slice(0, 18) + "…";
    return c.name ? `${c.name} <${c.email}>` : c.email;
  }

  const kindColor: Record<string, string> = {
    To:  "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    Cc:  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    Bcc: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">

      {/* ── Compte SMTP ── */}
      <div>
        <SectionLabel>Compte SMTP</SectionLabel>
        {vault ? (
          <div className="flex items-start gap-3 rounded-lg bg-muted/40 border border-border/40 px-3 py-2.5">
            <Mail className="size-3.5 shrink-0 text-sky-500 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-xs font-semibold text-foreground/90 truncate">{vault.name}</p>
              <p className="text-[11px] font-mono text-muted-foreground truncate">{vault.user}</p>
              <p className="text-[10px] text-muted-foreground/70 truncate">{vault.fromAddr} · {vault.host}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs font-mono text-muted-foreground/60 truncate">
            {output.vaultId ? output.vaultId.slice(0, 20) + "…" : "—"}
          </p>
        )}
      </div>

      {/* ── Destinataires ── */}
      <div>
        <SectionLabel>
          Destinataires{allRecipients.length > 0 ? ` (${allRecipients.length})` : ""}
        </SectionLabel>
        {allRecipients.length > 0 ? (
          <div className="space-y-1.5">
            {shown.map((r, i) => (
              <div key={i} className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                  kindColor[r.kind],
                )}>
                  {r.kind}
                </span>
                <span className="text-xs font-mono text-foreground/85 truncate min-w-0">
                  {resolveRecipient(r.id)}
                </span>
              </div>
            ))}
            {hidden > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5"
              >
                {expanded
                  ? <><ChevronUp className="size-3" /> Réduire</>
                  : <><ChevronDown className="size-3" /> {hidden} destinataire{hidden > 1 ? "s" : ""} de plus</>
                }
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/60">Aucun destinataire configuré</p>
        )}
      </div>

      {/* ── Paramètres email ── */}
      <div>
        <SectionLabel>Paramètres</SectionLabel>
        <FieldGrid>
          <Field label="Ordre" value={`#${index + 1}`} />
          <Field label="Template" value={
            output.templateId
              ? <Chip color="teal">{ctx.templatesMap.get(output.templateId) ?? output.templateId.slice(0, 10) + "…"}</Chip>
              : <Chip color="muted">Défaut</Chip>
          } />
          <Field label="Sujet" value={
            output.overrideSubject
              ? <Chip color="sky">Override</Chip>
              : <span className="text-muted-foreground/60">Défaut</span>
          } />
          <Field label="Corps" value={
            output.overrideBody
              ? <Chip color="sky">{output.overrideBodyType ?? "text"}</Chip>
              : <span className="text-muted-foreground/60">Défaut</span>
          } />
        </FieldGrid>
      </div>

    </div>
  );
}

registerOutputRenderer("mail", {
  icon: Mail,
  bg: "bg-sky-500/18",
  iconColor: "text-sky-500",
  glow: "shadow-[0_0_18px_rgba(14,165,233,0.35)]",
  ring: "ring-sky-400/60",
  label: () => "Mail",
  DetailContent: EmailOutputDetail,
});

// ─── Generic fallbacks ────────────────────────────────────────────────────────

function genericSourceRenderer(type: string): PipelineSourceRenderer {
  return {
    icon: Globe,
    bg: "bg-muted/70",
    iconColor: "text-muted-foreground",
    glow: "",
    ring: "ring-border",
    label: (s) => s.path?.slice(0, 16) ?? type,
    sublabel: () => type,
    DetailContent: ({ source }) => (
      <FieldGrid>
        <Field label="Type"  value={type} />
        <Field label="Path"  value={source.path ?? "—"} full />
      </FieldGrid>
    ),
  };
}

function genericOutputRenderer(type: string): PipelineOutputRenderer {
  return {
    icon: Send,
    bg: "bg-muted/70",
    iconColor: "text-muted-foreground",
    glow: "",
    ring: "ring-border",
    label: () => type,
    DetailContent: ({ index }) => (
      <FieldGrid>
        <Field label="Type"  value={type} />
        <Field label="Order" value={`#${index + 1}`} />
      </FieldGrid>
    ),
  };
}

// ─── File/folder group detail ─────────────────────────────────────────────────

const FILE_FOLDER_SHOWN = 6;

export function FileFolderGroupDetail({ sources }: { sources: BackupSource[] }) {
  const [expanded, setExpanded] = useState(false);

  const items   = expanded ? sources : sources.slice(0, FILE_FOLDER_SHOWN);
  const hidden  = sources.length - FILE_FOLDER_SHOWN;

  return (
    <div className="space-y-1.5">
      {items.map((s, i) => {
        const Icon   = s.type === "folder" ? Folder : FileText;
        const color  = s.type === "folder" ? "text-amber-500" : "text-blue-500";
        const excl   = s.exclude?.filter(Boolean).length ?? 0;

        return (
          <div key={i} className="flex items-start gap-2 py-1 min-w-0">
            <Icon className={cn("size-3.5 mt-0.5 shrink-0", color)} />
            <span className="text-xs font-mono text-foreground/85 truncate min-w-0 flex-1">
              {s.path}
            </span>
            {excl > 0 && (
              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                {excl} excl.
              </span>
            )}
          </div>
        );
      })}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          {expanded
            ? <><ChevronUp className="size-3" /> Collapse</>
            : <><ChevronDown className="size-3" /> {hidden} more path{hidden > 1 ? "s" : ""}</>
          }
        </button>
      )}
    </div>
  );
}
