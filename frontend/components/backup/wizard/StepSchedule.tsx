"use client";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ScheduleType = "manual" | "oneshoot" | "recurring" | "interval";

export interface RecurringRule {
  days: number[];
  hour: number;
  minute: number;
}

export interface StepScheduleData {
  type: ScheduleType;
  datetime: string;
  timezone: string;
  recurringRules: RecurringRule[];
  every: number;
  unit: "minutes" | "hours";
  intervalStartDate: string;
  intervalEndDate: string;
}

interface StepScheduleProps {
  data: StepScheduleData;
  onChange: (data: StepScheduleData) => void;
}

const TIMEZONES = [
  "UTC",
  "Europe/Paris", "Europe/London", "Europe/Berlin", "Europe/Madrid",
  "Europe/Rome", "Europe/Amsterdam", "Europe/Brussels", "Europe/Zurich",
  "Europe/Warsaw", "Europe/Prague", "Europe/Stockholm", "Europe/Helsinki",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Toronto", "America/Vancouver", "America/Sao_Paulo", "America/Mexico_City",
  "America/Argentina/Buenos_Aires",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Singapore", "Asia/Dubai",
  "Asia/Kolkata", "Asia/Seoul", "Asia/Hong_Kong", "Asia/Bangkok",
  "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland",
  "Africa/Cairo", "Africa/Johannesburg",
];

// Mon→Sun display order (Sun=0 last, matching ISO week convention)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  1: "Lun", 2: "Mar", 3: "Mer", 4: "Jeu", 5: "Ven", 6: "Sam", 0: "Dim",
};

export function StepSchedule({ data, onChange }: StepScheduleProps) {
  const { t } = useTranslation();

  const set = (partial: Partial<StepScheduleData>) =>
    onChange({ ...data, ...partial });

  const TYPES: { value: ScheduleType; label: string; desc: string }[] = [
    { value: "manual", label: t("backups.schedule.manual"), desc: t("backups.schedule.manualDesc") },
    { value: "oneshoot", label: t("backups.schedule.oneshoot"), desc: t("backups.schedule.oneshotDesc") },
    { value: "recurring", label: t("backups.schedule.recurring"), desc: t("backups.schedule.recurringDesc") },
    { value: "interval", label: t("backups.schedule.interval"), desc: t("backups.schedule.intervalDesc") },
  ];

  // ── Recurring helpers ────────────────────────────────────────────────────────

  const updateRule = (index: number, updated: RecurringRule) => {
    const next = data.recurringRules.map((r, i) => (i === index ? updated : r));
    set({ recurringRules: next });
  };

  const addRule = () => {
    set({
      recurringRules: [
        ...data.recurringRules,
        { days: [1, 2, 3, 4, 5], hour: 3, minute: 0 },
      ],
    });
  };

  const removeRule = (index: number) => {
    set({ recurringRules: data.recurringRules.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">{t("backups.wizard.stepSchedule")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("backups.wizard.stepScheduleDesc")}</p>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => set({ type: type.value })}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              data.type === type.value
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground",
            )}
          >
            <p className="text-sm font-medium">{type.label}</p>
            <p className="text-xs mt-0.5 opacity-70">{type.desc}</p>
          </button>
        ))}
      </div>

      {/* One-shot config */}
      {data.type === "oneshoot" && (
        <FieldGroup>
          <Field>
            <FieldLabel>{t("backups.schedule.datetime")}</FieldLabel>
            <Input
              type="datetime-local"
              value={data.datetime}
              onChange={(e) => set({ datetime: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel>{t("backups.schedule.timezone")}</FieldLabel>
            <TimezoneSelect value={data.timezone} onChange={(v) => set({ timezone: v })} />
          </Field>
        </FieldGroup>
      )}

      {/* Recurring config — multi-rule */}
      {data.type === "recurring" && (
        <div className="space-y-3">
          {data.recurringRules.map((rule, i) => (
            <RecurringRuleRow
              key={i}
              rule={rule}
              index={i}
              total={data.recurringRules.length}
              onUpdate={(r) => updateRule(i, r)}
              onRemove={() => removeRule(i)}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRule}
            className="w-full border-dashed text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3.5" />
            {t("backups.schedule.addTimeSlot")}
          </Button>

          <Field>
            <FieldLabel>{t("backups.schedule.timezone")}</FieldLabel>
            <TimezoneSelect value={data.timezone} onChange={(v) => set({ timezone: v })} />
          </Field>
        </div>
      )}

      {/* Interval config */}
      {data.type === "interval" && (
        <FieldGroup>
          <div className="flex items-end gap-3">
            <Field className="w-32">
              <FieldLabel>{t("backups.schedule.every")}</FieldLabel>
              <Input
                type="number"
                min={1}
                max={999}
                value={data.every}
                onChange={(e) => set({ every: Math.max(1, Number(e.target.value)) })}
              />
            </Field>
            <Field className="flex-1">
              <FieldLabel>{t("backups.schedule.unit")}</FieldLabel>
              <Select value={data.unit} onValueChange={(v) => set({ unit: v as "minutes" | "hours" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">{t("backups.schedule.minutes")}</SelectItem>
                  <SelectItem value="hours">{t("backups.schedule.hours")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("backups.schedule.intervalMin")}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>{t("backups.schedule.startDate")}</FieldLabel>
              <Input
                type="datetime-local"
                value={data.intervalStartDate}
                onChange={(e) => set({ intervalStartDate: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel className="flex items-center gap-2">
                {t("backups.schedule.endDate")}
                <span className="text-[10px] text-muted-foreground font-normal">(optionnelle)</span>
              </FieldLabel>
              <div className="relative">
                <Input
                  type="datetime-local"
                  value={data.intervalEndDate}
                  onChange={(e) => set({ intervalEndDate: e.target.value })}
                />
                {data.intervalEndDate && (
                  <button
                    type="button"
                    onClick={() => set({ intervalEndDate: "" })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("backups.schedule.endDateOptional")}
                  </button>
                )}
              </div>
            </Field>
          </div>
        </FieldGroup>
      )}
    </div>
  );
}

// ─── Recurring rule card ──────────────────────────────────────────────────────

interface RecurringRuleRowProps {
  rule: RecurringRule;
  index: number;
  total: number;
  onUpdate: (r: RecurringRule) => void;
  onRemove: () => void;
}

function RecurringRuleRow({ rule, index, total, onUpdate, onRemove }: RecurringRuleRowProps) {
  const { t } = useTranslation();
  const toggleDay = (day: number) => {
    const next = rule.days.includes(day)
      ? rule.days.filter((d) => d !== day)
      : [...rule.days, day].sort((a, b) => {
          // Keep Sun (0) last in the internal array
          const a2 = a === 0 ? 7 : a;
          const b2 = b === 0 ? 7 : b;
          return a2 - b2;
        });
    onUpdate({ ...rule, days: next });
  };

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {t("backups.schedule.timeSlot")} {index + 1}
        </span>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>

      {/* Day picker */}
      <div className="flex gap-1.5 flex-wrap">
        {DAY_ORDER.map((dayNum) => (
          <button
            key={dayNum}
            type="button"
            onClick={() => toggleDay(dayNum)}
            className={cn(
              "h-8 w-10 rounded-md text-xs font-medium border transition-colors",
              rule.days.includes(dayNum)
                ? "bg-primary border-primary text-primary-foreground"
                : "border-input hover:border-muted-foreground/50 text-muted-foreground",
            )}
          >
            {DAY_LABELS[dayNum]}
          </button>
        ))}
      </div>

      {/* Time pickers */}
      <div className="flex gap-3">
        <Field className="flex-1">
          <FieldLabel>{t("backups.schedule.hour")}</FieldLabel>
          <Select
            value={String(rule.hour)}
            onValueChange={(v) => onUpdate({ ...rule, hour: Number(v) })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {String(i).padStart(2, "0")}h
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="flex-1">
          <FieldLabel>{t("backups.schedule.minute")}</FieldLabel>
          <Select
            value={String(rule.minute)}
            onValueChange={(v) => onUpdate({ ...rule, minute: Number(v) })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {String(m).padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

// ─── Timezone select ──────────────────────────────────────────────────────────

function TimezoneSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={t("backups.schedule.timezone")} />
      </SelectTrigger>
      <SelectContent className="max-h-56">
        {TIMEZONES.map((tz) => (
          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
