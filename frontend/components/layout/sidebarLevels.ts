import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  FileText,
  FolderOpen,
  HardDriveDownload,
  Settings,
  ScrollText,
  KeyRound,
  Send,
} from "lucide-react";
import { Mail } from "lucide-react";

export type SidebarNavItem = {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  end?: boolean;
};

export type SidebarLevel = {
  parentPath: string;
  titleKey: string;
  items: SidebarNavItem[];
};

export const ROOT_NAV_ITEMS: SidebarNavItem[] = [
  { to: "/", icon: LayoutDashboard, labelKey: "nav.dashboard", end: true },
  { to: "/vault/email", icon: KeyRound, labelKey: "nav.vault" },
  { to: "/files", icon: FolderOpen, labelKey: "nav.files" },
  { to: "/output/mail/contacts", icon: Send, labelKey: "nav.output" },
  { to: "/backups", icon: HardDriveDownload, labelKey: "nav.backups" },
  { to: "/logs", icon: ScrollText, labelKey: "nav.logs" },
  { to: "/settings", icon: Settings, labelKey: "nav.settings" },
];

export const SIDEBAR_LEVELS: Record<string, SidebarLevel> = {
  "/vault": {
    parentPath: "/",
    titleKey: "nav.vault",
    items: [{ to: "/vault/email", icon: Mail, labelKey: "nav.emailConfigs" }],
  },
  "/output": {
    parentPath: "/",
    titleKey: "nav.output",
    items: [
      { to: "/output/mail/contacts", icon: Users, labelKey: "nav.contacts" },
      { to: "/output/mail/templates", icon: FileText, labelKey: "nav.templates" },
    ],
  },
};

export function getActiveSidebarLevel(pathname: string): SidebarLevel | null {
  const match = Object.keys(SIDEBAR_LEVELS)
    .filter((prefix) => pathname.startsWith(prefix))
    .sort((a, b) => b.length - a.length)[0];
  return match ? (SIDEBAR_LEVELS[match] ?? null) : null;
}
