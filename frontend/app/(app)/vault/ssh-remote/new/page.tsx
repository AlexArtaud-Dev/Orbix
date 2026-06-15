"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { vaultService, type SshVaultSubtype } from "@/services/vault";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FormState {
  name: string;
  subtype: SshVaultSubtype;
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

export default function NewSshVaultPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: "",
    subtype: "user_password",
    host: "",
    port: "22",
    username: "",
    defaultPath: "/",
    password: "",
    privateKey: "",
    passphrase: "",
    sudoPassword: "",
    useSudo: false,
  });

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await vaultService.createSsh({
        name: form.name,
        subtype: form.subtype,
        host: form.host,
        port: parseInt(form.port, 10) || 22,
        username: form.username,
        defaultPath: form.defaultPath,
        useSudo: form.useSudo,
        ...(form.subtype === "user_password" ? { password: form.password } : {}),
        ...(form.subtype === "ssh_key" ? {
          privateKey: form.privateKey,
          passphrase: form.passphrase || undefined,
          ...(form.useSudo && form.sudoPassword ? { sudoPassword: form.sudoPassword } : {}),
        } : {}),
      });
      toast.success(t("vault.ssh.createSuccess"));
      router.push("/vault/ssh-remote");
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = form.name && form.host && form.username && form.defaultPath &&
    (form.subtype === "user_password" ? !!form.password : !!form.privateKey);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("vault.ssh.newTitle")}</h1>
        <p className="text-muted-foreground">{t("vault.ssh.newSubtitle")}</p>
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
          <Label htmlFor="ssh-name">{t("vault.ssh.name")}</Label>
          <Input id="ssh-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("vault.ssh.namePlaceholder")} />
        </div>

        <div className="space-y-1.5">
          <Label>{t("vault.ssh.subtype")}</Label>
          <Select value={form.subtype} onValueChange={(v) => set("subtype", v as SshVaultSubtype)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user_password">{t("vault.ssh.subtypes.user_password")}</SelectItem>
              <SelectItem value="ssh_key">{t("vault.ssh.subtypes.ssh_key")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-[1fr_100px] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ssh-host">{t("vault.ssh.host")}</Label>
            <Input id="ssh-host" value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="192.168.1.100" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ssh-port">{t("vault.ssh.port")}</Label>
            <Input id="ssh-port" type="number" value={form.port} onChange={(e) => set("port", e.target.value)} min={1} max={65535} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ssh-username">{t("vault.ssh.username")}</Label>
          <Input id="ssh-username" value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="root" autoComplete="username" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ssh-path">{t("vault.ssh.defaultPath")}</Label>
          <Input id="ssh-path" value={form.defaultPath} onChange={(e) => set("defaultPath", e.target.value)} placeholder="/backups/orbix" />
        </div>

        {form.subtype === "user_password" && (
          <div className="space-y-1.5">
            <Label htmlFor="ssh-password">{t("vault.ssh.password")}</Label>
            <Input id="ssh-password" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
          </div>
        )}

        {form.subtype === "ssh_key" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ssh-privatekey">{t("vault.ssh.privateKey")}</Label>
              <Textarea id="ssh-privatekey" value={form.privateKey} onChange={(e) => set("privateKey", e.target.value)} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" rows={6} className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ssh-passphrase">{t("vault.ssh.passphrase")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span></Label>
              <Input id="ssh-passphrase" type="password" value={form.passphrase} onChange={(e) => set("passphrase", e.target.value)} autoComplete="new-password" />
            </div>
            {form.useSudo && (
              <div className="space-y-1.5">
                <Label htmlFor="ssh-sudopwd">{t("vault.ssh.sudoPassword")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span></Label>
                <Input id="ssh-sudopwd" type="password" value={form.sudoPassword} onChange={(e) => set("sudoPassword", e.target.value)} placeholder={t("vault.ssh.sudoPasswordHint")} autoComplete="new-password" />
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <div className="space-y-0.5">
            <Label htmlFor="ssh-sudo" className="text-sm font-medium">{t("vault.ssh.useSudo")}</Label>
            <p className="text-xs text-muted-foreground">{t("vault.ssh.useSudoHint")}</p>
          </div>
          <Switch id="ssh-sudo" checked={form.useSudo} onCheckedChange={(v) => setForm((f) => ({ ...f, useSudo: v }))} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving || !canSubmit}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>{t("common.cancel")}</Button>
        </div>
      </form>
    </div>
  );
}
