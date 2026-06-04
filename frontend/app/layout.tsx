import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import I18nProvider from "@/i18n/provider";
import "./globals.css";
import { Roboto } from "next/font/google";
import { cn } from "@/lib/utils";

const roboto = Roboto({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Orbix",
  description: "Self-hosted backup automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", roboto.variable)}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <I18nProvider>{children}</I18nProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
