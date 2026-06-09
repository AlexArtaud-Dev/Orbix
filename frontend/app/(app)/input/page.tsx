"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Globe, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface InputType {
  key: string;
  icon: React.ElementType;
  href: string;
}

const INPUT_TYPES: InputType[] = [
  { key: "httpRest", icon: Globe, href: "/input/http-rest" },
];

const COMING_SOON: { key: string; icon: React.ElementType }[] = [
  { key: "digiposte", icon: () => <span className="text-xs font-bold">DGP</span> },
  { key: "sftp", icon: () => <span className="text-xs font-bold">SFTP</span> },
];

export default function InputSelectorPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("input.selectorTitle")}</h1>
        <p className="text-muted-foreground">{t("input.selectorSubtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INPUT_TYPES.map(({ key, icon: Icon, href }) => (
          <Link key={key} href={href} className="group block">
            <Card className="transition-colors hover:border-primary/50 hover:bg-muted/30">
              <CardContent className="flex items-center gap-4 py-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t(`input.type.${key}`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`input.typeDesc.${key}`)}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </Link>
        ))}

        {COMING_SOON.map(({ key, icon: Icon }) => (
          <div key={key} className="block cursor-not-allowed opacity-50">
            <Card>
              <CardContent className="flex items-center gap-4 py-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t(`input.type.${key}`)}</p>
                  <p className="text-xs text-muted-foreground">{t("input.comingSoon")}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {t("input.soon")}
                </span>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
