"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { settingsService, type SystemSettings } from "@/services/settings";
import { ApiError } from "@/lib/api";

export default function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService.get().then(setSettings);
  }, []);

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

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        <Section title={t("settings.storage")}>
          <Field label={t("settings.maxFileSizeMb")}>
            <input type="number" min={1} className={inputCls}
              value={settings.maxFileSizeMb}
              onChange={(e) => setSettings({ ...settings, maxFileSizeMb: +e.target.value })} />
          </Field>
          <Field label={t("settings.logRetentionDays")}>
            <input type="number" min={1} className={inputCls}
              value={settings.logRetentionDays}
              onChange={(e) => setSettings({ ...settings, logRetentionDays: +e.target.value })} />
          </Field>
          <Field label={t("settings.backupRetentionDays")}>
            <input type="number" min={1} className={inputCls}
              value={settings.backupRetentionDays}
              onChange={(e) => setSettings({ ...settings, backupRetentionDays: +e.target.value })} />
          </Field>
        </Section>

        <Section title={t("settings.localization")}>
          <Field label={t("settings.defaultTimezone")}>
            <input className={inputCls} value={settings.defaultTimezone}
              onChange={(e) => setSettings({ ...settings, defaultTimezone: e.target.value })} />
          </Field>
          <Field label={t("settings.defaultLanguage")}>
            <select className={inputCls} value={settings.defaultLanguage}
              onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </Field>
        </Section>

        <Section title={t("settings.appearance")}>
          <Field label={t("settings.defaultTheme")}>
            <select className={inputCls} value={settings.defaultTheme}
              onChange={(e) => setSettings({ ...settings, defaultTheme: e.target.value })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </Field>
        </Section>

        <button type="submit" disabled={saving}
          className="inline-flex h-9 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50">
          {saving ? t("common.loading") : t("common.save")}
        </button>
      </form>
    </div>
  );
}

const inputCls =
  "flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <p className="font-semibold text-sm">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground/80">{label}</label>
      {children}
    </div>
  );
}
