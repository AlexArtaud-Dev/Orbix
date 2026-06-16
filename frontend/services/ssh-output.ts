import { api } from "@/lib/api";

export interface SshOutputConfigItem {
  id: string;
  name: string;
  vaultId: string;
  destPath: string;
  lastTestStatus: string | null;
  lastTestError: string | null;
  lastTestAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSshOutputPayload {
  name: string;
  vaultId: string;
  destPath: string;
}

export interface UpdateSshOutputPayload {
  name?: string;
  vaultId?: string;
  destPath?: string;
}

export interface SshOutputTestResult {
  steps: { connection: string; path: string; write: string };
  ok: boolean;
}

export const sshOutputService = {
  list: () => api.get<SshOutputConfigItem[]>("/api/output/ssh"),
  getOne: (id: string) =>
    api.get<SshOutputConfigItem>(`/api/output/ssh/${id}`),
  create: (data: CreateSshOutputPayload) =>
    api.post<SshOutputConfigItem>("/api/output/ssh", data),
  update: (id: string, data: UpdateSshOutputPayload) =>
    api.patch<SshOutputConfigItem>(`/api/output/ssh/${id}`, data),
  delete: (id: string) => api.delete<null>(`/api/output/ssh/${id}`),
  test: (id: string) =>
    api.post<SshOutputTestResult>(`/api/output/ssh/${id}/test`),
};
