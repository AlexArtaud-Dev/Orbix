"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { vaultService } from "@/services/vault";
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

export default function NewEmailVaultPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
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

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await vaultService.createEmail(form);
      toast.success(t("vault.createSuccess"));
      router.push("/vault/email");
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("vault.newEmailTitle")}</h1>
        <p className="text-muted-foreground">{t("vault.newEmailSubtitle")}</p>
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
                  placeholder="My SMTP account"
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
                      placeholder="smtp.example.com"
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
                  required
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
                  placeholder="no-reply@example.com"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="fromName">{t("vault.fromName")}</FieldLabel>
                <Input
                  id="fromName"
                  value={form.fromName}
                  onChange={(e) => set("fromName", e.target.value)}
                  placeholder="Orbix"
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
