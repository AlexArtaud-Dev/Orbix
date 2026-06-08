"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, ChevronDown } from "lucide-react";
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
    type: "http-rest",
    vaultId: form.vaultId || null,
    config,
    requestParams: [],
    enabled: form.enabled,
  };
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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

  const label = value
    ? `{{vault.var.${value}}}`
    : t("input.httpRest.selectVaultVar");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 min-w-0 justify-between font-mono text-xs truncate"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3 shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
          {t("input.httpRest.selectVaultVarHint")}
        </p>
        {varSets.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">{t("input.httpRest.noVarSets")}</p>
        ) : (
          <div className="space-y-1">
            {varSets.map((vs) =>
              Array.from({ length: vs.variableCount }).map((_, i) => (
                // We only know the count, not the actual keys — show the set name with a placeholder
                <button
                  key={`${vs.id}-placeholder-${i}`}
                  type="button"
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted font-mono"
                  onClick={() => {
                    // Without the actual key names we can't generate the full ref automatically;
                    // show the vault id and let the user type the key
                    onChange(`${vs.id}.`);
                    setOpen(false);
                  }}
                >
                  {vs.name}
                </button>
              )),
            )}
          </div>
        )}
        <Separator className="my-2" />
        <div className="px-1">
          <p className="text-[10px] text-muted-foreground mb-1">{t("input.httpRest.orTypeRef")}</p>
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

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  form: HttpRestInputFormData;
  onChange: <K extends keyof HttpRestInputFormData>(
    key: K,
    value: HttpRestInputFormData[K],
  ) => void;
  httpVaultItems: HttpVaultItem[];
  varSetItems?: VarSetItem[];
}

export function HttpRestInputForm({
  form,
  onChange,
  httpVaultItems,
  varSetItems = [],
}: Props) {
  const { t } = useTranslation();

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
          </FieldGroup>
        </CardContent>
      </Card>

      {/* ── Endpoints ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="listEndpoint">{t("input.httpRest.listEndpoint")}</FieldLabel>
              <Input
                id="listEndpoint"
                value={form.listEndpoint}
                onChange={(e) => onChange("listEndpoint", e.target.value)}
                placeholder={t("input.httpRest.listEndpointPlaceholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("input.httpRest.listEndpointHint")}
              </p>
            </Field>
            {form.listEndpoint && (
              <>
                <Field>
                  <FieldLabel htmlFor="downloadEndpoint">
                    {t("input.httpRest.downloadEndpoint")}
                  </FieldLabel>
                  <Input
                    id="downloadEndpoint"
                    value={form.downloadEndpoint}
                    onChange={(e) => onChange("downloadEndpoint", e.target.value)}
                    placeholder={t("input.httpRest.downloadEndpointPlaceholder")}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("input.httpRest.downloadEndpointHint")}
                  </p>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel>{t("input.httpRest.mappingIdField")}</FieldLabel>
                    <Input
                      value={form.responseMappingId}
                      onChange={(e) => onChange("responseMappingId", e.target.value)}
                      placeholder="id"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("input.httpRest.mappingNameField")}</FieldLabel>
                    <Input
                      value={form.responseMappingName}
                      onChange={(e) => onChange("responseMappingName", e.target.value)}
                      placeholder="name"
                    />
                  </Field>
                </div>
              </>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      {/* ── Auth ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("input.httpRest.auth")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
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
          {form.headers.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("input.httpRest.noHeaders")}</p>
          ) : (
            form.headers.map((h, idx) => (
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
            ))
          )}
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
              <Textarea
                value={form.body.json}
                onChange={(e) => setBody({ json: e.target.value })}
                rows={8}
                placeholder={"{\n  \"key\": \"value\"\n}"}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                {t("input.httpRest.vaultVarSyntax")}
              </p>
            </div>
          )}

          {form.body.type === "raw" && (
            <Textarea
              value={form.body.raw}
              onChange={(e) => setBody({ raw: e.target.value })}
              rows={8}
              placeholder={t("input.httpRest.rawBodyPlaceholder")}
              className="font-mono text-xs"
            />
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
