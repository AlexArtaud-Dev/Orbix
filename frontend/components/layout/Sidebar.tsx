"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { authService } from "@/services/auth";
import { logsService } from "@/services/logs";
import { Button } from "@/components/ui/button";
import {
  getActiveSidebarLevel,
  buildSettingsSidebarLevel,
  ROOT_NAV_CATEGORIES,
  type SidebarNavItem,
} from "./sidebarLevels";
import { Moon, Sun, LogOut, ArrowLeft, Globe } from "lucide-react";

export default function Sidebar() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { user, clear } = useAuthStore();

  const [backupErrors, setBackupErrors] = useState(0);

  const activeLevel = pathname.startsWith("/settings")
    ? buildSettingsSidebarLevel()
    : getActiveSidebarLevel(pathname);

  // Fetch backup error count on mount + periodic refresh
  useEffect(() => {
    const load = () => {
      logsService.getBackupErrorSummary().then((r) => setBackupErrors(r.totalErrors)).catch(() => null);
    };
    load();
    const interval = setInterval(load, 60_000); // refresh every minute
    // Also refresh when logs are cleared from the backups page
    window.addEventListener("orbix:logs-changed", load);
    return () => {
      clearInterval(interval);
      window.removeEventListener("orbix:logs-changed", load);
    };
  }, []);

  // Reset badge when user visits /backups
  useEffect(() => {
    if (pathname.startsWith("/backups")) {
      logsService.getBackupErrorSummary().then((r) => setBackupErrors(r.totalErrors)).catch(() => null);
    }
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await authService.logout();
      clear();
      router.replace("/login");
      toast.success(t("auth.logoutSuccess"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const toggleLang = () => {
    void i18n.changeLanguage(i18n.language === "en" ? "fr" : "en");
  };

  const isActive = (item: SidebarNavItem) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to);

  const renderNavItem = (item: SidebarNavItem) => {
    const Icon = item.icon;
    const active = isActive(item);
    const isBackups = item.to === "/backups";
    const showBadge = isBackups && backupErrors > 0;
    return (
      <Link
        key={item.to}
        href={item.to}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1">{t(item.labelKey)}</span>
        {showBadge && (
          <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-sm ring-1 ring-red-700">
            {backupErrors > 99 ? "99+" : backupErrors}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-14 items-center px-5 font-bold text-lg tracking-tight">
        <span className="text-primary">Orbix</span>
      </div>

      <div className="mx-4 h-px bg-sidebar-border" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {activeLevel ? (
          /* Sub-level: flat list, no categories */
          <div className="space-y-0.5">
            {activeLevel.items.map(renderNavItem)}
          </div>
        ) : (
          /* Root: grouped by category */
          <div className="space-y-4">
            {ROOT_NAV_CATEGORIES.map((cat) => (
              <div key={cat.titleKey || "__root__"}>
                {cat.titleKey && (
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 select-none">
                    {t(cat.titleKey)}
                  </p>
                )}
                <div className="space-y-0.5">
                  {cat.items.map(renderNavItem)}
                </div>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-3 space-y-1">
        {activeLevel && (
          <Button
            variant="ghost"
            onClick={() => router.push(activeLevel.parentPath)}
            className="w-full justify-start text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <ArrowLeft className="size-4" />
            {t("common.back")}
          </Button>
        )}

        <div className="mx-1 h-px bg-sidebar-border" />

        <div className="flex items-center gap-1 px-1 pt-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLang}
            className="text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            aria-label={i18n.language.toUpperCase()}
          >
            <Globe className="size-4" />
          </Button>
          <span className="flex-1 truncate px-1 text-xs text-sidebar-foreground/50">
            {user?.username}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleLogout()}
            className="text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            aria-label={t("auth.logout")}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
