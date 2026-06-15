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
  KeySquare,
  Send,
  Mail,
  Globe,
  Cpu,
  Server,
} from "lucide-react";
import { getAllModuleNavEntries } from "@/providers/module-settings-registry";

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

export type SidebarNavCategory = {
  /** Empty string = no visible header */
  titleKey: string;
  items: SidebarNavItem[];
};

export const ROOT_NAV_CATEGORIES: SidebarNavCategory[] = [
  {
    titleKey: "",
    items: [
      { to: "/", icon: LayoutDashboard, labelKey: "nav.dashboard", end: true },
    ],
  },
  {
    titleKey: "nav.categories.resources",
    items: [
      { to: "/vault", icon: KeyRound, labelKey: "nav.vault" },
      { to: "/files", icon: FolderOpen, labelKey: "nav.files" },
      { to: "/input", icon: Cpu, labelKey: "nav.input" },
    ],
  },
  {
    titleKey: "nav.categories.automation",
    items: [
      { to: "/backups", icon: HardDriveDownload, labelKey: "nav.backups" },
      { to: "/output", icon: Send, labelKey: "nav.output" },
    ],
  },
  {
    titleKey: "nav.categories.system",
    items: [
      { to: "/logs", icon: ScrollText, labelKey: "nav.logs" },
      { to: "/settings", icon: Settings, labelKey: "nav.settings" },
    ],
  },
];

/** Flat list kept for compatibility (used when a sub-level is active) */
export const ROOT_NAV_ITEMS: SidebarNavItem[] = ROOT_NAV_CATEGORIES.flatMap(
  (c) => c.items,
);

export const SIDEBAR_LEVELS: Record<string, SidebarLevel> = {
  "/vault": {
    parentPath: "/",
    titleKey: "nav.vault",
    items: [
      { to: "/vault/email", icon: Mail, labelKey: "nav.emailConfigs" },
      { to: "/vault/http", icon: Globe, labelKey: "nav.httpConfigs" },
      { to: "/vault/ssh-remote", icon: Server, labelKey: "nav.sshRemote" },
      { to: "/vault/variable-set", icon: KeySquare, labelKey: "nav.variableSets" },
    ],
  },
  "/vault/email": {
    parentPath: "/vault",
    titleKey: "nav.emailConfigs",
    items: [
      { to: "/vault/email", icon: Mail, labelKey: "nav.emailConfigs" },
      { to: "/vault/http", icon: Globe, labelKey: "nav.httpConfigs" },
      { to: "/vault/ssh-remote", icon: Server, labelKey: "nav.sshRemote" },
      { to: "/vault/variable-set", icon: KeySquare, labelKey: "nav.variableSets" },
    ],
  },
  "/vault/http": {
    parentPath: "/vault",
    titleKey: "nav.httpConfigs",
    items: [
      { to: "/vault/email", icon: Mail, labelKey: "nav.emailConfigs" },
      { to: "/vault/http", icon: Globe, labelKey: "nav.httpConfigs" },
      { to: "/vault/ssh-remote", icon: Server, labelKey: "nav.sshRemote" },
      { to: "/vault/variable-set", icon: KeySquare, labelKey: "nav.variableSets" },
    ],
  },
  "/vault/ssh-remote": {
    parentPath: "/vault",
    titleKey: "nav.sshRemote",
    items: [
      { to: "/vault/email", icon: Mail, labelKey: "nav.emailConfigs" },
      { to: "/vault/http", icon: Globe, labelKey: "nav.httpConfigs" },
      { to: "/vault/ssh-remote", icon: Server, labelKey: "nav.sshRemote" },
      { to: "/vault/variable-set", icon: KeySquare, labelKey: "nav.variableSets" },
    ],
  },
  "/vault/variable-set": {
    parentPath: "/vault",
    titleKey: "nav.variableSets",
    items: [
      { to: "/vault/email", icon: Mail, labelKey: "nav.emailConfigs" },
      { to: "/vault/http", icon: Globe, labelKey: "nav.httpConfigs" },
      { to: "/vault/ssh-remote", icon: Server, labelKey: "nav.sshRemote" },
      { to: "/vault/variable-set", icon: KeySquare, labelKey: "nav.variableSets" },
    ],
  },
  "/input": {
    parentPath: "/",
    titleKey: "nav.input",
    items: [
      { to: "/input/http-rest", icon: Globe, labelKey: "nav.httpRestInputs" },
      { to: "/input/ssh", icon: Server, labelKey: "nav.sshInputs" },
    ],
  },
  "/input/http-rest": {
    parentPath: "/input",
    titleKey: "nav.httpRestInputs",
    items: [
      { to: "/input/http-rest", icon: Globe, labelKey: "nav.httpRestInputs" },
      { to: "/input/ssh", icon: Server, labelKey: "nav.sshInputs" },
    ],
  },
  "/input/http-rest/new": {
    parentPath: "/input/http-rest",
    titleKey: "nav.httpRestInputs",
    items: [
      { to: "/input/http-rest", icon: Globe, labelKey: "nav.httpRestInputs" },
      { to: "/input/ssh", icon: Server, labelKey: "nav.sshInputs" },
    ],
  },
  "/input/ssh": {
    parentPath: "/input",
    titleKey: "nav.sshInputs",
    items: [
      { to: "/input/http-rest", icon: Globe, labelKey: "nav.httpRestInputs" },
      { to: "/input/ssh", icon: Server, labelKey: "nav.sshInputs" },
    ],
  },
  "/input/ssh/new": {
    parentPath: "/input/ssh",
    titleKey: "nav.sshInputs",
    items: [
      { to: "/input/http-rest", icon: Globe, labelKey: "nav.httpRestInputs" },
      { to: "/input/ssh", icon: Server, labelKey: "nav.sshInputs" },
    ],
  },
  "/backups/new": {
    parentPath: "/backups",
    titleKey: "nav.backups",
    items: [],
  },
  "/backups/new/local": {
    parentPath: "/backups",
    titleKey: "nav.backups",
    items: [],
  },
  "/backups/new/input": {
    parentPath: "/backups",
    titleKey: "nav.backups",
    items: [],
  },
  "/output": {
    parentPath: "/",
    titleKey: "nav.output",
    items: [
      { to: "/output/mail/contacts", icon: Mail, labelKey: "nav.outputMail" },
      { to: "/output/ssh", icon: Server, labelKey: "nav.sshOutputs" },
    ],
  },
  "/output/ssh": {
    parentPath: "/output",
    titleKey: "nav.sshOutputs",
    items: [
      { to: "/output/mail/contacts", icon: Mail, labelKey: "nav.outputMail" },
      { to: "/output/ssh", icon: Server, labelKey: "nav.sshOutputs" },
    ],
  },
  "/output/ssh/new": {
    parentPath: "/output/ssh",
    titleKey: "nav.sshOutputs",
    items: [
      { to: "/output/mail/contacts", icon: Mail, labelKey: "nav.outputMail" },
      { to: "/output/ssh", icon: Server, labelKey: "nav.sshOutputs" },
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

export function buildSettingsSidebarLevel(): SidebarLevel {
  const moduleItems: SidebarNavItem[] = getAllModuleNavEntries().map((entry) => ({
    to: `/settings/modules/${entry.module}`,
    icon: entry.icon,
    labelKey: entry.labelKey,
  }));
  return {
    parentPath: "/",
    titleKey: "nav.settings",
    items: [
      { to: "/settings", icon: Settings, labelKey: "nav.settingsGlobal", end: true },
      ...moduleItems,
    ],
  };
}
