import { api } from "@/lib/api";

// ─── HTTP vault ───────────────────────────────────────────────────────────────

export type HttpVaultSubtype =
  | "token"
  | "username_password"
  | "key_secret"
  | "oauth2_client_credentials"
  | "oauth2_password_grant"
  | "mtls_certificate"
  | "ssh_key"
  | "jwt_signing_key"
  | "aws_sigv4"
  | "cookie"
  | "custom_kv";

export interface HttpVaultItem {
  id: string;
  name: string;
  subtype: HttpVaultSubtype;
  createdAt: string;
  updatedAt: string;
}

export interface HttpVaultListResponse {
  data: HttpVaultItem[];
  nextCursor: string | null;
}

export interface CreateHttpVaultPayload {
  name: string;
  subtype: HttpVaultSubtype;
  data: Record<string, unknown>;
}

export interface UpdateHttpVaultPayload {
  name?: string;
  data?: Record<string, unknown>;
}

export interface EmailVaultItem {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  fromAddr: string;
  fromName: string;
  secure: boolean;
  smtpStatus: "ok" | "error" | null;
  smtpStatusMsg: string | null;
  smtpCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailVaultListResponse {
  data: EmailVaultItem[];
  nextCursor: string | null;
}

export interface CreateEmailVaultPayload {
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;
  fromAddr: string;
  fromName?: string;
  secure?: boolean;
}

export type UpdateEmailVaultPayload = Partial<CreateEmailVaultPayload>;

export const vaultService = {
  // Email
  listEmail: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return api.get<EmailVaultListResponse>(`/api/vault/email?${params.toString()}`);
  },
  createEmail: (data: CreateEmailVaultPayload) =>
    api.post<EmailVaultItem>("/api/vault/email", data),
  getEmail: (id: string) =>
    api.get<EmailVaultItem>(`/api/vault/email/${id}`),
  updateEmail: (id: string, data: UpdateEmailVaultPayload) =>
    api.patch<EmailVaultItem>(`/api/vault/email/${id}`, data),
  deleteEmail: (id: string) =>
    api.delete<null>(`/api/vault/email/${id}`),
  testEmail: (id: string) =>
    api.post<null>(`/api/vault/email/${id}/test`),
  countEmail: () =>
    api.get<{ count: number }>("/api/vault/email/count"),

  // HTTP
  listHttp: (cursor?: string, limit = 100) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return api.get<HttpVaultListResponse>(`/api/vault/http?${params.toString()}`);
  },
  createHttp: (data: CreateHttpVaultPayload) =>
    api.post<HttpVaultItem>("/api/vault/http", data),
  getHttp: (id: string) =>
    api.get<HttpVaultItem>(`/api/vault/http/${id}`),
  updateHttp: (id: string, data: UpdateHttpVaultPayload) =>
    api.patch<HttpVaultItem>(`/api/vault/http/${id}`, data),
  deleteHttp: (id: string) =>
    api.delete<null>(`/api/vault/http/${id}`),
  countHttp: () =>
    api.get<{ count: number }>("/api/vault/http/count"),
};
