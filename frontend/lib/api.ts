export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "";
  const res = await fetch(base + path, {
    credentials: "include",
    cache: "no-store", // désactive le cache navigateur → jamais de 304 vide
    ...init,
  });

  if (!res.ok) {
    let errorCode = "UNHANDLED";
    let errorMessage = "An error occurred";
    try {
      const json = (await res.json()) as {
        error: { code: string; message: string };
      };
      errorCode = json.error?.code ?? "UNHANDLED";
      errorMessage = json.error?.message ?? "An error occurred";
    } catch {
      // corps vide ou JSON invalide
    }
    throw new ApiError(errorCode, errorMessage);
  }

  const json = (await res.json()) as { data: T };
  return json.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, body: FormData) =>
    request<T>(path, { method: "POST", body }),
};
