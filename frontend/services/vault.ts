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

export interface VaultHealthCheckItem {
  status: "ok" | "error";
  statusMsg: string | null;
  checkedAt: string;
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
  healthCheck: VaultHealthCheckItem | null;
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

// ─── Variable Set vault ───────────────────────────────────────────────────────

export interface VarSetVariable {
  key: string;
  value: string;
}

export interface VarSetItem {
  id: string;
  name: string;
  /** URL-safe slug used in {{vault.var.<slug>.<key>}} templates */
  slug: string;
  variableCount: number;
  /** Variable keys — values are never exposed by the API */
  variableKeys: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VarSetListResponse {
  data: VarSetItem[];
  nextCursor: string | null;
}

export interface CreateVarSetPayload {
  name: string;
  variables: VarSetVariable[];
}

export interface UpdateVarSetPayload {
  name?: string;
  variables?: VarSetVariable[];
}

// ─── SSH Remote vault ─────────────────────────────────────────────────────────

export type SshVaultSubtype = "user_password" | "ssh_key";

export interface SshVaultItem {
  id: string;
  name: string;
  subtype: SshVaultSubtype;
  host: string;
  port: number;
  username: string;
  defaultPath: string;
  useSudo: boolean;
  healthCheck: VaultHealthCheckItem | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSshVaultPayload {
  name: string;
  subtype: SshVaultSubtype;
  host: string;
  port: number;
  username: string;
  defaultPath: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  sudoPassword?: string;
  useSudo?: boolean;
}

export interface UpdateSshVaultPayload {
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  defaultPath?: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  sudoPassword?: string;
  useSudo?: boolean;
}

export interface SshTestResult {
  steps: { connection: string; path: string; write: string };
  ok: boolean;
}

export interface SshBrowseEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  mtime: string;
}

export interface SshBrowseResult {
  path: string;
  entries: SshBrowseEntry[];
}

export interface SshMatchEntry {
  name: string;
  path: string;
  size: number;
}

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

  // Variable Set
  listVarSet: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return api.get<VarSetListResponse>(`/api/vault/varset?${params.toString()}`);
  },
  createVarSet: (data: CreateVarSetPayload) =>
    api.post<VarSetItem>("/api/vault/varset", data),
  getVarSet: (id: string) =>
    api.get<VarSetItem>(`/api/vault/varset/${id}`),
  updateVarSet: (id: string, data: UpdateVarSetPayload) =>
    api.patch<VarSetItem>(`/api/vault/varset/${id}`, data),
  deleteVarSet: (id: string) =>
    api.delete<null>(`/api/vault/varset/${id}`),
  countVarSet: () =>
    api.get<{ count: number }>("/api/vault/varset/count"),

  // SSH Remote
  listSsh: () =>
    api.get<SshVaultItem[]>("/api/vault/ssh-remote"),
  createSsh: (data: CreateSshVaultPayload) =>
    api.post<SshVaultItem>("/api/vault/ssh-remote", data),
  getSsh: (id: string) =>
    api.get<SshVaultItem>(`/api/vault/ssh-remote/${id}`),
  updateSsh: (id: string, data: UpdateSshVaultPayload) =>
    api.patch<SshVaultItem>(`/api/vault/ssh-remote/${id}`, data),
  deleteSsh: (id: string) =>
    api.delete<null>(`/api/vault/ssh-remote/${id}`),
  testSsh: (id: string) =>
    api.post<SshTestResult>(`/api/vault/ssh-remote/${id}/test`),
  countSsh: () =>
    api.get<{ count: number }>("/api/vault/ssh-remote/count"),
  browseSsh: (id: string, path: string) =>
    api.get<SshBrowseResult>(`/api/vault/ssh-remote/${id}/browse?path=${encodeURIComponent(path)}`),
  matchSsh: (id: string, path: string, pattern?: string, recursive?: boolean) => {
    const params = new URLSearchParams({ path });
    if (pattern) params.set("pattern", pattern);
    if (recursive) params.set("recursive", "true");
    return api.get<SshMatchEntry[]>(`/api/vault/ssh-remote/${id}/match?${params.toString()}`);
  },
};
