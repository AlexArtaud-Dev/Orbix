"use client";
import { useState, useRef, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, ChevronDown, Lock, Braces } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import type { HttpVaultItem, VarSetItem } from "@/services/vault";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HttpBodyType =
  | "none"
  | "raw"
  | "json"
  | "form-data"
  | "x-www-form-urlencoded"
  | "graphql";

export interface HttpHeaderField {
  key: string;
  valueType: "literal" | "vault_var";
  value: string;
  /** "vaultId.fieldKey" */
  vaultVarRef: string;
}

export interface FormBodyField {
  key: string;
  valueType: "literal" | "vault_var";
  value: string;
  vaultVarRef: string;
}

export interface HttpBodyConfig {
  type: HttpBodyType;
  raw: string;
  json: string;
  formData: FormBodyField[];
  urlEncoded: FormBodyField[];
  graphqlVariables: string;
}

export interface HttpRestInputFormData {
  name: string;
  baseUrl: string;
  method: HttpMethod;
  listEndpoint: string;
  downloadEndpoint: string;
  responseMappingId: string;
  responseMappingName: string;
  vaultId: string;
  enabled: boolean;
  insecureSkipVerify: boolean;
  headers: HttpHeaderField[];
  body: HttpBodyConfig;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export function defaultHttpRestInputForm(): HttpRestInputFormData {
  return {
    name: "",
    baseUrl: "",
    method: "GET",
    listEndpoint: "",
    downloadEndpoint: "",
    responseMappingId: "id",
    responseMappingName: "name",
    vaultId: "",
    enabled: true,
    insecureSkipVerify: false,
    headers: [],
    body: {
      type: "none",
      raw: "",
      json: "{\n  \n}",
      formData: [],
      urlEncoded: [],
      graphqlVariables: "",
    },
  };
}

// ─── Payload / Form conversion ────────────────────────────────────────────────

export function formToPayload(form: HttpRestInputFormData) {
  const config: Record<string, unknown> = {
    baseUrl: form.baseUrl,
    ...(form.method !== "GET" ? { method: form.method } : {}),
    ...(form.insecureSkipVerify ? { insecureSkipVerify: true } : {}),
    ...(form.listEndpoint ? { listEndpoint: form.listEndpoint } : {}),
    ...(form.downloadEndpoint
      ? { downloadEndpoint: form.downloadEndpoint }
      : {}),
    ...((form.responseMappingId !== "id" ||
      form.responseMappingName !== "name") &&
    form.listEndpoint
      ? {
          responseMapping: {
            id: form.responseMappingId || "id",
            name: form.responseMappingName || "name",
          },
        }
      : {}),
    ...(form.headers.length > 0
      ? {
          headers: form.headers.map((h) => ({
            key: h.key,
            valueType: h.valueType,
            ...(h.valueType === "literal" ? { value: h.value } : {}),
            ...(h.valueType === "vault_var" ? { vaultVarRef: h.vaultVarRef } : {}),
          })),
        }
      : {}),
    ...(form.body.type !== "none"
      ? {
          body: {
            type: form.body.type,
            ...(form.body.type === "raw" ? { raw: form.body.raw } : {}),
            ...(form.body.type === "json" ? { json: form.body.json } : {}),
            ...(form.body.type === "graphql"
              ? {
                  raw: form.body.raw,
                  ...(form.body.graphqlVariables
                    ? { graphqlVariables: form.body.graphqlVariables }
                    : {}),
                }
              : {}),
            ...(form.body.type === "form-data"
              ? { formData: form.body.formData }
              : {}),
            ...(form.body.type === "x-www-form-urlencoded"
              ? { urlEncoded: form.body.urlEncoded }
              : {}),
          },
        }
      : {}),
  };

  return {
    name: form.name,
    type: "http-rest" as const,
    vaultId: form.vaultId || null,
    config,
    requestParams: [],
    enabled: form.enabled,
  };
}

/** PATCH payload — same as formToPayload but without `type` (forbidNonWhitelisted) */
export function formToUpdatePayload(form: HttpRestInputFormData) {
  const { type: _type, ...rest } = formToPayload(form);
  void _type;
  return rest;
}

export function itemToForm(item: {
  name: string;
  vaultId: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
}): HttpRestInputFormData {
  const cfg = item.config as {
    baseUrl?: string;
    method?: HttpMethod;
    listEndpoint?: string;
    downloadEndpoint?: string;
    responseMapping?: { id?: string; name?: string };
    headers?: HttpHeaderField[];
    body?: Partial<HttpBodyConfig>;
    insecureSkipVerify?: boolean;
  };
  return {
    name: item.name,
    baseUrl: cfg.baseUrl ?? "",
    method: cfg.method ?? "GET",
    listEndpoint: cfg.listEndpoint ?? "",
    downloadEndpoint: cfg.downloadEndpoint ?? "",
    responseMappingId: cfg.responseMapping?.id ?? "id",
    responseMappingName: cfg.responseMapping?.name ?? "name",
    vaultId: item.vaultId ?? "",
    enabled: item.enabled,
    insecureSkipVerify: cfg.insecureSkipVerify ?? false,
    headers: (cfg.headers ?? []).map((h) => ({
      key: h.key ?? "",
      valueType: h.valueType ?? "literal",
      value: h.value ?? "",
      vaultVarRef: h.vaultVarRef ?? "",
    })),
    body: {
      type: cfg.body?.type ?? "none",
      raw: cfg.body?.raw ?? "",
      json: cfg.body?.json ?? "{\n  \n}",
      formData: (cfg.body?.formData ?? []).map((f) => ({
        key: f.key ?? "",
        valueType: f.valueType ?? "literal",
        value: f.value ?? "",
        vaultVarRef: f.vaultVarRef ?? "",
      })),
      urlEncoded: (cfg.body?.urlEncoded ?? []).map((f) => ({
        key: f.key ?? "",
        valueType: f.valueType ?? "literal",
        value: f.value ?? "",
        vaultVarRef: f.vaultVarRef ?? "",
      })),
      graphqlVariables: cfg.body?.graphqlVariables ?? "",
    },
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-green-600 dark:text-green-400",
  POST: "text-blue-600 dark:text-blue-400",
  PUT: "text-amber-600 dark:text-amber-400",
  PATCH: "text-purple-600 dark:text-purple-400",
  DELETE: "text-red-600 dark:text-red-400",
};

const COMMON_HEADERS = [
  "Authorization",
  "Accept",
  "Accept-Encoding",
  "Accept-Language",
  "Cache-Control",
  "Content-Type",
  "X-Api-Key",
  "X-Auth-Token",
  "X-Request-ID",
  "User-Agent",
  "Referer",
  "Origin",
];

const BODY_TABS: HttpBodyType[] = [
  "none",
  "json",
  "form-data",
  "x-www-form-urlencoded",
  "raw",
  "graphql",
];

// ─── Auth vault → injected headers mapping ────────────────────────────────────

/** What header(s) each HttpVault subtype injects at runtime */
const VAULT_AUTH_HEADERS: Record<string, Array<{ key: string; preview: string }>> = {
  token:                      [{ key: "Authorization",    preview: "Bearer ••••••••" }],
  username_password:          [{ key: "Authorization",    preview: "Basic ••••••••"  }],
  key_secret:                 [{ key: "Authorization",    preview: "ApiKey ••••••••" }],
  oauth2_client_credentials:  [{ key: "Authorization",    preview: "Bearer ••••••••" }],
  oauth2_password_grant:      [{ key: "Authorization",    preview: "Bearer ••••••••" }],
  jwt_signing_key:            [{ key: "Authorization",    preview: "Bearer ••••••••" }],
  aws_sigv4:                  [{ key: "Authorization",    preview: "AWS4-HMAC-SHA256 ••••" }],
  cookie:                     [{ key: "Cookie",           preview: "••••••••"        }],
  mtls_certificate:           [{ key: "(TLS)",            preview: "Client certificate" }],
  ssh_key:                    [{ key: "(SSH)",             preview: "SSH private key"    }],
  custom_kv:                  [{ key: "(multiple)",       preview: "custom headers"     }],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Read-only row showing a header injected by the selected auth vault */
function LockedHeaderRow({
  headerKey,
  preview,
  vaultName,
}: {
  headerKey: string;
  preview: string;
  vaultName: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-muted/40 border border-dashed px-2 py-1.5 select-none">
      <Lock className="size-3 shrink-0 text-muted-foreground/60" />
      <span className="font-mono text-xs flex-1 text-muted-foreground truncate">
        {headerKey}
      </span>
      <span className="text-xs text-muted-foreground/70 font-mono truncate flex-1">
        {preview}
      </span>
      <span className="text-[10px] text-muted-foreground/50 shrink-0 italic">
        {vaultName}
      </span>
    </div>
  );
}

function FormFieldRow({
  field,
  onChange,
  onRemove,
  varSets,
}: {
  field: FormBodyField;
  onChange: (f: FormBodyField) => void;
  onRemove: () => void;
  varSets: VarSetItem[];
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-1.5">
      <Input
        value={field.key}
        onChange={(e) => onChange({ ...field, key: e.target.value })}
        placeholder={t("input.httpRest.bodyFieldKey")}
        className="font-mono flex-1 min-w-0"
      />
      <Select
        value={field.valueType}
        onValueChange={(v) =>
          onChange({ ...field, valueType: v as "literal" | "vault_var" })
        }
      >
        <SelectTrigger className="w-28 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="literal">{t("input.httpRest.literalValue")}</SelectItem>
          <SelectItem value="vault_var">{t("input.httpRest.vaultVar")}</SelectItem>
        </SelectContent>
      </Select>
      {field.valueType === "literal" ? (
        <Input
          value={field.value}
          onChange={(e) => onChange({ ...field, value: e.target.value })}
          placeholder={t("input.httpRest.bodyFieldValue")}
          className="flex-1 min-w-0"
        />
      ) : (
        <VaultVarPicker
          value={field.vaultVarRef}
          onChange={(ref) => onChange({ ...field, vaultVarRef: ref })}
          varSets={varSets}
        />
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onRemove}
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function resolveVarLabel(ref: string, varSets: VarSetItem[]): string {
  if (!ref) return "";
  const dotIdx = ref.indexOf(".");
  if (dotIdx === -1) return ref;
  const slug = ref.slice(0, dotIdx);
  const key = ref.slice(dotIdx + 1);
  const vs = varSets.find((s) => s.slug === slug);
  return vs ? `${vs.name}.${key}` : ref;
}

function VaultVarPicker({
  value,
  onChange,
  varSets,
}: {
  value: string;
  onChange: (ref: string) => void;
  varSets: VarSetItem[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const label = value
    ? resolveVarLabel(value, varSets)
    : t("input.httpRest.selectVaultVar");

  const lower = search.toLowerCase();
  const visibleSets = varSets
    .map((vs) => {
      const setMatches = !search || vs.name.toLowerCase().includes(lower);
      const visibleKeys = setMatches
        ? vs.variableKeys
        : vs.variableKeys.filter((k) => k.toLowerCase().includes(lower));
      return { vs, visibleKeys };
    })
    .filter(({ vs, visibleKeys }) => visibleKeys.length > 0 || (!search && vs.variableCount === 0));

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 min-w-0 justify-between font-mono text-xs"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3 shrink-0 ml-1 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        {/* Search */}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("input.httpRest.searchVaultVar")}
          className="text-xs h-7 mb-2"
          autoFocus
        />

        {/* Groups */}
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {varSets.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-1">
              {t("input.httpRest.noVarSets")}
            </p>
          ) : visibleSets.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-1">
              {t("common.noResults")}
            </p>
          ) : (
            visibleSets.map(({ vs, visibleKeys }) => (
              <div key={vs.id}>
                {/* Category header */}
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-0.5 select-none">
                  {vs.name}
                </p>
                {visibleKeys.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-1 italic">
                    {t("vault.varset.noVariables")}
                  </p>
                ) : (
                  visibleKeys.map((key) => {
                    const ref = `${vs.slug}.${key}`;
                    const active = value === ref;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={cn(
                          "w-full text-left text-xs px-3 py-1.5 rounded font-mono transition-colors",
                          active
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted",
                        )}
                        onClick={() => {
                          onChange(ref);
                          setOpen(false);
                          setSearch("");
                        }}
                      >
                        {key}
                      </button>
                    );
                  })
                )}
              </div>
            ))
          )}
        </div>

        {/* Manual ref fallback */}
        <Separator className="my-2" />
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 px-1">
            {t("input.httpRest.orTypeRef")}
          </p>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="vaultId.keyName"
            className="font-mono text-xs"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── VarInsertPopover — inserts {{vault.var.*}} at textarea cursor ────────────

function VarInsertPopover({
  textareaRef,
  value,
  onChange,
  varSets,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (v: string) => void;
  varSets: VarSetItem[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const cursorRef = useRef(0);

  const handleOpenChange = (o: boolean) => {
    if (o) {
      // Capture cursor position before the textarea loses focus
      cursorRef.current = textareaRef.current?.selectionStart ?? value.length;
    }
    setOpen(o);
    if (!o) setSearch("");
  };

  const handleInsert = (snippet: string) => {
    const pos = cursorRef.current;
    const newValue = value.slice(0, pos) + snippet + value.slice(pos);
    onChange(newValue);
    setOpen(false);
    setSearch("");
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const newPos = pos + snippet.length;
        el.setSelectionRange(newPos, newPos);
      }
    });
  };

  const lower = search.toLowerCase();
  const visibleSets = varSets
    .map((vs) => {
      const setMatches = !search || vs.name.toLowerCase().includes(lower);
      const visibleKeys = setMatches
        ? vs.variableKeys
        : vs.variableKeys.filter((k) => k.toLowerCase().includes(lower));
      return { vs, visibleKeys };
    })
    .filter(({ visibleKeys }) => visibleKeys.length > 0);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          title={t("input.httpRest.insertVariable")}
        >
          <Braces className="size-3" />
          {t("input.httpRest.insertVariable")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("input.httpRest.searchVaultVar")}
          className="text-xs h-7 mb-2"
          autoFocus
        />
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {varSets.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-1">
              {t("input.httpRest.noVarSets")}
            </p>
          ) : visibleSets.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-1">
              {t("common.noResults")}
            </p>
          ) : (
            visibleSets.map(({ vs, visibleKeys }) => (
              <div key={vs.id}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-0.5 select-none">
                  {vs.name}
                </p>
                {visibleKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="w-full text-left text-xs px-3 py-1.5 rounded font-mono hover:bg-muted transition-colors"
                    onClick={() => handleInsert(`{{vault.var.${vs.slug}.${key}}}`)}
                  >
                    <span className="text-muted-foreground text-[10px]">{vs.name}.</span>
                    {key}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  form: HttpRestInputFormData;
  onChange: <K extends keyof HttpRestInputFormData>(
    key: K,
    value: HttpRestInputFormData[K],
  ) => void;
  httpVaultItems: HttpVaultItem[];
  varSetItems?: VarSetItem[];
  /** Called whenever the form's overall validity changes (e.g. invalid JSON body) */
  onValidChange?: (valid: boolean) => void;
}

export function HttpRestInputForm({
  form,
  onChange,
  httpVaultItems,
  varSetItems = [],
  onValidChange,
}: Props) {
  const { t } = useTranslation();

  const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);
  const rawTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ── JSON body validation ──────────────────────────────────────────────────
  const jsonError = useMemo<string | null>(() => {
    if (form.body.type !== "json") return null;
    const src = form.body.json.trim();
    if (!src) return null; // empty → no error yet
    try {
      JSON.parse(src);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid JSON";
    }
  }, [form.body.type, form.body.json]);

  useEffect(() => {
    onValidChange?.(jsonError === null);
  }, [jsonError, onValidChange]);

  const setBody = (partial: Partial<HttpBodyConfig>) =>
    onChange("body", { ...form.body, ...partial });

  const addHeader = () =>
    onChange("headers", [
      ...form.headers,
      { key: "", valueType: "literal", value: "", vaultVarRef: "" },
    ]);

  const updateHeader = (idx: number, h: HttpHeaderField) =>
    onChange(
      "headers",
      form.headers.map((item, i) => (i === idx ? h : item)),
    );

  const removeHeader = (idx: number) =>
    onChange(
      "headers",
      form.headers.filter((_, i) => i !== idx),
    );

  const addFormField = (key: "formData" | "urlEncoded") =>
    setBody({
      [key]: [
        ...form.body[key],
        { key: "", valueType: "literal", value: "", vaultVarRef: "" },
      ],
    });

  const updateFormField = (
    key: "formData" | "urlEncoded",
    idx: number,
    f: FormBodyField,
  ) =>
    setBody({
      [key]: form.body[key].map((item, i) => (i === idx ? f : item)),
    });

  const removeFormField = (key: "formData" | "urlEncoded", idx: number) =>
    setBody({ [key]: form.body[key].filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      {/* ── General ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("input.httpRest.general")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="inputName">{t("input.httpRest.name")}</FieldLabel>
              <Input
                id="inputName"
                value={form.name}
                onChange={(e) => onChange("name", e.target.value)}
                placeholder={t("input.httpRest.namePlaceholder")}
              />
            </Field>
            <Field>
              <FieldLabel>{t("input.httpRest.baseUrl")}</FieldLabel>
              <div className="flex gap-1.5">
                <Select
                  value={form.method}
                  onValueChange={(v) => onChange("method", v as HttpMethod)}
                >
                  <SelectTrigger className="w-28 shrink-0">
                    <SelectValue>
                      <span className={METHOD_COLORS[form.method]}>{form.method}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        <span className={METHOD_COLORS[m]}>{m}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={form.baseUrl}
                  onChange={(e) => onChange("baseUrl", e.target.value)}
                  placeholder={t("input.httpRest.baseUrlPlaceholder")}
                  className="flex-1 font-mono"
                />
              </div>
            </Field>
            <Field>
              <FieldLabel>{t("input.httpRest.vaultOptional")}</FieldLabel>
              <Select
                value={form.vaultId || "none"}
                onValueChange={(v) => onChange("vaultId", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("input.httpRest.noVault")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("input.httpRest.noVault")}</SelectItem>
                  {httpVaultItems.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <div className="flex items-center justify-between gap-4 py-0.5">
                <div>
                  <FieldLabel className="mb-0">{t("input.httpRest.insecureSkipVerify")}</FieldLabel>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t("input.httpRest.insecureSkipVerifyHint")}
                  </p>
                </div>
                <Switch
                  checked={form.insecureSkipVerify}
                  onCheckedChange={(v) => onChange("insecureSkipVerify", v)}
                />
              </div>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* ── Headers ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">{t("input.httpRest.headers")}</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={addHeader}>
            <Plus className="size-3.5" />
            {t("input.httpRest.addHeader")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Locked rows injected by the auth vault */}
          {(() => {
            const authVault = httpVaultItems.find((v) => v.id === form.vaultId);
            const authRows = authVault ? (VAULT_AUTH_HEADERS[authVault.subtype] ?? []) : [];
            if (!authRows.length) return null;
            return (
              <>
                {authRows.map((row) => (
                  <LockedHeaderRow
                    key={row.key}
                    headerKey={row.key}
                    preview={row.preview}
                    vaultName={authVault!.name}
                  />
                ))}
                {form.headers.length > 0 && <Separator />}
              </>
            );
          })()}

          {form.headers.length === 0 && !form.vaultId && (
            <p className="text-xs text-muted-foreground">{t("input.httpRest.noHeaders")}</p>
          )}

          {form.headers.map((h, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                {/* Key: combobox with predefined list + free text */}
                <Popover>
                  <PopoverTrigger asChild>
                    <div className="relative flex-1 min-w-0">
                      <Input
                        value={h.key}
                        onChange={(e) =>
                          updateHeader(idx, { ...h, key: e.target.value })
                        }
                        placeholder={t("input.httpRest.headerKey")}
                        className="font-mono pr-6"
                      />
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-1" align="start">
                    <div className="space-y-0.5">
                      {COMMON_HEADERS.map((hdr) => (
                        <button
                          key={hdr}
                          type="button"
                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted font-mono"
                          onClick={() => updateHeader(idx, { ...h, key: hdr })}
                        >
                          {hdr}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Select
                  value={h.valueType}
                  onValueChange={(v) =>
                    updateHeader(idx, { ...h, valueType: v as "literal" | "vault_var" })
                  }
                >
                  <SelectTrigger className="w-28 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="literal">{t("input.httpRest.literalValue")}</SelectItem>
                    <SelectItem value="vault_var">{t("input.httpRest.vaultVar")}</SelectItem>
                  </SelectContent>
                </Select>
                {h.valueType === "literal" ? (
                  <Input
                    value={h.value}
                    onChange={(e) =>
                      updateHeader(idx, { ...h, value: e.target.value })
                    }
                    placeholder={t("input.httpRest.headerValue")}
                    className="flex-1 min-w-0"
                  />
                ) : (
                  <VaultVarPicker
                    value={h.vaultVarRef}
                    onChange={(ref) => updateHeader(idx, { ...h, vaultVarRef: ref })}
                    varSets={varSetItems}
                  />
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeHeader(idx)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* ── Body ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t("input.httpRest.body")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Body type tabs */}
          <div className="flex gap-0.5 flex-wrap">
            {BODY_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setBody({ type: tab })}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  form.body.type === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab === "none" ? t("input.httpRest.bodyNone") : tab}
              </button>
            ))}
          </div>

          {/* Body editors */}
          {form.body.type === "json" && (
            <div className="space-y-1">
              <div className="flex items-center justify-end mb-1">
                {varSetItems.length > 0 && (
                  <VarInsertPopover
                    textareaRef={jsonTextareaRef}
                    value={form.body.json}
                    onChange={(v) => setBody({ json: v })}
                    varSets={varSetItems}
                  />
                )}
              </div>
              <Textarea
                ref={jsonTextareaRef}
                value={form.body.json}
                onChange={(e) => setBody({ json: e.target.value })}
                rows={8}
                placeholder={"{\n  \"key\": \"value\"\n}"}
                className={cn(
                  "font-mono text-xs",
                  jsonError && "border-destructive focus-visible:ring-destructive",
                )}
              />
              {jsonError ? (
                <p className="text-xs text-destructive font-mono break-all">
                  {jsonError}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  {t("input.httpRest.vaultVarSyntax")}
                </p>
              )}
            </div>
          )}

          {form.body.type === "raw" && (
            <div className="space-y-1">
              <div className="flex items-center justify-end mb-1">
                {varSetItems.length > 0 && (
                  <VarInsertPopover
                    textareaRef={rawTextareaRef}
                    value={form.body.raw}
                    onChange={(v) => setBody({ raw: v })}
                    varSets={varSetItems}
                  />
                )}
              </div>
              <Textarea
                ref={rawTextareaRef}
                value={form.body.raw}
                onChange={(e) => setBody({ raw: e.target.value })}
                rows={8}
                placeholder={t("input.httpRest.rawBodyPlaceholder")}
                className="font-mono text-xs"
              />
            </div>
          )}

          {form.body.type === "graphql" && (
            <div className="space-y-2">
              <div>
                <p className="text-xs font-medium mb-1">{t("input.httpRest.graphqlQuery")}</p>
                <Textarea
                  value={form.body.raw}
                  onChange={(e) => setBody({ raw: e.target.value })}
                  rows={6}
                  placeholder={"query {\n  \n}"}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">{t("input.httpRest.graphqlVariables")}</p>
                <Textarea
                  value={form.body.graphqlVariables}
                  onChange={(e) => setBody({ graphqlVariables: e.target.value })}
                  rows={4}
                  placeholder={"{\n  \n}"}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          )}

          {(form.body.type === "form-data" || form.body.type === "x-www-form-urlencoded") && (() => {
            const fKey = form.body.type === "form-data" ? "formData" : "urlEncoded";
            const fields = form.body[fKey];
            return (
              <div className="space-y-2">
                {fields.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("input.httpRest.noBodyFields")}</p>
                ) : (
                  fields.map((field, i) => (
                    <FormFieldRow
                      key={i}
                      field={field}
                      onChange={(f) => updateFormField(fKey, i, f)}
                      onRemove={() => removeFormField(fKey, i)}
                      varSets={varSetItems}
                    />
                  ))
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addFormField(fKey)}
                >
                  <Plus className="size-3.5" />
                  {t("input.httpRest.addBodyField")}
                </Button>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
