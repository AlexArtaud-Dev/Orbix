"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { settingsService, type SystemSettings } from "@/services/settings";
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

export default function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService.get().then(setSettings).catch(() => toast.error(t("common.error")));
  }, [t]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await settingsService.update({
        maxFileSizeMb: settings.maxFileSizeMb,
        logRetentionDays: settings.logRetentionDays,
        backupRetentionDays: settings.backupRetentionDays,
        defaultTimezone: settings.defaultTimezone,
        defaultLanguage: settings.defaultLanguage,
        defaultTheme: settings.defaultTheme,
        filesRoot: settings.filesRoot,
      });
      setSettings(updated);
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!settings)
    return <p className="text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("settings.storage")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="maxFileSizeMb">{t("settings.maxFileSizeMb")}</FieldLabel>
                <Input
                  id="maxFileSizeMb"
                  type="number"
                  min={1}
                  value={settings.maxFileSizeMb}
                  onChange={(e) => setSettings({ ...settings, maxFileSizeMb: +e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="filesRoot">{t("settings.filesRoot")}</FieldLabel>
                <Input
                  id="filesRoot"
                  value={settings.filesRoot}
                  onChange={(e) => setSettings({ ...settings, filesRoot: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="logRetentionDays">{t("settings.logRetentionDays")}</FieldLabel>
                <Input
                  id="logRetentionDays"
                  type="number"
                  min={1}
                  value={settings.logRetentionDays}
                  onChange={(e) => setSettings({ ...settings, logRetentionDays: +e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="backupRetentionDays">{t("settings.backupRetentionDays")}</FieldLabel>
                <Input
                  id="backupRetentionDays"
                  type="number"
                  min={1}
                  value={settings.backupRetentionDays}
                  onChange={(e) => setSettings({ ...settings, backupRetentionDays: +e.target.value })}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("settings.localization")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="defaultTimezone">{t("settings.defaultTimezone")}</FieldLabel>
                <Input
                  id="defaultTimezone"
                  value={settings.defaultTimezone}
                  onChange={(e) => setSettings({ ...settings, defaultTimezone: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="defaultLanguage">{t("settings.defaultLanguage")}</FieldLabel>
                <Select
                  value={settings.defaultLanguage}
                  onValueChange={(v) => setSettings({ ...settings, defaultLanguage: v })}
                >
                  <SelectTrigger id="defaultLanguage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("settings.appearance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="defaultTheme">{t("settings.defaultTheme")}</FieldLabel>
                <Select
                  value={settings.defaultTheme}
                  onValueChange={(v) => setSettings({ ...settings, defaultTheme: v })}
                >
                  <SelectTrigger id="defaultTheme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
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
