"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FlaskConical, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  sshOutputService,
  type SshOutputConfigItem,
} from "@/services/ssh-output";
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

export function SshOutputEditPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<SshOutputConfigItem | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    steps: Record<string, string>;
  } | null>(null);
  const [vaults, setVaults] = useState<SshVaultItem[]>([]);
  const [form, setForm] = useState({ name: "", vaultId: "", destPath: "" });

  useEffect(() => {
    void Promise.all([
      sshOutputService.getOne(id),
      vaultService.listSsh(),
    ]).then(([cfg, vaultList]) => {
      setItem(cfg);
      setForm({ name: cfg.name, vaultId: cfg.vaultId, destPath: cfg.destPath });
      setVaults(vaultList ?? []);
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const configChanged =
      form.vaultId !== item?.vaultId || form.destPath !== item?.destPath;
    try {
      const updated = await sshOutputService.update(id, {
        name: form.name || undefined,
        vaultId: form.vaultId !== item?.vaultId ? form.vaultId : undefined,
        destPath: form.destPath !== item?.destPath ? form.destPath : undefined,
      });
      setItem(updated);
      if (configChanged) setTestResult(null);
      toast.success(t("output.ssh.updateSuccess"));
      router.push("/output/ssh");
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
    setTesting(true);
    setTestResult(null);
    try {
      const result = await sshOutputService.test(id);
      setTestResult(result);
      setItem(await sshOutputService.getOne(id));
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

  if (loading)
    return (
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    );

  const selectedVault = vaults.find((v) => v.id === form.vaultId);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("output.ssh.editTitle")}
        </h1>
        <p className="text-muted-foreground">{t("output.ssh.editSubtitle")}</p>
      </div>

      {/* Test status block — always visible under the title */}
      {item && (
        <div className="rounded-lg border px-3 py-2.5 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {item.lastTestStatus === "ok" && (
              <>
                <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                <span className="text-green-600 font-medium">{t("output.ssh.testOk")}</span>
              </>
            )}
            {item.lastTestStatus === "error" && (
              <>
                <XCircle className="size-4 shrink-0 text-destructive" />
                <span className="text-destructive font-medium">
                  {item.lastTestError ?? t("output.ssh.testFailed")}
                </span>
              </>
            )}
            {!item.lastTestStatus && (
              <>
                <FlaskConical className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{t("output.ssh.notTested")}</span>
              </>
            )}
          </div>
          {testResult && (
            <div className="space-y-1 border-t pt-2">
              {Object.entries(testResult.steps).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
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
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ssh-out-e-name">{t("output.ssh.name")}</Label>
          <Input
            id="ssh-out-e-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("output.ssh.vault")}</Label>
          <Select
            value={form.vaultId}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, vaultId: v, destPath: "" }))
            }
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
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
