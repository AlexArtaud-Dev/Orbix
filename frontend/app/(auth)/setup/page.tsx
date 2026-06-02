"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { authService } from "@/services/auth";
import { useAuthStore } from "@/stores/authStore";
import { ApiError } from "@/lib/api";

export default function SetupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { fetchMe } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authService.setupRequired().then(({ required }) => {
      if (!required) router.replace("/login");
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t("auth.passwordsNoMatch"));
      return;
    }
    setLoading(true);
    try {
      await authService.setup(username, password);
      await fetchMe();
      toast.success(t("auth.setupSuccess"));
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
          <p className="text-lg font-semibold">{t("auth.setupTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("auth.setupSubtitle")}</p>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {(
            [
              { id: "username", label: t("auth.username"), type: "text", val: username, set: setUsername },
              { id: "password", label: t("auth.password"), type: "password", val: password, set: setPassword, min: 8 },
              { id: "confirm", label: t("auth.confirmPassword"), type: "password", val: confirm, set: setConfirm },
            ] as const
          ).map((f) => (
            <div key={f.id} className="space-y-1.5">
              <label className="text-sm font-medium">{f.label}</label>
              <input
                type={f.type}
                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={f.val}
                onChange={(e) => (f.set as (v: string) => void)(e.target.value)}
                required
                minLength={"min" in f ? f.min : undefined}
                autoFocus={f.id === "username"}
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? t("common.loading") : t("auth.setup")}
          </button>
        </form>
      </div>
    </div>
  );
}
