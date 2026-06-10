"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getAllInputEntries } from "@/providers/input-registry";

export default function InputSelectorPage() {
  const { t } = useTranslation();
  const entries = getAllInputEntries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("input.selectorTitle")}</h1>
        <p className="text-muted-foreground">{t("input.selectorSubtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(({ type, label, icon: Icon, description }) => (
          <Link key={type} href={`/input/${type}`} className="group block">
            <Card className="transition-colors hover:border-primary/50 hover:bg-muted/30">
              <CardContent className="flex items-center gap-4 py-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
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
