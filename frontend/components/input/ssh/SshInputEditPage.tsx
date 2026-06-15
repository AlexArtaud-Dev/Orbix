"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { inputService } from "@/services/input";
import { vaultService, type SshVaultItem } from "@/services/vault";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { SshFileBrowser, type SshSource } from "./SshFileBrowser";
import { SshSourcesList } from "./SshSourcesList";
import type { SshInputConfig } from "./ssh-input.client-types";

export function SshInputEditPage({ type, id }: { type: string; id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vaults, setVaults] = useState<SshVaultItem[]>([]);
  const [form, setForm] = useState({ name: "", vaultId: "", enabled: true });
  const [sources, setSources] = useState<SshSource[]>([]);

  useEffect(() => {
    void Promise.all([inputService.getOne(id), vaultService.listSsh()]).then(([item, vaultList]) => {
      const cfg = item.config as unknown as SshInputConfig;
      setForm({ name: item.name, vaultId: item.vaultId ?? "", enabled: item.enabled });
      setSources((cfg.sources ?? []) as SshSource[]);
      setVaults(vaultList ?? []);
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await inputService.update(id, { name: form.name || undefined, vaultId: form.vaultId || null, config: { sources }, enabled: form.enabled });
      toast.success(t("input.ssh.updateSuccess"));
      router.push(`/input/${type}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="h-full flex min-h-0">
      {/* ── Left: form ── */}
      <div className="flex flex-col flex-[3] min-w-0 min-h-0 gap-6 pr-6">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold tracking-tight">{t("input.ssh.editTitle")}</h1>
          <p className="text-muted-foreground">{t("input.ssh.editSubtitle")}</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col flex-1 min-h-0 gap-4">
          <div className="shrink-0 space-y-1.5">
            <Label htmlFor="ssh-in-e-name">{t("input.ssh.name")}</Label>
            <Input
              id="ssh-in-e-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="shrink-0 space-y-1.5">
            <Label>{t("input.ssh.vault")}</Label>
            <Select
              value={form.vaultId}
              onValueChange={(v) => setForm((f) => ({ ...f, vaultId: v }))}
              disabled={sources.length > 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("input.ssh.vaultPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {vaults.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} — {v.username}@{v.host}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sources.length > 0 && (
              <p className="text-xs text-muted-foreground">{t("input.ssh.vaultLockedHint")}</p>
            )}
          </div>

          <div className="flex flex-col flex-1 min-h-0 gap-1.5">
            <Label>{t("input.ssh.fileBrowser")}</Label>
            <div className="flex-1 min-h-0">
              <SshFileBrowser vaultId={form.vaultId} sources={sources} onChange={setSources} />
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-between rounded-lg border px-3 py-2.5">
            <Label htmlFor="ssh-in-e-enabled" className="text-sm font-medium cursor-pointer">
              {t("backups.enabled")}
            </Label>
            <Switch
              id="ssh-in-e-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
          </div>

          <div className="shrink-0 flex gap-3">
            <Button type="submit" disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>{t("common.cancel")}</Button>
          </div>
        </form>
      </div>

      <Separator orientation="vertical" />

      {/* ── Right: selected sources ── */}
      <div className="flex flex-col flex-[2] min-w-0 min-h-0 pl-6">
        <SshSourcesList vaultId={form.vaultId} sources={sources} onChange={setSources} />
      </div>
    </div>
  );
}
