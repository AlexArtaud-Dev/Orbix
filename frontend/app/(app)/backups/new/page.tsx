"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FolderOpen, Cpu, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface BackupType {
  key: "local" | "input";
  icon: React.ElementType;
  href: string;
}

const BACKUP_TYPES: BackupType[] = [
  { key: "local", icon: FolderOpen, href: "/backups/new/local" },
  { key: "input", icon: Cpu, href: "/backups/new/input" },
];

export default function NewBackupSelectorPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("backups.typeSelector.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("backups.typeSelector.subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {BACKUP_TYPES.map(({ key, icon: Icon, href }) => (
          <Link key={key} href={href} className="group block">
            <Card className="transition-colors hover:border-primary/50 hover:bg-muted/30 h-full">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-base">{t(`backups.typeSelector.${key}`)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(`backups.typeSelector.${key}Desc`)}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
