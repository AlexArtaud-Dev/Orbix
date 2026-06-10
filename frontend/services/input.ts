import { api } from "@/lib/api";

export interface HttpRestConfig {
  baseUrl: string;
  listEndpoint?: string;
  downloadEndpoint?: string;
  responseMapping?: { id?: string; name?: string };
  filterConfig?: Record<string, unknown>;
  /** Extension detected from the last successful test (e.g. ".tar.gz"). Used in noArchive mode. */
  detectedExtension?: string;
}

export interface InputItem {
  id: string;
  name: string;
  type: string; // "http-rest" | "digiposte" | "sftp"
  vaultId: string | null;
  config: HttpRestConfig | Record<string, unknown>;
  requestParams: unknown[];
  enabled: boolean;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InputListResponse {
  data: InputItem[];
  nextCursor: string | null;
}

export interface CreateInputPayload {
  name: string;
  type: string;
  vaultId?: string | null;
  config: Record<string, unknown>;
  requestParams?: unknown[];
  enabled?: boolean;
}

export type UpdateInputPayload = Partial<CreateInputPayload>;

export interface InputTestResult {
  success: boolean;
  count?: number;
  error?: string;
}

export interface ProviderMeta {
  type: string;
  label: string;
  icon: string;
  description: string;
}

export interface ProvidersResponse {
  inputs: ProviderMeta[];
  outputs: ProviderMeta[];
}

export const providersService = {
  list: () => api.get<ProvidersResponse>("/api/providers"),
};

export const inputService = {
  list: (cursor?: string, limit = 100) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return api.get<InputListResponse>(`/api/inputs?${params.toString()}`);
  },

  create: (data: CreateInputPayload) =>
    api.post<InputItem>("/api/inputs", data),

  getOne: (id: string) =>
    api.get<InputItem>(`/api/inputs/${id}`),

  update: (id: string, data: UpdateInputPayload) =>
    api.patch<InputItem>(`/api/inputs/${id}`, data),

  delete: (id: string) =>
    api.delete<null>(`/api/inputs/${id}`),

  test: (id: string) =>
    api.post<InputTestResult>(`/api/inputs/${id}/test`, {}),
};
