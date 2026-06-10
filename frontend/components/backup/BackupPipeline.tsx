"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Folder, Layers,
  Archive, Package, FileCheck, Lock,
  Workflow, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Backup, BackupSource, BackupOutput } from "@/services/backups";
import type { InputItem } from "@/services/input";
import { contactsService, type Contact } from "@/services/contacts";
import { vaultService } from "@/services/vault";
import { templatesService, type MailTemplate } from "@/services/templates";
import {
  getSourceRenderer,
  getOutputRenderer,
  EMPTY_CONTEXT,
  FileFolderGroupDetail,
  FieldGrid,
  Field,
  Chip,
  type PipelineContext,
  type PipelineVaultInfo,
} from "./pipelineRenderers";

// ─── Source grouping ──────────────────────────────────────────────────────────

type SourceNode =
  | { kind: "files_folders"; sources: BackupSource[]; fileCount: number; folderCount: number }
  | { kind: "individual"; source: BackupSource; originalIndex: number };

function groupSources(sources: BackupSource[]): SourceNode[] {
  const ff    = sources.filter((s) => s.type === "file" || s.type === "folder");
  const other = sources.filter((s) => s.type !== "file" && s.type !== "folder");
  const nodes: SourceNode[] = [];
  if (ff.length > 0) {
    nodes.push({
      kind: "files_folders",
      sources: ff,
      fileCount:   ff.filter((s) => s.type === "file").length,
      folderCount: ff.filter((s) => s.type === "folder").length,
    });
  }
  other.forEach((s) => nodes.push({
    kind: "individual",
    source: s,
    originalIndex: sources.indexOf(s),
  }));
  return nodes;
}

function fileFolderLabel(fileCount: number, folderCount: number): string {
  if (fileCount > 0 && folderCount > 0) {
    return `${folderCount === 1 ? "Dossier" : "Dossiers"} · ${fileCount === 1 ? "Fichier" : "Fichiers"}`;
  }
  if (folderCount > 0) return folderCount === 1 ? "Dossier" : "Dossiers";
  return fileCount === 1 ? "Fichier" : "Fichiers";
}

// ─── Selected node ────────────────────────────────────────────────────────────

type SelectedNode =
  | { kind: "files_folders" }
  | { kind: "source"; source: BackupSource; originalIndex: number }
  | { kind: "archive" }
  | { kind: "output"; output: BackupOutput; index: number };

function nodeKey(n: SelectedNode): string {
  if (n.kind === "files_folders") return "files_folders";
  if (n.kind === "source")        return `source-${n.originalIndex}`;
  if (n.kind === "archive")       return "archive";
  return `output-${n.index}`;
}

// ─── Dialog wrapper ───────────────────────────────────────────────────────────

interface BackupPipelineDialogProps {
  backup:    Backup;
  variant?:  "icon" | "text";
  inputMap?: Map<string, InputItem>;
}

export function BackupPipelineDialog({
  backup, variant = "icon", inputMap,
}: BackupPipelineDialogProps) {
  const [open, setOpen]               = useState(false);
  const [contactsMap, setContactsMap] = useState<Map<string, Contact>>(new Map());
  const [vaultsMap, setVaultsMap]     = useState<Map<string, PipelineVaultInfo>>(new Map());
  const [templatesMap, setTemplatesMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    // Contacts (paginated)
    (async () => {
      try {
        const all: Contact[] = [];
        let cursor: string | undefined;
        do {
          const page = await contactsService.list(cursor, 100);
          all.push(...page.data);
          cursor = page.nextCursor ?? undefined;
        } while (cursor && !cancelled);
        if (!cancelled) setContactsMap(new Map(all.map((c) => [c.id, c])));
      } catch { /* non-blocking */ }
    })();

    // Email vaults (small list, one page)
    (async () => {
      try {
        const page = await vaultService.listEmail(undefined, 100);
        if (!cancelled) setVaultsMap(new Map(page.data.map((v) => [
          v.id,
          { name: v.name, user: v.user, host: v.host, fromAddr: v.fromAddr },
        ])));
      } catch { /* non-blocking */ }
    })();

    // Mail templates (paginated)
    (async () => {
      try {
        const all: MailTemplate[] = [];
        let cursor: string | undefined;
        do {
          const page = await templatesService.list(cursor, 100);
          all.push(...page.data);
          cursor = page.nextCursor ?? undefined;
        } while (cursor && !cancelled);
        if (!cancelled) setTemplatesMap(new Map(all.map((t) => [t.id, t.name])));
      } catch { /* non-blocking */ }
    })();

    return () => { cancelled = true; };
  }, [open]);

  const ctx: PipelineContext = {
    contacts:     contactsMap,
    inputMap:     inputMap ?? new Map(),
    vaultsMap,
    templatesMap,
  };

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(true)}
          aria-label="View pipeline"
        >
          <Workflow className="size-3.5 text-muted-foreground" />
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors shrink-0"
        >
          View pipeline
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-2xl border-border/60 shadow-2xl rounded-2xl overflow-hidden"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Workflow className="size-4 text-muted-foreground" />
              {backup.name}
            </DialogTitle>
          </DialogHeader>
          <BackupPipeline backup={backup} ctx={ctx} />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

interface BackupPipelineProps {
  backup: Backup;
  ctx?:   PipelineContext;
}

export function BackupPipeline({ backup, ctx = EMPTY_CONTEXT }: BackupPipelineProps) {
  const [selected, setSelected] = useState<SelectedNode | null>(null);

  const sourceNodes = groupSources(backup.sources.sources);
  const outputs     = backup.outputs;

  function toggle(node: SelectedNode) {
    setSelected((prev) => prev && nodeKey(prev) === nodeKey(node) ? null : node);
  }

  return (
    <div className="space-y-5 py-2">

      {/* ── Pipeline row ── */}
      <div className="flex items-start justify-center gap-0">

        {/* Sources column */}
        <div className="flex flex-col gap-4 items-center min-w-[120px]">
          <ColLabel>Sources</ColLabel>
          {sourceNodes.length === 0 ? (
            <EmptyPill label="Aucune source" />
          ) : (
            sourceNodes.map((node) =>
              node.kind === "files_folders" ? (
                <FileFolderPill
                  key="files_folders"
                  fileCount={node.fileCount}
                  folderCount={node.folderCount}
                  total={node.sources.length}
                  isSelected={selected?.kind === "files_folders"}
                  onClick={() => toggle({ kind: "files_folders" })}
                />
              ) : (
                <SourcePill
                  key={`source-${node.originalIndex}`}
                  source={node.source}
                  ctx={ctx}
                  isSelected={
                    selected?.kind === "source" &&
                    selected.originalIndex === node.originalIndex
                  }
                  onClick={() =>
                    toggle({ kind: "source", source: node.source, originalIndex: node.originalIndex })
                  }
                />
              )
            )
          )}
        </div>

        {/* Sources → Archive straight arrow */}
        <PipelineArrow delay={0} />

        {/* Archive column */}
        <div className="flex flex-col gap-4 items-center min-w-[100px]">
          <ColLabel>Archive</ColLabel>
          <ArchivePill
            backup={backup}
            isSelected={selected?.kind === "archive"}
            onClick={() => toggle({ kind: "archive" })}
          />
        </div>

        {/* Archive → Outputs: straight or fan-out */}
        <FanOutArrow count={outputs.length} delay={0.22} />

        {/* Outputs column */}
        <div className="flex flex-col gap-4 items-center min-w-[120px]">
          <ColLabel>Outputs</ColLabel>
          {outputs.length === 0 ? (
            <EmptyPill label="Aucun output" />
          ) : (
            outputs.map((o, i) => (
              <OutputPill
                key={o.id}
                output={o}
                index={i}
                ctx={ctx}
                isSelected={selected?.kind === "output" && selected.index === i}
                onClick={() => toggle({ kind: "output", output: o, index: i })}
              />
            ))
          )}
        </div>

      </div>

      {/* ── Detail panel ── */}
      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={nodeKey(selected)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <DetailPanel
              node={selected}
              backup={backup}
              ctx={ctx}
              onClose={() => setSelected(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// ─── Column label ─────────────────────────────────────────────────────────────

function ColLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/65 select-none">
      {children}
    </span>
  );
}

// ─── Layout constants for SVG arrow positioning ────────────────────────────────
// All pills are now size-11 (44 px) for uniform alignment.
//
//  ColLabel (text-[9px], line-height ≈ 1.5) → ~14 px
//  gap-4 between label and first pill       → 16 px
//  All icons: size-11 = 44 px → half = 22 px
//  Full pill (icon + gap-1.5 + label + gap-1.5 + sublabel) → 86 px
//  gap-4 between pills                      → 16 px

const _LABEL_H     = 14;
const _GAP         = 16;
const _ICON_R      = 22;   // size-11 / 2 (uniform)
const _PILL_H      = 86;   // total pill height

// All columns share the same formula — archive and output 0 align perfectly.
function _nodeY(i: number) {
  return _LABEL_H + _GAP + _ICON_R + i * (_PILL_H + _GAP);  // 52 + i*102
}

// ─── Straight arrow (Sources → Archive) ──────────────────────────────────────
// pt-[45px] = _nodeY(0) - SVG_CENTER(7) = 52 - 7 = 45 → aligns with icon center.

function PipelineArrow({ delay }: { delay: number }) {
  return (
    <div className="flex items-start justify-center shrink-0 w-12 pt-[45px]" aria-hidden>
      <svg width="48" height="14" viewBox="0 0 48 14" fill="none" className="text-muted-foreground/55">
        <motion.path
          d="M 2 7 L 34 7"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: "easeOut", delay }}
        />
        <motion.path
          d="M 29 2 L 40 7 L 29 12"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          fill="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, delay: delay + 0.43 }}
        />
      </svg>
    </div>
  );
}

// ─── Fan-out arrow (Archive → Outputs) ───────────────────────────────────────
//
// Single output → same visual as PipelineArrow (pt-[52px] aligned).
// Multiple outputs → branching SVG spanning the full outputs column height.

function FanOutArrow({ count, delay }: { count: number; delay: number }) {
  // ── Single output: plain straight arrow (same as PipelineArrow) ─────────────
  if (count <= 1) {
    return (
      <div className="flex items-start justify-center shrink-0 w-12 pt-[45px]" aria-hidden>
        <svg width="48" height="14" viewBox="0 0 48 14" fill="none" className="text-muted-foreground/55">
          <motion.path
            d="M 2 7 L 34 7"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: "easeOut", delay }}
          />
          <motion.path
            d="M 29 2 L 40 7 L 29 12"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            fill="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, delay: delay + 0.43 }}
          />
        </svg>
      </div>
    );
  }

  // ── Multiple outputs: branching fan-out ────────────────────────────────────
  // Since all pills are size-11, archive and output-0 share the same Y (52px).
  // This means the archive horizontal + branch-0 form a single straight line,
  // with subsequent branches dropping down from the vertical spine — clean T-junction.
  const W       = 56;    // w-14
  const SPINE_X = 20;
  const END_X   = W - 6; // 50 — arrowhead tip
  const HB      = 7;     // arrowhead back
  const HW      = 4;     // arrowhead wing

  const archY = _nodeY(0);  // 52 — same as output 0 (uniform sizing)
  const outs  = Array.from({ length: count }, (_, i) => _nodeY(i));
  const svgH  = outs[count - 1] + _ICON_R + 10;

  return (
    <div className="shrink-0 w-14" style={{ height: svgH }} aria-hidden>
      <svg
        width={W}
        height={svgH}
        viewBox={`0 0 ${W} ${svgH}`}
        fill="none"
        className="text-muted-foreground/55"
      >
        {/* Archive horizontal → spine (colinear with branch 0) */}
        <motion.path
          d={`M 2 ${archY} L ${SPINE_X} ${archY}`}
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut", delay }}
        />

        {/* Vertical spine: from output-0 Y down to last output Y */}
        <motion.path
          d={`M ${SPINE_X} ${outs[0]} L ${SPINE_X} ${outs[count - 1]}`}
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.18 + count * 0.06, ease: "easeOut", delay: delay + 0.26 }}
        />

        {/* Per-output branch + arrowhead */}
        {outs.map((y, i) => (
          <g key={i}>
            <motion.path
              d={`M ${SPINE_X} ${y} L ${END_X - HB} ${y}`}
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.22, ease: "easeOut", delay: delay + 0.44 + i * 0.1 }}
            />
            <motion.path
              d={`M ${END_X - HB} ${y - HW} L ${END_X} ${y} L ${END_X - HB} ${y + HW}`}
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.1, delay: delay + 0.44 + i * 0.1 + 0.2 }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── File/folder group pill ───────────────────────────────────────────────────

function FileFolderPill({
  fileCount, folderCount, total, isSelected, onClick,
}: {
  fileCount: number; folderCount: number; total: number;
  isSelected: boolean; onClick: () => void;
}) {
  const mixed     = fileCount > 0 && folderCount > 0;
  const Icon      = mixed ? Layers : (folderCount > 0 ? Folder : FileText);
  const iconBg    = mixed ? "bg-slate-500/18" : (folderCount > 0 ? "bg-amber-500/18" : "bg-blue-500/18");
  const iconColor = mixed ? "text-slate-400" : (folderCount > 0 ? "text-amber-500" : "text-blue-500");
  const glow      = mixed
    ? "shadow-[0_0_18px_rgba(100,116,139,0.35)]"
    : folderCount > 0
    ? "shadow-[0_0_18px_rgba(245,158,11,0.35)]"
    : "shadow-[0_0_18px_rgba(59,130,246,0.35)]";
  const ring      = mixed
    ? "ring-slate-400/60"
    : (folderCount > 0 ? "ring-amber-400/60" : "ring-blue-400/60");

  return (
    <FloatingPill
      icon={<Icon className="size-5" />}
      iconBg={iconBg}
      iconColor={iconColor}
      glow={glow}
      ring={ring}
      label={fileFolderLabel(fileCount, folderCount)}
      sublabel={`${total} chemin${total > 1 ? "s" : ""}`}
      isSelected={isSelected}
      onClick={onClick}
    />
  );
}

// ─── Individual source pill (url, input, …) ───────────────────────────────────

function SourcePill({
  source, ctx, isSelected, onClick,
}: {
  source: BackupSource; ctx: PipelineContext;
  isSelected: boolean; onClick: () => void;
}) {
  const r    = getSourceRenderer(source.type);
  const Icon = r.icon;
  return (
    <FloatingPill
      icon={<Icon className="size-5" />}
      iconBg={r.bg}
      iconColor={r.iconColor}
      glow={r.glow}
      ring={r.ring}
      label={r.label(source, ctx)}
      sublabel={r.sublabel(source, ctx)}
      isSelected={isSelected}
      onClick={onClick}
    />
  );
}

// ─── Archive pill ─────────────────────────────────────────────────────────────

function ArchivePill({ backup, isSelected, onClick }: {
  backup: Backup; isSelected: boolean; onClick: () => void;
}) {
  const Icon  = backup.noArchive ? FileCheck : (backup.archiveFormat === "zip" ? Archive : Package);
  const label = backup.noArchive
    ? "Raw"
    : ({ zip: "ZIP", tar: "TAR", "tar-gz": "TAR.GZ", "tar-bz2": "TAR.BZ2" }[backup.archiveFormat]
      ?? backup.archiveFormat.toUpperCase());
  return (
    <FloatingPill
      icon={<Icon className="size-5" />}
      iconBg="bg-violet-500/18"
      iconColor="text-violet-500"
      glow="shadow-[0_0_22px_rgba(139,92,246,0.38)]"
      ring="ring-violet-400/60"
      label={label}
      sublabel="Archive"
      isSelected={isSelected}
      onClick={onClick}
    />
  );
}

// ─── Output pill ──────────────────────────────────────────────────────────────

function OutputPill({
  output, index, ctx, isSelected, onClick,
}: {
  output: BackupOutput; index: number; ctx: PipelineContext;
  isSelected: boolean; onClick: () => void;
}) {
  const r    = getOutputRenderer(output.type);
  const Icon = r.icon;
  return (
    <FloatingPill
      icon={<Icon className="size-5" />}
      iconBg={r.bg}
      iconColor={r.iconColor}
      glow={r.glow}
      ring={r.ring}
      label={r.label(output)}
      sublabel={`Output #${index + 1}`}
      isSelected={isSelected}
      onClick={onClick}
    />
  );
}

// ─── Floating pill base ───────────────────────────────────────────────────────

interface FloatingPillProps {
  icon: React.ReactNode;
  iconBg: string; iconColor: string; glow: string; ring: string;
  label: string; sublabel: string;
  isSelected: boolean; onClick: () => void;
}

function FloatingPill({
  icon, iconBg, iconColor, glow, ring,
  label, sublabel, isSelected, onClick,
}: FloatingPillProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 cursor-pointer select-none outline-none"
      animate={{ scale: isSelected ? 1.06 : 1 }}
      whileHover={{ scale: isSelected ? 1.06 : 1.04 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
    >
      <div className={cn(
        "flex size-11 items-center justify-center rounded-xl transition-all duration-200",
        iconBg, iconColor,
        isSelected && `ring-2 ring-offset-2 ring-offset-background ${ring} ${glow}`,
      )}>
        {icon}
      </div>
      <span className="text-[11px] font-medium leading-tight text-center max-w-[100px] text-foreground/90">
        {label}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/65">
        {sublabel}
      </span>
    </motion.button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyPill({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex size-11 items-center justify-center rounded-xl border-2 border-dashed border-border/50" />
      <span className="text-[10px] text-muted-foreground/50">{label}</span>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  node, backup, ctx, onClose,
}: {
  node: SelectedNode; backup: Backup; ctx: PipelineContext; onClose: () => void;
}) {
  const { headerIcon, headerBg, headerColor, title, subtitle, content } = (() => {
    if (node.kind === "files_folders") {
      const ff  = backup.sources.sources.filter((s) => s.type === "file" || s.type === "folder");
      const fC  = ff.filter((s) => s.type === "file").length;
      const dC  = ff.filter((s) => s.type === "folder").length;
      const mixed = fC > 0 && dC > 0;
      const Icon  = mixed ? Layers : (dC > 0 ? Folder : FileText);
      return {
        headerIcon:  <Icon className="size-[18px]" />,
        headerBg:    mixed ? "bg-slate-500/18" : (dC > 0 ? "bg-amber-500/18" : "bg-blue-500/18"),
        headerColor: mixed ? "text-slate-400"  : (dC > 0 ? "text-amber-500"  : "text-blue-500"),
        title:    fileFolderLabel(fC, dC),
        subtitle: `${ff.length} chemin${ff.length > 1 ? "s" : ""} sources`,
        content:  <FileFolderGroupDetail sources={ff} />,
      };
    }

    if (node.kind === "source") {
      const r    = getSourceRenderer(node.source.type);
      const Icon = r.icon;
      return {
        headerIcon:  <Icon className="size-[18px]" />,
        headerBg:    r.bg,
        headerColor: r.iconColor,
        title:    r.label(node.source, ctx),
        subtitle: r.sublabel(node.source, ctx),
        content:  <r.DetailContent source={node.source} ctx={ctx} />,
      };
    }

    if (node.kind === "archive") {
      const fmt  = backup.noArchive ? "Raw file"
        : ({ zip: "ZIP", tar: "TAR", "tar-gz": "TAR.GZ", "tar-bz2": "TAR.BZ2" }[backup.archiveFormat]
          ?? backup.archiveFormat.toUpperCase());
      const Icon = backup.noArchive ? FileCheck
        : (backup.archiveFormat === "zip" ? Archive : Package);
      return {
        headerIcon:  <Icon className="size-[18px]" />,
        headerBg:    "bg-violet-500/18",
        headerColor: "text-violet-500",
        title:    fmt,
        subtitle: "Archive settings",
        content:  <ArchiveDetail backup={backup} />,
      };
    }

    const r    = getOutputRenderer(node.output.type);
    const Icon = r.icon;
    return {
      headerIcon:  <Icon className="size-[18px]" />,
      headerBg:    r.bg,
      headerColor: r.iconColor,
      title:    r.label(node.output),
      subtitle: `Output #${node.index + 1}`,
      content:  <r.DetailContent output={node.output} index={node.index} ctx={ctx} />,
    };
  })();

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 backdrop-blur-sm px-5 py-4">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          headerBg, headerColor,
        )}>
          {headerIcon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-none truncate">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {content}
    </div>
  );
}

// ─── Archive detail ───────────────────────────────────────────────────────────

function ArchiveDetail({ backup }: { backup: Backup }) {
  if (backup.noArchive) {
    return (
      <FieldGrid>
        <Field label="Mode" value="Fichier unique, pas d'archive" full />
      </FieldGrid>
    );
  }

  const compressionLabels: Record<string, string> = {
    store: "Aucune", fast: "Rapide", default: "Par défaut", best: "Maximale",
  };
  const encrypted = !!(backup.zipPassword || backup.zipPasswordVaultRef);

  return (
    <FieldGrid>
      <Field label="Format" value={
        { zip: "ZIP", tar: "TAR", "tar-gz": "TAR.GZ", "tar-bz2": "TAR.BZ2" }[backup.archiveFormat]
        ?? backup.archiveFormat
      } />
      <Field label="Compression" value={
        compressionLabels[backup.zipCompression] ?? backup.zipCompression
      } />
      <Field label="Chiffrement" value={
        encrypted ? (
          <span className="flex items-center gap-1">
            <Chip color="amber"><Lock className="size-2.5" /> Chiffré</Chip>
            {backup.zipPasswordVaultRef && <Chip color="muted">Vault ref</Chip>}
          </span>
        ) : (
          <Chip color="muted">Aucun</Chip>
        )
      } />
      {backup.zipFilename && (
        <Field label="Nom du fichier" value={backup.zipFilename} full />
      )}
    </FieldGrid>
  );
}
