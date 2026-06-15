"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GripVertical, Plus, Trash2, ChevronRight, Mail, Server } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContactPicker } from "@/components/mail/ContactPicker";
import { VariableInserter } from "@/components/mail/VariableInserter";
import type { EmailVaultItem, SshVaultItem } from "@/services/vault";
import type { MailTemplate } from "@/services/templates";
import type { Contact } from "@/services/contacts";

export interface OutputFormItem {
  dndId: string;
  type: "mail" | "ssh";
  vaultId: string;
  // mail-specific
  templateId: string;
  recipientsTo: Contact[];
  recipientsCc: Contact[];
  recipientsBcc: Contact[];
  overrideSubject: string;
  overrideBody: string;
  overrideBodyType: "text" | "html";
  // ssh-specific
  pathOverride: string;
}

export function emptyOutput(type: "mail" | "ssh" = "mail"): OutputFormItem {
  return {
    dndId: `out-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    vaultId: "",
    templateId: "",
    recipientsTo: [],
    recipientsCc: [],
    recipientsBcc: [],
    overrideSubject: "",
    overrideBody: "",
    overrideBodyType: "text",
    pathOverride: "",
  };
}

interface OutputTypeDef {
  key: "mail" | "ssh";
  icon: React.ElementType;
}

const OUTPUT_TYPE_DEFS: OutputTypeDef[] = [
  { key: "mail", icon: Mail },
  { key: "ssh", icon: Server },
];

const COMING_SOON_TYPES: { key: string; icon: React.ElementType }[] = [
  { key: "s3", icon: () => <span className="text-sm font-bold">S3</span> },
  { key: "webhook", icon: () => <span className="text-sm font-bold">{"{/}"}</span> },
];

interface StepOutputsProps {
  data: OutputFormItem[];
  vaultItems: EmailVaultItem[];
  sshVaultItems: SshVaultItem[];
  templates: MailTemplate[];
  contacts: Contact[];
  onChange: (data: OutputFormItem[]) => void;
}

export function StepOutputs({ data, vaultItems, sshVaultItems, templates, contacts, onChange }: StepOutputsProps) {
  const { t } = useTranslation();
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = data.findIndex((o) => o.dndId === active.id);
      const newIdx = data.findIndex((o) => o.dndId === over.id);
      onChange(arrayMove(data, oldIdx, newIdx));
    }
  };

  const updateOutput = (idx: number, partial: Partial<OutputFormItem>) =>
    onChange(data.map((o, i) => (i === idx ? { ...o, ...partial } : o)));

  const removeOutput = (idx: number) => onChange(data.filter((_, i) => i !== idx));

  const handleSelectType = (type: "mail" | "ssh") => {
    onChange([...data, emptyOutput(type)]);
    setTypePickerOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold">{t("backups.wizard.stepOutputs")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("backups.wizard.stepOutputsDesc")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setTypePickerOpen(true)}>
          <Plus className="size-3.5" />
          {t("backups.addOutput")}
        </Button>
      </div>

      {data.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground italic">{t("backups.wizard.noOutputs")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setTypePickerOpen(true)}
          >
            <Plus className="size-3.5" />
            {t("backups.addOutput")}
          </Button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={data.map((o) => o.dndId)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {data.map((output, idx) => (
              <SortableOutputCard
                key={output.dndId}
                output={output}
                idx={idx}
                vaultItems={vaultItems}
                sshVaultItems={sshVaultItems}
                templates={templates}
                contacts={contacts}
                onUpdate={(partial) => updateOutput(idx, partial)}
                onRemove={() => removeOutput(idx)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Output type picker dialog */}
      <Dialog open={typePickerOpen} onOpenChange={setTypePickerOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("backups.outputs.selectType")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            {/* Available types */}
            {OUTPUT_TYPE_DEFS.map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectType(key as "mail" | "ssh")}
                className="w-full flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/30 group"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{t(`output.type.${key}`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`output.typeDesc.${key}`)}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}

            {/* Coming soon */}
            {COMING_SOON_TYPES.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="flex items-center gap-4 rounded-lg border p-4 opacity-50 cursor-not-allowed"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{t(`output.type.${key}`)}</p>
                  <p className="text-xs text-muted-foreground">{t("output.comingSoon")}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {t("output.soon")}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SortableOutputCardProps {
  output: OutputFormItem;
  idx: number;
  vaultItems: EmailVaultItem[];
  sshVaultItems: SshVaultItem[];
  templates: MailTemplate[];
  contacts: Contact[];
  onUpdate: (partial: Partial<OutputFormItem>) => void;
  onRemove: () => void;
}

function SortableOutputCard({
  output,
  idx,
  vaultItems,
  sshVaultItems,
  templates,
  contacts,
  onUpdate,
  onRemove,
}: SortableOutputCardProps) {
  const { t } = useTranslation();
  const [overrideOpen, setOverrideOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: output.dndId,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("rounded-lg border bg-card", isDragging && "opacity-50 shadow-lg")}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">
          Output {idx + 1} — {t(`output.type.${output.type}`)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:bg-destructive/10"
          onClick={onRemove}
          aria-label={t("backups.removeOutput")}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {output.type === "ssh" ? (
          <FieldGroup>
            <Field>
              <FieldLabel>{t("output.ssh.vaultLabel")}</FieldLabel>
              <Select value={output.vaultId} onValueChange={(v) => onUpdate({ vaultId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("output.ssh.vaultPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {sshVaultItems.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name} — {v.username}@{v.host}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t("output.ssh.pathOverride")}</FieldLabel>
              <Input
                value={output.pathOverride}
                onChange={(e) => onUpdate({ pathOverride: e.target.value })}
                placeholder={output.vaultId ? sshVaultItems.find((v) => v.id === output.vaultId)?.defaultPath ?? t("output.ssh.pathOverridePlaceholder") : t("output.ssh.pathOverridePlaceholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">{t("output.ssh.pathOverrideHint")}</p>
            </Field>
          </FieldGroup>
        ) : (
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>{t("backups.outputVault")}</FieldLabel>
              <Select value={output.vaultId} onValueChange={(v) => onUpdate({ vaultId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("backups.outputVaultPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {vaultItems.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{t("backups.outputTemplate")}</FieldLabel>
              <Select
                value={output.templateId || "__none__"}
                onValueChange={(v) => onUpdate({ templateId: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("backups.outputTemplatePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("backups.outputTemplatePlaceholder")}</SelectItem>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel>{t("backups.outputTo")}</FieldLabel>
            <ContactPicker
              contacts={contacts}
              selected={output.recipientsTo}
              onChange={(sel) => onUpdate({ recipientsTo: sel })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>{t("backups.outputCc")}</FieldLabel>
              <ContactPicker
                contacts={contacts}
                selected={output.recipientsCc}
                onChange={(sel) => onUpdate({ recipientsCc: sel })}
              />
            </Field>
            <Field>
              <FieldLabel>{t("backups.outputBcc")}</FieldLabel>
              <ContactPicker
                contacts={contacts}
                selected={output.recipientsBcc}
                onChange={(sel) => onUpdate({ recipientsBcc: sel })}
              />
            </Field>
          </div>

        <Separator />

        {/* Override — collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setOverrideOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={cn("size-3 transition-transform", overrideOpen && "rotate-90")} />
            {t("backups.outputs.overrideContent")}
          </button>

          {overrideOpen && (
            <div className="mt-3 space-y-3">
              <Field>
                <FieldLabel>{t("backups.outputOverrideSubject")}</FieldLabel>
                <div className="flex gap-1.5">
                  <Input
                    value={output.overrideSubject}
                    onChange={(e) => onUpdate({ overrideSubject: e.target.value })}
                    placeholder={t("backups.outputOverrideSubjectPlaceholder")}
                    className="flex-1"
                  />
                  <VariableInserter
                    onInsert={(v) => onUpdate({ overrideSubject: output.overrideSubject + v })}
                  />
                </div>
              </Field>

              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel>{t("backups.outputOverrideBody")}</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Select
                      value={output.overrideBodyType}
                      onValueChange={(v) => onUpdate({ overrideBodyType: v as "text" | "html" })}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">{t("mail.bodyText")}</SelectItem>
                        <SelectItem value="html">{t("mail.bodyHtml")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <VariableInserter
                      onInsert={(v) => onUpdate({ overrideBody: output.overrideBody + v })}
                    />
                  </div>
                </div>
                <Textarea
                  value={output.overrideBody}
                  onChange={(e) => onUpdate({ overrideBody: e.target.value })}
                  placeholder={t("backups.outputOverrideBodyPlaceholder")}
                  rows={4}
                />
              </Field>
            </div>
          )}
        </div>
        </FieldGroup>
        )}
      </div>
    </div>
  );
}
