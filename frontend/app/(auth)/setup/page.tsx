"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { authService } from "@/services/auth";
import { useAuthStore } from "@/stores/authStore";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

export default function SetupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authService.setupRequired().then(({ required }) => {
      if (!required) router.replace("/login");
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t("auth.passwordsNoMatch"));
      return;
    }
    setLoading(true);
    try {
      const userData = await authService.setup(username, password);
      setUser(userData);
      toast.success(t("auth.setupSuccess"));
      router.replace("/");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? t(`errors.${err.code}`, err.message) : t("common.error"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">Orbix</CardTitle>
          <CardDescription>{t("auth.setupSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">{t("auth.username")}</FieldLabel>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{t("auth.password")}</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm">{t("auth.confirmPassword")}</FieldLabel>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </Field>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? t("common.loading") : t("auth.setup")}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
