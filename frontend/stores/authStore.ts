"use client";
import { create } from "zustand";
import { api } from "@/lib/api";

interface User {
  id: string;
  username: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User) => void;
  fetchMe: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  setUser: (user: User) => set({ user, loading: false }),

  fetchMe: async () => {
    set({ loading: true });
    try {
      const user = await api.get<User>("/api/auth/me");
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  clear: () => set({ user: null, loading: false }),
}));
