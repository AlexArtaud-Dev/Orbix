"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  moduleSettingsService,
  type ModuleSettingsWithValues,
  type SettingFieldDefinition,
} from "@/services/settings";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeletonForm } from "@/components/ui/skeleton";

export default function ModuleSettingsPage() {
  const { module } = useParams<{ module: string }>();
  const { t } = useTranslation();
  const [data, setData] = useState<ModuleSettingsWithValues | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    moduleSettingsService
      .getOne(module)
      .then((d) => {
        setData(d);
        setValues(d.values);
      })
      .catch(() => toast.error(t("common.error")));
  }, [module, t]);

  const setValue = (key: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    try {
      const updated = await moduleSettingsService.update(module, values);
      setValues(updated);
      toast.success(t("moduleSettings.saved"));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <SkeletonForm blocks={2} />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t(data.definition.labelKey)} — {t("moduleSettings.title")}
        </h1>
        <p className="text-muted-foreground">
          {data.definition.descriptionKey
            ? t(data.definition.descriptionKey)
            : t("moduleSettings.subtitle")}
        </p>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("moduleSettings.parameters")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {data.definition.fields.map((field) => (
                <SettingField
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  onChange={(v) => setValue(field.key, v)}
                />
              ))}
            </FieldGroup>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? t("common.loading") : t("common.save")}
        </Button>
      </form>
    </div>
  );
}

function SettingField({
  field,
  value,
  onChange,
}: {
  field: SettingFieldDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { t } = useTranslation();
  const label = t(field.labelKey);
  const description = field.descriptionKey ? t(field.descriptionKey) : undefined;

  const fieldEl = (() => {
    if (field.type === "select" && field.options) {
      return (
        <Select
          value={String(value ?? field.defaultValue)}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger id={field.key}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === "boolean") {
      return (
        <Select
          value={String(value ?? field.defaultValue)}
          onValueChange={(v) => onChange(v === "true")}
        >
          <SelectTrigger id={field.key}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">{t("common.yes")}</SelectItem>
            <SelectItem value="false">{t("common.no")}</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        id={field.key}
        type={field.type === "number" ? "number" : "text"}
        min={field.min}
        max={field.max}
        value={String(value ?? field.defaultValue)}
        onChange={(e) =>
          onChange(field.type === "number" ? +e.target.value : e.target.value)
        }
      />
    );
  })();

  return (
    <Field>
      <FieldLabel htmlFor={field.key}>{label}</FieldLabel>
      {fieldEl}
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
    </Field>
  );
}
