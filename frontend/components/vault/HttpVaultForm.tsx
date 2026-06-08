"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { HttpVaultSubtype } from "@/services/vault";

export const HTTP_SUBTYPES: HttpVaultSubtype[] = [
  "token",
  "username_password",
  "key_secret",
  "oauth2_client_credentials",
  "oauth2_password_grant",
  "mtls_certificate",
  "ssh_key",
  "jwt_signing_key",
  "aws_sigv4",
  "cookie",
  "custom_kv",
];

export interface KvEntry {
  key: string;
  value: string;
}

export interface HttpVaultFormData {
  name: string;
  subtype: HttpVaultSubtype | "";
  // per-subtype fields
  token?: string;
  username?: string;
  password?: string;
  key?: string;
  secret?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  scope?: string;
  privateKey?: string;
  cert?: string;
  passphrase?: string;
  algorithm?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  service?: string;
  cookieValue?: string;
  entries?: KvEntry[];
}

export function defaultHttpVaultForm(): HttpVaultFormData {
  return { name: "", subtype: "", entries: [] };
}

export function formToData(form: HttpVaultFormData): Record<string, unknown> {
  switch (form.subtype) {
    case "token":
      return { token: form.token };
    case "username_password":
      return { username: form.username, password: form.password };
    case "key_secret":
      return { key: form.key, secret: form.secret };
    case "oauth2_client_credentials":
      return {
        clientId: form.clientId,
        clientSecret: form.clientSecret,
        tokenUrl: form.tokenUrl,
        scope: form.scope || undefined,
      };
    case "oauth2_password_grant":
      return {
        username: form.username,
        password: form.password,
        clientId: form.clientId,
        tokenUrl: form.tokenUrl,
      };
    case "mtls_certificate":
      return { cert: form.cert, key: form.key, passphrase: form.passphrase || undefined };
    case "ssh_key":
      return { privateKey: form.privateKey, passphrase: form.passphrase || undefined };
    case "jwt_signing_key":
      return {
        privateKey: form.privateKey,
        algorithm: form.algorithm,
        issuer: form.issuer || undefined,
        audience: form.audience || undefined,
        expiresIn: form.expiresIn || undefined,
      };
    case "aws_sigv4":
      return {
        accessKeyId: form.accessKeyId,
        secretAccessKey: form.secretAccessKey,
        region: form.region,
        service: form.service,
      };
    case "cookie":
      return { value: form.cookieValue };
    case "custom_kv":
      return { entries: form.entries ?? [] };
    default:
      return {};
  }
}

interface HttpVaultFormProps {
  form: HttpVaultFormData;
  onChange: <K extends keyof HttpVaultFormData>(key: K, value: HttpVaultFormData[K]) => void;
  subtypeLocked?: boolean;
  isEdit?: boolean;
}

export function HttpVaultForm({ form, onChange, subtypeLocked, isEdit }: HttpVaultFormProps) {
  const { t } = useTranslation();

  const set = <K extends keyof HttpVaultFormData>(k: K, v: HttpVaultFormData[K]) => onChange(k, v);

  return (
    <div className="space-y-4">
      {/* General */}
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
                placeholder="My HTTP credential"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="subtype">{t("vault.http.subtype")}</FieldLabel>
              {subtypeLocked && form.subtype ? (
                <div className="space-y-1">
                  <Input
                    id="subtype"
                    value={t(`vault.http.subtypes.${form.subtype}`)}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">{t("vault.http.subtypeLocked")}</p>
                </div>
              ) : (
                <Select
                  value={form.subtype}
                  onValueChange={(v) => set("subtype", v as HttpVaultSubtype)}
                >
                  <SelectTrigger id="subtype">
                    <SelectValue placeholder={t("vault.http.subtypePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {HTTP_SUBTYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`vault.http.subtypes.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Subtype-specific fields */}
      {form.subtype && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t(`vault.http.subtypes.${form.subtype}`)}</CardTitle>
          </CardHeader>
          <CardContent>
            <SubtypeFields form={form} set={set} isEdit={isEdit} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface SubtypeFieldsProps {
  form: HttpVaultFormData;
  set: <K extends keyof HttpVaultFormData>(k: K, v: HttpVaultFormData[K]) => void;
  isEdit?: boolean;
}

function SubtypeFields({ form, set, isEdit }: SubtypeFieldsProps) {
  const { t } = useTranslation();
  const f = t;
  const ph = isEdit ? "••••••••" : undefined;

  switch (form.subtype) {
    case "token":
      return (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="token">{f("vault.http.fields.token")}</FieldLabel>
            <Input
              id="token"
              type="password"
              value={form.token ?? ""}
              onChange={(e) => set("token", e.target.value)}
              placeholder={ph}
              required={!isEdit}
            />
          </Field>
        </FieldGroup>
      );

    case "username_password":
      return (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="username">{f("vault.http.fields.username")}</FieldLabel>
            <Input
              id="username"
              value={form.username ?? ""}
              onChange={(e) => set("username", e.target.value)}
              placeholder={ph}
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{f("vault.http.fields.password")}</FieldLabel>
            <Input
              id="password"
              type="password"
              value={form.password ?? ""}
              onChange={(e) => set("password", e.target.value)}
              placeholder={ph}
              required={!isEdit}
            />
          </Field>
        </FieldGroup>
      );

    case "key_secret":
      return (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="key">{f("vault.http.fields.key")}</FieldLabel>
            <Input
              id="key"
              value={form.key ?? ""}
              onChange={(e) => set("key", e.target.value)}
              placeholder={ph ?? "X-Api-Key"}
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="secret">{f("vault.http.fields.secret")}</FieldLabel>
            <Input
              id="secret"
              type="password"
              value={form.secret ?? ""}
              onChange={(e) => set("secret", e.target.value)}
              placeholder={ph}
              required={!isEdit}
            />
          </Field>
        </FieldGroup>
      );

    case "oauth2_client_credentials":
      return (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="clientId">{f("vault.http.fields.clientId")}</FieldLabel>
            <Input
              id="clientId"
              value={form.clientId ?? ""}
              onChange={(e) => set("clientId", e.target.value)}
              placeholder={ph}
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="clientSecret">{f("vault.http.fields.clientSecret")}</FieldLabel>
            <Input
              id="clientSecret"
              type="password"
              value={form.clientSecret ?? ""}
              onChange={(e) => set("clientSecret", e.target.value)}
              placeholder={ph}
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="tokenUrl">{f("vault.http.fields.tokenUrl")}</FieldLabel>
            <Input
              id="tokenUrl"
              type="url"
              value={form.tokenUrl ?? ""}
              onChange={(e) => set("tokenUrl", e.target.value)}
              placeholder="https://auth.example.com/oauth/token"
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="scope">{f("vault.http.fields.scopeOptional")}</FieldLabel>
            <Input
              id="scope"
              value={form.scope ?? ""}
              onChange={(e) => set("scope", e.target.value)}
              placeholder="read write"
            />
          </Field>
        </FieldGroup>
      );

    case "oauth2_password_grant":
      return (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="username">{f("vault.http.fields.username")}</FieldLabel>
            <Input
              id="username"
              value={form.username ?? ""}
              onChange={(e) => set("username", e.target.value)}
              placeholder={ph}
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{f("vault.http.fields.password")}</FieldLabel>
            <Input
              id="password"
              type="password"
              value={form.password ?? ""}
              onChange={(e) => set("password", e.target.value)}
              placeholder={ph}
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="clientId">{f("vault.http.fields.clientId")}</FieldLabel>
            <Input
              id="clientId"
              value={form.clientId ?? ""}
              onChange={(e) => set("clientId", e.target.value)}
              placeholder={ph}
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="tokenUrl">{f("vault.http.fields.tokenUrl")}</FieldLabel>
            <Input
              id="tokenUrl"
              type="url"
              value={form.tokenUrl ?? ""}
              onChange={(e) => set("tokenUrl", e.target.value)}
              placeholder="https://auth.example.com/oauth/token"
              required={!isEdit}
            />
          </Field>
        </FieldGroup>
      );

    case "mtls_certificate":
      return (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="cert">{f("vault.http.fields.cert")}</FieldLabel>
            <Textarea
              id="cert"
              value={form.cert ?? ""}
              onChange={(e) => set("cert", e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----"
              rows={5}
              className="font-mono text-xs"
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="key">{f("vault.http.fields.privateKey")}</FieldLabel>
            <Textarea
              id="key"
              value={form.key ?? ""}
              onChange={(e) => set("key", e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----"
              rows={5}
              className="font-mono text-xs"
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="passphrase">{f("vault.http.fields.passphrase")}</FieldLabel>
            <Input
              id="passphrase"
              type="password"
              value={form.passphrase ?? ""}
              onChange={(e) => set("passphrase", e.target.value)}
            />
          </Field>
        </FieldGroup>
      );

    case "ssh_key":
      return (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="privateKey">{f("vault.http.fields.privateKey")}</FieldLabel>
            <Textarea
              id="privateKey"
              value={form.privateKey ?? ""}
              onChange={(e) => set("privateKey", e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              rows={7}
              className="font-mono text-xs"
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="passphrase">{f("vault.http.fields.passphrase")}</FieldLabel>
            <Input
              id="passphrase"
              type="password"
              value={form.passphrase ?? ""}
              onChange={(e) => set("passphrase", e.target.value)}
            />
          </Field>
        </FieldGroup>
      );

    case "jwt_signing_key":
      return (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="privateKey">{f("vault.http.fields.privateKey")}</FieldLabel>
            <Textarea
              id="privateKey"
              value={form.privateKey ?? ""}
              onChange={(e) => set("privateKey", e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----"
              rows={5}
              className="font-mono text-xs"
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="algorithm">{f("vault.http.fields.algorithm")}</FieldLabel>
            <Select
              value={form.algorithm ?? ""}
              onValueChange={(v) => set("algorithm", v)}
            >
              <SelectTrigger id="algorithm">
                <SelectValue placeholder="RS256" />
              </SelectTrigger>
              <SelectContent>
                {["RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "HS256", "HS384", "HS512"].map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="issuer">{f("vault.http.fields.issuer")}</FieldLabel>
            <Input id="issuer" value={form.issuer ?? ""} onChange={(e) => set("issuer", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="audience">{f("vault.http.fields.audience")}</FieldLabel>
            <Input id="audience" value={form.audience ?? ""} onChange={(e) => set("audience", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="expiresIn">{f("vault.http.fields.expiresIn")}</FieldLabel>
            <Input id="expiresIn" value={form.expiresIn ?? ""} onChange={(e) => set("expiresIn", e.target.value)} placeholder="3600" />
          </Field>
        </FieldGroup>
      );

    case "aws_sigv4":
      return (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="accessKeyId">{f("vault.http.fields.accessKeyId")}</FieldLabel>
            <Input
              id="accessKeyId"
              value={form.accessKeyId ?? ""}
              onChange={(e) => set("accessKeyId", e.target.value)}
              placeholder={ph ?? "AKIAIOSFODNN7EXAMPLE"}
              required={!isEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="secretAccessKey">{f("vault.http.fields.secretAccessKey")}</FieldLabel>
            <Input
              id="secretAccessKey"
              type="password"
              value={form.secretAccessKey ?? ""}
              onChange={(e) => set("secretAccessKey", e.target.value)}
              placeholder={ph}
              required={!isEdit}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="region">{f("vault.http.fields.region")}</FieldLabel>
              <Input
                id="region"
                value={form.region ?? ""}
                onChange={(e) => set("region", e.target.value)}
                placeholder="eu-west-1"
                required={!isEdit}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="service">{f("vault.http.fields.service")}</FieldLabel>
              <Input
                id="service"
                value={form.service ?? ""}
                onChange={(e) => set("service", e.target.value)}
                placeholder="execute-api"
                required={!isEdit}
              />
            </Field>
          </div>
        </FieldGroup>
      );

    case "cookie":
      return (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="cookieValue">{f("vault.http.fields.cookieValue")}</FieldLabel>
            <Textarea
              id="cookieValue"
              value={form.cookieValue ?? ""}
              onChange={(e) => set("cookieValue", e.target.value)}
              placeholder="session=abc123; csrftoken=xyz"
              rows={3}
              className="font-mono text-xs"
              required={!isEdit}
            />
          </Field>
        </FieldGroup>
      );

    case "custom_kv":
      return <KvEntriesField entries={form.entries ?? []} onChange={(v) => set("entries", v)} />;

    default:
      return null;
  }
}

interface KvEntriesFieldProps {
  entries: KvEntry[];
  onChange: (entries: KvEntry[]) => void;
}

function KvEntriesField({ entries, onChange }: KvEntriesFieldProps) {
  const { t } = useTranslation();
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  const add = () => {
    if (!newKey.trim()) return;
    onChange([...entries, { key: newKey.trim(), value: newVal }]);
    setNewKey("");
    setNewVal("");
  };

  const remove = (idx: number) => onChange(entries.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
              <span className="flex-1 min-w-0 font-mono text-xs truncate">
                <span className="text-foreground">{e.key}</span>
                <span className="text-muted-foreground mx-1">:</span>
                <span className="text-muted-foreground">{e.value}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(idx)}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder={t("vault.http.fields.entryKey")}
          className="font-mono text-xs"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Input
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          placeholder={t("vault.http.fields.entryValue")}
          className="font-mono text-xs"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!newKey.trim()}>
          <Plus className="size-3.5" />
          {t("vault.http.fields.addEntry")}
        </Button>
      </div>
    </div>
  );
}
