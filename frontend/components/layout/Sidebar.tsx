"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { authService } from "@/services/auth";
import { Button } from "@/components/ui/button";
import {
  getActiveSidebarLevel,
  ROOT_NAV_ITEMS,
  type SidebarNavItem,
} from "./sidebarLevels";
import { Moon, Sun, LogOut, ArrowLeft, Globe } from "lucide-react";

export default function Sidebar() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { user, clear } = useAuthStore();

  const activeLevel = getActiveSidebarLevel(pathname);

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

  const navItems = activeLevel ? activeLevel.items : ROOT_NAV_ITEMS;

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-14 items-center px-5 font-bold text-lg tracking-tight">
        <span className="text-primary">Orbix</span>
      </div>

      <div className="mx-4 h-px bg-sidebar-border" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
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
              {t(item.labelKey)}
            </Link>
          );
        })}
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
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
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
