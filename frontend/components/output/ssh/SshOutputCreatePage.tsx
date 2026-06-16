"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FlaskConical, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { sshOutputService } from "@/services/ssh-output";
import { vaultService, type SshVaultItem } from "@/services/vault";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SshFolderPickerDialog } from "@/components/ssh/SshFolderPickerDialog";

export function SshOutputCreatePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    steps: Record<string, string>;
  } | null>(null);
  const [vaults, setVaults] = useState<SshVaultItem[]>([]);
  const [form, setForm] = useState({ name: "", vaultId: "", destPath: "" });

  useEffect(() => {
    vaultService.listSsh().then((items) => setVaults(items ?? []));
  }, []);

  const canSubmit = form.name && form.vaultId && form.destPath;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const created = await sshOutputService.create({
        name: form.name,
        vaultId: form.vaultId,
        destPath: form.destPath,
      });
      setSavedId(created.id);
      toast.success(t("output.ssh.createSuccess"));
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? t(`errors.${err.code}`, err.message)
          : t("common.error"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!savedId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await sshOutputService.test(savedId);
      setTestResult(result);
      if (result.ok) toast.success(t("output.ssh.testOk"));
      else toast.error(t("output.ssh.testFailed"));
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? t(`errors.${err.code}`, err.message)
          : t("common.error"),
      );
    } finally {
      setTesting(false);
    }
  };

  const selectedVault = vaults.find((v) => v.id === form.vaultId);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("output.ssh.newTitle")}
        </h1>
        <p className="text-muted-foreground">{t("output.ssh.newSubtitle")}</p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="ssh-out-name">{t("output.ssh.name")}</Label>
          <Input
            id="ssh-out-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t("output.ssh.namePlaceholder")}
            disabled={!!savedId}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("output.ssh.vault")}</Label>
          <Select
            value={form.vaultId}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, vaultId: v, destPath: "" }))
            }
            disabled={!!savedId}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("output.ssh.vaultPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {vaults.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} — {v.username}@{v.host}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t("output.ssh.destPath")}</Label>
          <SshFolderPickerDialog
            vaultId={form.vaultId}
            value={form.destPath}
            defaultPath={selectedVault?.defaultPath}
            onSelect={(path) => setForm((f) => ({ ...f, destPath: path }))}
            disabled={!!savedId}
          />
        </div>

        {!savedId && (
          <div className="flex gap-3">
            <Button type="submit" disabled={saving || !canSubmit}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              {t("common.cancel")}
            </Button>
          </div>
        )}
      </form>

      {savedId && (
        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-sm font-medium">{t("output.ssh.testPrompt")}</p>

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleTest()}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FlaskConical className="size-4" />
            )}
            {t("output.ssh.test")}
          </Button>

          {testResult && (
            <div className="space-y-1">
              {Object.entries(testResult.steps).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  {value === "ok" ? (
                    <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
                  ) : value === "pending" ? (
                    <span className="size-3.5 shrink-0" />
                  ) : (
                    <XCircle className="size-3.5 text-destructive shrink-0" />
                  )}
                  <span className="capitalize text-muted-foreground">
                    {t(`vault.sshRemote.steps.${key}`, key)}
                  </span>
                  {value !== "ok" && value !== "pending" && (
                    <span className="text-destructive text-xs truncate">
                      {value.replace(/^error:\s*/, "")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={() => router.push("/output/ssh")}>
              {t("common.back")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
