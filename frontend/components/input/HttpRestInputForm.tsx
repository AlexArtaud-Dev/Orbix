"use client";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import type { HttpVaultItem } from "@/services/vault";

export interface HttpRestInputFormData {
  name: string;
  baseUrl: string;
  listEndpoint: string;
  downloadEndpoint: string;
  responseMappingId: string;
  responseMappingName: string;
  vaultId: string;
  enabled: boolean;
}

export function defaultHttpRestInputForm(): HttpRestInputFormData {
  return {
    name: "",
    baseUrl: "",
    listEndpoint: "",
    downloadEndpoint: "",
    responseMappingId: "id",
    responseMappingName: "name",
    vaultId: "",
    enabled: true,
  };
}

export function formToPayload(form: HttpRestInputFormData) {
  return {
    name: form.name,
    type: "http-rest",
    vaultId: form.vaultId || null,
    config: {
      baseUrl: form.baseUrl,
      ...(form.listEndpoint ? { listEndpoint: form.listEndpoint } : {}),
      ...(form.downloadEndpoint
        ? { downloadEndpoint: form.downloadEndpoint }
        : {}),
      ...((form.responseMappingId !== "id" ||
        form.responseMappingName !== "name") && form.listEndpoint
        ? {
            responseMapping: {
              id: form.responseMappingId || "id",
              name: form.responseMappingName || "name",
            },
          }
        : {}),
    },
    requestParams: [],
    enabled: form.enabled,
  };
}

export function itemToForm(
  item: {
    name: string;
    vaultId: string | null;
    config: Record<string, unknown>;
    enabled: boolean;
  },
): HttpRestInputFormData {
  const cfg = item.config as {
    baseUrl?: string;
    listEndpoint?: string;
    downloadEndpoint?: string;
    responseMapping?: { id?: string; name?: string };
  };
  return {
    name: item.name,
    baseUrl: cfg.baseUrl ?? "",
    listEndpoint: cfg.listEndpoint ?? "",
    downloadEndpoint: cfg.downloadEndpoint ?? "",
    responseMappingId: cfg.responseMapping?.id ?? "id",
    responseMappingName: cfg.responseMapping?.name ?? "name",
    vaultId: item.vaultId ?? "",
    enabled: item.enabled,
  };
}

interface Props {
  form: HttpRestInputFormData;
  onChange: <K extends keyof HttpRestInputFormData>(
    key: K,
    value: HttpRestInputFormData[K],
  ) => void;
  httpVaultItems: HttpVaultItem[];
}

export function HttpRestInputForm({ form, onChange, httpVaultItems }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("common.actions")}</CardTitle>
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
              <FieldLabel htmlFor="baseUrl">{t("input.httpRest.baseUrl")}</FieldLabel>
              <Input
                id="baseUrl"
                value={form.baseUrl}
                onChange={(e) => onChange("baseUrl", e.target.value)}
                placeholder={t("input.httpRest.baseUrlPlaceholder")}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="listEndpoint">
                {t("input.httpRest.listEndpoint")}
              </FieldLabel>
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
                    <FieldLabel htmlFor="mappingId">
                      Champ ID
                    </FieldLabel>
                    <Input
                      id="mappingId"
                      value={form.responseMappingId}
                      onChange={(e) => onChange("responseMappingId", e.target.value)}
                      placeholder="id"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="mappingName">
                      Champ nom
                    </FieldLabel>
                    <Input
                      id="mappingName"
                      value={form.responseMappingName}
                      onChange={(e) =>
                        onChange("responseMappingName", e.target.value)
                      }
                      placeholder="name"
                    />
                  </Field>
                </div>
              </>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Auth */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("input.httpRest.vaultOptional")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="vaultId">{t("input.httpRest.vaultOptional")}</FieldLabel>
              <Select
                value={form.vaultId || "none"}
                onValueChange={(v) => onChange("vaultId", v === "none" ? "" : v)}
              >
                <SelectTrigger id="vaultId">
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
    </div>
  );
}
