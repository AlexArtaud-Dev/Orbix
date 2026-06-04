import { api } from "@/lib/api";

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
};
