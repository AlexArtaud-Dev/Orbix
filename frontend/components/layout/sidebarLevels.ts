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
  Mail,
  Globe,
} from "lucide-react";

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
  { to: "/vault", icon: KeyRound, labelKey: "nav.vault" },
  { to: "/files", icon: FolderOpen, labelKey: "nav.files" },
  { to: "/output", icon: Send, labelKey: "nav.output" },
  { to: "/backups", icon: HardDriveDownload, labelKey: "nav.backups" },
  { to: "/logs", icon: ScrollText, labelKey: "nav.logs" },
  { to: "/settings", icon: Settings, labelKey: "nav.settings" },
];

export const SIDEBAR_LEVELS: Record<string, SidebarLevel> = {
  "/vault": {
    parentPath: "/",
    titleKey: "nav.vault",
    items: [
      { to: "/vault/email", icon: Mail, labelKey: "nav.emailConfigs" },
      { to: "/vault/http", icon: Globe, labelKey: "nav.httpConfigs" },
    ],
  },
  "/vault/email": {
    parentPath: "/vault",
    titleKey: "nav.emailConfigs",
    items: [
      { to: "/vault/email", icon: Mail, labelKey: "nav.emailConfigs" },
      { to: "/vault/http", icon: Globe, labelKey: "nav.httpConfigs" },
    ],
  },
  "/vault/http": {
    parentPath: "/vault",
    titleKey: "nav.httpConfigs",
    items: [
      { to: "/vault/email", icon: Mail, labelKey: "nav.emailConfigs" },
      { to: "/vault/http", icon: Globe, labelKey: "nav.httpConfigs" },
    ],
  },
  "/output": {
    parentPath: "/",
    titleKey: "nav.output",
    items: [
      { to: "/output/mail/contacts", icon: Mail, labelKey: "nav.outputMail" },
    ],
  },
  "/output/mail": {
    parentPath: "/output",
    titleKey: "nav.outputMail",
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
