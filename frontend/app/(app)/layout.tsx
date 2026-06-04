"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import Sidebar from "@/components/layout/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, fetchMe } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Lit le state au moment de l'effet (pas la valeur réactive capturée au render)
    // Si l'user est déjà là (vient du login) → pas de double-fetch
    if (!useAuthStore.getState().user) {
      void fetchMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
