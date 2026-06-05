import { api } from "@/lib/api";

export interface MailLog {
  id: string;
  vaultId: string;
  toAddrs: string[];
  subject: string;
  status: "sent" | "error";
  errorMsg: string | null;
  sentAt: string;
}

export interface MailLogListResponse {
  data: MailLog[];
  nextCursor: string | null;
}

export interface SendMailPayload {
  vaultId: string;
  to: string[];
  subject: string;
  body: string;
  bodyType?: "text" | "html";
  attachments?: File[];
}

export const mailService = {
  send: (payload: SendMailPayload) => {
    const form = new FormData();
    form.append("vaultId", payload.vaultId);
    payload.to.forEach((addr) => form.append("to", addr));
    form.append("subject", payload.subject);
    form.append("body", payload.body);
    if (payload.bodyType) form.append("bodyType", payload.bodyType);
    (payload.attachments ?? []).forEach((f) => form.append("attachments", f));
    return api.postForm<null>("/api/mail/send", form);
  },
  getLogs: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return api.get<MailLogListResponse>(`/api/mail/logs?${params.toString()}`);
  },
};
