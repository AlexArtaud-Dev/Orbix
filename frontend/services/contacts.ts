import { api } from "@/lib/api";

export interface Contact {
  id: string;
  name: string;
  email: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactListResponse {
  data: Contact[];
  nextCursor: string | null;
}

export interface CreateContactPayload {
  name: string;
  email: string;
  tags?: string[];
}

export type UpdateContactPayload = Partial<CreateContactPayload>;

export const contactsService = {
  list: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return api.get<ContactListResponse>(`/api/contacts?${params.toString()}`);
  },
  create: (data: CreateContactPayload) =>
    api.post<Contact>("/api/contacts", data),
  getOne: (id: string) =>
    api.get<Contact>(`/api/contacts/${id}`),
  update: (id: string, data: UpdateContactPayload) =>
    api.patch<Contact>(`/api/contacts/${id}`, data),
  delete: (id: string) =>
    api.delete<null>(`/api/contacts/${id}`),
};
