"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { vaultService, type SshVaultItem } from "@/services/vault";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface FormState {
  name: string;
  host: string;
  port: string;
  username: string;
  defaultPath: string;
  password: string;
  privateKey: string;
  passphrase: string;
  sudoPassword: string;
  useSudo: boolean;
}

export default function EditSshVaultPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<SshVaultItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({ name: "", host: "", port: "22", username: "", defaultPath: "/", password: "", privateKey: "", passphrase: "", sudoPassword: "", useSudo: false });

  useEffect(() => {
    vaultService.getSsh(id).then((data) => {
      setItem(data);
      setForm({ name: data.name, host: data.host, port: String(data.port), username: data.username, defaultPath: data.defaultPath, password: "", privateKey: "", passphrase: "", sudoPassword: "", useSudo: data.useSudo });
    });
  }, [id]);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await vaultService.updateSsh(id, {
        name: form.name || undefined,
        host: form.host || undefined,
        port: form.port ? parseInt(form.port, 10) : undefined,
        username: form.username || undefined,
        defaultPath: form.defaultPath || undefined,
        password: form.password || undefined,
        privateKey: form.privateKey || undefined,
        passphrase: form.passphrase || undefined,
        sudoPassword: item?.subtype === "ssh_key" && form.useSudo && form.sudoPassword ? form.sudoPassword : undefined,
        useSudo: form.useSudo,
      });
      toast.success(t("vault.ssh.updateSuccess"));
      router.push("/vault/ssh-remote");
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (!item) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("vault.ssh.editTitle")}</h1>
        <p className="text-muted-foreground">{t("vault.ssh.editSubtitle")}</p>
      </div>

      <div className="flex gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
        <Info className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">{t("vault.ssh.prerequisitesTitle")}</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs opacity-90">
            <li>{t("vault.ssh.prerequisitesPassword")}</li>
            <li>{t("vault.ssh.prerequisitesKey")}</li>
            <li>{t("vault.ssh.prerequisitesPath")}</li>
          </ul>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sshe-name">{t("vault.ssh.name")}</Label>
          <Input id="sshe-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>

        <div className="grid grid-cols-[1fr_100px] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sshe-host">{t("vault.ssh.host")}</Label>
            <Input id="sshe-host" value={form.host} onChange={(e) => set("host", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sshe-port">{t("vault.ssh.port")}</Label>
            <Input id="sshe-port" type="number" value={form.port} onChange={(e) => set("port", e.target.value)} min={1} max={65535} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sshe-username">{t("vault.ssh.username")}</Label>
          <Input id="sshe-username" value={form.username} onChange={(e) => set("username", e.target.value)} autoComplete="username" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sshe-path">{t("vault.ssh.defaultPath")}</Label>
          <Input id="sshe-path" value={form.defaultPath} onChange={(e) => set("defaultPath", e.target.value)} />
        </div>

        {item.subtype === "user_password" && (
          <div className="space-y-1.5">
            <Label htmlFor="sshe-password">
              {t("vault.ssh.password")}
              <span className="ml-1.5 text-xs text-muted-foreground">{t("vault.ssh.leaveBlank")}</span>
            </Label>
            <Input id="sshe-password" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={t("vault.ssh.unchanged")} autoComplete="new-password" />
          </div>
        )}

        {item.subtype === "ssh_key" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="sshe-privatekey">
                {t("vault.ssh.privateKey")}
                <span className="ml-1.5 text-xs text-muted-foreground">{t("vault.ssh.leaveBlank")}</span>
              </Label>
              <Textarea id="sshe-privatekey" value={form.privateKey} onChange={(e) => set("privateKey", e.target.value)} placeholder={t("vault.ssh.unchanged")} rows={6} className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sshe-passphrase">
                {t("vault.ssh.passphrase")}
                <span className="ml-1.5 text-xs text-muted-foreground">{t("vault.ssh.leaveBlank")}</span>
              </Label>
              <Input id="sshe-passphrase" type="password" value={form.passphrase} onChange={(e) => set("passphrase", e.target.value)} placeholder={t("vault.ssh.unchanged")} autoComplete="new-password" />
            </div>
            {form.useSudo && (
              <div className="space-y-1.5">
                <Label htmlFor="sshe-sudopwd">
                  {t("vault.ssh.sudoPassword")}
                  <span className="ml-1.5 text-xs text-muted-foreground">{t("vault.ssh.leaveBlank")}</span>
                </Label>
                <Input id="sshe-sudopwd" type="password" value={form.sudoPassword} onChange={(e) => set("sudoPassword", e.target.value)} placeholder={t("vault.ssh.sudoPasswordHint")} autoComplete="new-password" />
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <div className="space-y-0.5">
            <Label htmlFor="sshe-sudo" className="text-sm font-medium">{t("vault.ssh.useSudo")}</Label>
            <p className="text-xs text-muted-foreground">{t("vault.ssh.useSudoHint")}</p>
          </div>
          <Switch id="sshe-sudo" checked={form.useSudo} onCheckedChange={(v) => setForm((f) => ({ ...f, useSudo: v }))} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>{t("common.cancel")}</Button>
        </div>
      </form>
    </div>
  );
}
