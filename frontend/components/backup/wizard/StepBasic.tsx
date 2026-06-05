"use client";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

export interface StepBasicData {
  name: string;
}

interface StepBasicProps {
  data: StepBasicData;
  enabled: boolean;
  isValidated: boolean;
  onChange: (data: StepBasicData) => void;
  onEnabledChange: (v: boolean) => void;
}

export function StepBasic({ data, enabled, isValidated, onChange, onEnabledChange }: StepBasicProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">{t("backups.wizard.stepBasic")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("backups.wizard.stepBasicDesc")}</p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="backup-name">{t("backups.name")}</FieldLabel>
          <Input
            id="backup-name"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder={t("backups.namePlaceholder")}
            required
            autoFocus
          />
        </Field>

        <Field orientation="horizontal" className="items-center rounded-lg border px-4 py-3">
          <div className="flex-1 space-y-0.5">
            <FieldLabel htmlFor="backup-enabled" className="text-sm font-medium cursor-pointer">
              {t("backups.enabled")}
            </FieldLabel>
            <p className="text-xs text-muted-foreground">
              {isValidated
                ? (enabled ? t("backups.enabledOn") : t("backups.enabledOff"))
                : t("backups.wizard.enabledHint")}
            </p>
          </div>
          <Switch
            id="backup-enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
            disabled={!isValidated}
          />
        </Field>
      </FieldGroup>
    </div>
  );
}
