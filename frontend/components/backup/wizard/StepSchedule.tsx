"use client";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ScheduleType = "manual" | "oneshoot" | "recurring" | "interval";

export interface StepScheduleData {
  type: ScheduleType;
  datetime: string;
  timezone: string;
  days: number[];
  hour: number;
  minute: number;
  every: number;
  unit: "minutes" | "hours";
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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function StepSchedule({ data, onChange }: StepScheduleProps) {
  const { t } = useTranslation();

  const set = (partial: Partial<StepScheduleData>) =>
    onChange({ ...data, ...partial });

  const toggleDay = (day: number) => {
    const next = data.days.includes(day)
      ? data.days.filter((d) => d !== day)
      : [...data.days, day].sort((a, b) => a - b);
    set({ days: next });
  };

  const TYPES: { value: ScheduleType; label: string; desc: string }[] = [
    { value: "manual", label: t("backups.schedule.manual"), desc: t("backups.schedule.manualDesc") },
    { value: "oneshoot", label: t("backups.schedule.oneshoot"), desc: t("backups.schedule.oneshotDesc") },
    { value: "recurring", label: t("backups.schedule.recurring"), desc: t("backups.schedule.recurringDesc") },
    { value: "interval", label: t("backups.schedule.interval"), desc: t("backups.schedule.intervalDesc") },
  ];

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

      {/* Recurring config */}
      {data.type === "recurring" && (
        <FieldGroup>
          <Field>
            <FieldLabel>{t("backups.schedule.days")}</FieldLabel>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={cn(
                    "h-8 w-10 rounded-md text-xs font-medium border transition-colors",
                    data.days.includes(idx)
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input hover:border-muted-foreground/50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field>
              <FieldLabel>{t("backups.schedule.hour")}</FieldLabel>
              <Select
                value={String(data.hour)}
                onValueChange={(v) => set({ hour: Number(v) })}
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
            <Field>
              <FieldLabel>{t("backups.schedule.minute")}</FieldLabel>
              <Select
                value={String(data.minute)}
                onValueChange={(v) => set({ minute: Number(v) })}
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
            <Field>
              <FieldLabel>{t("backups.schedule.timezone")}</FieldLabel>
              <TimezoneSelect value={data.timezone} onChange={(v) => set({ timezone: v })} />
            </Field>
          </div>
        </FieldGroup>
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
        </FieldGroup>
      )}
    </div>
  );
}

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
