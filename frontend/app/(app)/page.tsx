"use client";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
      <p className="text-muted-foreground">
        {t("dashboard.welcome")}, {user?.username}.
      </p>
    </div>
  );
}
