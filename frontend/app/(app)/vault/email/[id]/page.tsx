"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Wifi } from "lucide-react";
import { vaultService, type EmailVaultItem } from "@/services/vault";
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

export default function EditEmailVaultPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [item, setItem] = useState<EmailVaultItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    host: "",
    port: 587,
    user: "",
    password: "",
    fromAddr: "",
    fromName: "",
    secure: false,
  });

  useEffect(() => {
    vaultService.getEmail(id).then((data) => {
      setItem(data);
      setForm({
        name: data.name,
        host: data.host,
        port: data.port,
        user: data.user,
        password: "",
        fromAddr: data.fromAddr,
        fromName: data.fromName,
        secure: data.secure,
      });
    });
  }, [id]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      await vaultService.updateEmail(id, payload);
      toast.success(t("vault.updateSuccess"));
      router.push("/vault/email");
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await vaultService.testEmail(id);
      toast.success(t("vault.testSuccess"));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    }
    try {
      const updated = await vaultService.getEmail(id);
      setItem(updated);
    } catch { /* ignore */ }
    setTesting(false);
  };

  if (!item) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("vault.editEmailTitle")}</h1>
          <p className="text-muted-foreground">{t("vault.editEmailSubtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void handleTest()} disabled={testing}>
          <Wifi className="size-4" />
          {testing ? t("common.loading") : t("vault.testSmtp")}
        </Button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("vault.general")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">{t("vault.name")}</FieldLabel>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("vault.smtpServer")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Field>
                    <FieldLabel htmlFor="host">{t("vault.host")}</FieldLabel>
                    <Input
                      id="host"
                      value={form.host}
                      onChange={(e) => set("host", e.target.value)}
                      required
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="port">{t("vault.port")}</FieldLabel>
                  <Input
                    id="port"
                    type="number"
                    min={1}
                    max={65535}
                    value={form.port}
                    onChange={(e) => set("port", +e.target.value)}
                    required
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="user">{t("vault.user")}</FieldLabel>
                <Input
                  id="user"
                  value={form.user}
                  onChange={(e) => set("user", e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{t("vault.password")}</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="secure">{t("vault.secure")}</FieldLabel>
                <Select
                  value={form.secure ? "tls" : "starttls"}
                  onValueChange={(v) => set("secure", v === "tls")}
                >
                  <SelectTrigger id="secure">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starttls">{t("vault.secureStarttls")}</SelectItem>
                    <SelectItem value="tls">{t("vault.secureTls")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("vault.sender")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="fromAddr">{t("vault.fromAddr")}</FieldLabel>
                <Input
                  id="fromAddr"
                  type="email"
                  value={form.fromAddr}
                  onChange={(e) => set("fromAddr", e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="fromName">{t("vault.fromName")}</FieldLabel>
                <Input
                  id="fromName"
                  value={form.fromName}
                  onChange={(e) => set("fromName", e.target.value)}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
