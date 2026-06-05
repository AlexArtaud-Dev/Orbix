import { api } from "@/lib/api";

export interface MailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  bodyType: "text" | "html";
  createdAt: string;
  updatedAt: string;
}

export interface TemplateListResponse {
  data: MailTemplate[];
  nextCursor: string | null;
}

export interface CreateTemplatePayload {
  name: string;
  subject: string;
  body: string;
  bodyType?: "text" | "html";
}

export type UpdateTemplatePayload = Partial<CreateTemplatePayload>;

export const templatesService = {
  list: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return api.get<TemplateListResponse>(`/api/mail/templates?${params.toString()}`);
  },
  create: (data: CreateTemplatePayload) =>
    api.post<MailTemplate>("/api/mail/templates", data),
  getOne: (id: string) =>
    api.get<MailTemplate>(`/api/mail/templates/${id}`),
  update: (id: string, data: UpdateTemplatePayload) =>
    api.patch<MailTemplate>(`/api/mail/templates/${id}`, data),
  delete: (id: string) =>
    api.delete<null>(`/api/mail/templates/${id}`),
};
