"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { authService } from "@/services/auth";
import { useAuthStore } from "@/stores/authStore";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { fetchMe } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authService.setupRequired().then(({ required }) => {
      if (required) router.replace("/setup");
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.login(username, password);
      await fetchMe();
      toast.success(t("auth.loginSuccess"));
      router.replace("/");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow">
        <div className="mb-6 text-center">
          <div className="mb-1 text-2xl font-bold text-primary">Orbix</div>
          <p className="text-lg font-semibold">{t("auth.loginTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("auth.loginSubtitle")}</p>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("auth.username")}</label>
            <input
              className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("auth.password")}</label>
            <input
              type="password"
              className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? t("common.loading") : t("auth.login")}
          </button>
        </form>
      </div>
    </div>
  );
}
