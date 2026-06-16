"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Mail, Server, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface OutputType {
  key: string;
  icon: React.ElementType;
  href: string;
  available: boolean;
}

const OUTPUT_TYPES: OutputType[] = [
  { key: "mail", icon: Mail, href: "/output/mail/contacts", available: true },
  { key: "ssh", icon: Server, href: "/output/ssh", available: true },
];

const COMING_SOON: { key: string; icon: React.ElementType }[] = [
  { key: "s3", icon: () => <span className="text-base font-bold">S3</span> },
  { key: "webhook", icon: () => <span className="text-base font-bold">{"{/}"}</span> },
];

export default function OutputPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("output.title")}</h1>
        <p className="text-muted-foreground">{t("output.subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {OUTPUT_TYPES.map(({ key, icon: Icon, href }) => (
          <Link key={key} href={href} className="group block">
            <Card className="transition-colors hover:border-primary/50 hover:bg-muted/30">
              <CardContent className="flex items-center gap-4 py-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t(`output.type.${key}`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`output.typeDesc.${key}`)}</p>
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
                  <p className="font-semibold">{t(`output.type.${key}`)}</p>
                  <p className="text-xs text-muted-foreground">{t("output.comingSoon")}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {t("output.soon")}
                </span>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
