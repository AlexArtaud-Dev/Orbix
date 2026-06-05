"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, FlaskConical } from "lucide-react";
import { settingsService, type SystemSettings } from "@/services/settings";
import { backupsService, type ZipInfo, type ZipTestResult } from "@/services/backups";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
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
  const [zipInfo, setZipInfo] = useState<ZipInfo | null>(null);
  const [zipTestResult, setZipTestResult] = useState<ZipTestResult | null>(null);
  const [testingZip, setTestingZip] = useState(false);

  useEffect(() => {
    settingsService.get().then(setSettings).catch(() => toast.error(t("common.error")));
    backupsService.getZipInfo().then(setZipInfo).catch(() => null);
  }, [t]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await settingsService.update({
        maxFileSizeMb: settings.maxFileSizeMb,
        logRetentionHours: settings.logRetentionHours,
        backupRetentionDays: settings.backupRetentionDays,
        defaultTimezone: settings.defaultTimezone,
        defaultLanguage: settings.defaultLanguage,
        defaultTheme: settings.defaultTheme,
        filesRoot: settings.filesRoot,
      });
      setSettings(updated);
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleZipTest = async () => {
    setTestingZip(true);
    setZipTestResult(null);
    try {
      const result = await backupsService.testZip();
      setZipTestResult(result);
      if (result.success) toast.success(t("settings.zipTestSuccess"));
      else toast.error(t("settings.zipTestFailed"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setTestingZip(false);
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
                <FieldLabel htmlFor="logRetentionHours">{t("settings.logRetentionHours")}</FieldLabel>
                <Input
                  id="logRetentionHours"
                  type="number"
                  min={1}
                  value={settings.logRetentionHours}
                  onChange={(e) => setSettings({ ...settings, logRetentionHours: +e.target.value })}
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
                  <SelectTrigger id="defaultLanguage"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger id="defaultTheme"><SelectValue /></SelectTrigger>
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

        {/* ── Zip capabilities ── */}
        <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("settings.zipTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!zipInfo ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <>
              {/* Info row */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{t("settings.zipPlatform")}: <span className="font-mono text-foreground">{zipInfo.platform}</span></span>
                <span>Node: <span className="font-mono text-foreground">{zipInfo.node}</span></span>
              </div>

              <Separator />

              {/* Capabilities */}
              <div className="space-y-2">
                <ZipCapabilityRow
                  label={t("settings.zipBasic")}
                  desc={t("settings.zipBasicDesc")}
                  available={zipInfo.basic}
                />
                <ZipCapabilityRow
                  label={t("settings.zipEncrypted")}
                  desc={t("settings.zipEncryptedDesc")}
                  available={zipInfo.encrypted}
                />
                <ZipCapabilityRow
                  label={t("settings.zipTarBz2")}
                  desc={t("settings.zipTarBz2Desc")}
                  available={zipInfo.tarBz2}
                />
              </div>

              <Separator />

              {/* Test */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleZipTest()}
                  disabled={testingZip}
                >
                  {testingZip ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <FlaskConical className="size-3.5" />
                  )}
                  {t("settings.zipTest")}
                </Button>

                {zipTestResult && (
                  <div className="flex items-center gap-2 text-xs">
                    {zipTestResult.success ? (
                      <CheckCircle2 className="size-3.5 text-green-500" />
                    ) : (
                      <XCircle className="size-3.5 text-destructive" />
                    )}
                    {zipTestResult.success ? (
                      <span className="text-muted-foreground">
                        {zipTestResult.sizeBytes} B — {zipTestResult.durationMs} ms
                      </span>
                    ) : (
                      <span className="text-destructive">{zipTestResult.error}</span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

        <Button type="submit" disabled={saving}>
          {saving ? t("common.loading") : t("common.save")}
        </Button>
      </form>
    </div>
  );
}

function ZipCapabilityRow({
  label,
  desc,
  available,
}: {
  label: string;
  desc: string;
  available: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {available ? (
        <CheckCircle2 className="size-4 shrink-0 text-green-500" />
      ) : (
        <XCircle className="size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
