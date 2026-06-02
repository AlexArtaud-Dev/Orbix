import { api } from "@/lib/api";

interface User {
  id: string;
  username: string;
}

export const authService = {
  setup: (username: string, password: string) =>
    api.post<User>("/api/auth/setup", { username, password }),
  login: (username: string, password: string) =>
    api.post<User>("/api/auth/login", { username, password }),
  logout: () => api.post<null>("/api/auth/logout"),
  me: () => api.get<User>("/api/auth/me"),
  setupRequired: () =>
    api.get<{ required: boolean }>("/api/auth/setup-required"),
};
