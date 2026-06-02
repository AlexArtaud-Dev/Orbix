import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import I18nProvider from "@/i18n/provider";
import "./globals.css";

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <I18nProvider>{children}</I18nProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
