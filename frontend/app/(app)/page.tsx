"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, FileText } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { vaultService } from "@/services/vault";
import { logsService } from "@/services/logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardStats {
  vaultEmailCount: number;
  logsToday: number;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    Promise.all([
      vaultService.countEmail(),
      logsService.list({ from: todayStart.toISOString(), limit: 200 }),
    ]).then(([countRes, logsRes]) => {
      setStats({
        vaultEmailCount: countRes.count,
        logsToday: logsRes.data.length,
      });
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">
          {t("dashboard.welcome")}, {user?.username}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard.vaultEmailCount")}
            </CardTitle>
            <Mail className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">
              {stats === null ? "—" : stats.vaultEmailCount}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard.logsToday")}
            </CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">
              {stats === null ? "—" : stats.logsToday}
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
