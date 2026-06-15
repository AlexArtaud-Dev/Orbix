"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Mail, Globe, KeySquare, Server, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface VaultType {
  key: string;
  icon: React.ElementType;
  href: string;
}

const VAULT_TYPES: VaultType[] = [
  { key: "email", icon: Mail, href: "/vault/email" },
  { key: "http", icon: Globe, href: "/vault/http" },
  { key: "sshRemote", icon: Server, href: "/vault/ssh-remote" },
  { key: "variableSet", icon: KeySquare, href: "/vault/variable-set" },
];

const COMING_SOON: { key: string; icon: React.ElementType }[] = [
  { key: "apiToken", icon: () => <span className="text-sm font-bold">API</span> },
];

export default function VaultPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("vault.selectorTitle")}</h1>
        <p className="text-muted-foreground">{t("vault.selectorSubtitle")}</p>
      </div>

      <div className="grid grid-rows-[auto] items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {VAULT_TYPES.map(({ key, icon: Icon, href }) => (
          <Link key={key} href={href} className="group flex">
            <Card className="flex flex-1 transition-colors hover:border-primary/50 hover:bg-muted/30">
              <CardContent className="flex flex-1 items-center gap-4 py-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t(`vault.type.${key}`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`vault.typeDesc.${key}`)}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </Link>
        ))}

        {COMING_SOON.map(({ key, icon: Icon }) => (
          <div key={key} className="flex cursor-not-allowed opacity-50">
            <Card className="flex flex-1">
              <CardContent className="flex flex-1 items-center gap-4 py-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t(`vault.type.${key}`)}</p>
                  <p className="text-xs text-muted-foreground">{t("vault.comingSoon")}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {t("vault.soon")}
                </span>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
