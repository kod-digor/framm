"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { changePasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("changePassword");

  return (
    <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("submitting") : t("submit")}
    </Button>
  );
}

export function ChangePasswordForm() {
  const t = useTranslations("changePassword");
  const [state, action] = useActionState(changePasswordAction, INITIAL);

  return (
    <Card className="w-full max-w-sm border-canal shadow-none">
      <CardHeader className="border-0 pb-0 text-center">
        <CardTitle className="text-base font-semibold">{t("title")}</CardTitle>
        <p className="mt-2 text-sm text-ardoise/70">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="pt-4">
        {state.message === "passwordTooShort" && (
          <p className="mb-4 text-sm text-red-600">{t("passwordTooShort")}</p>
        )}
        {state.message === "passwordMismatch" && (
          <p className="mb-4 text-sm text-red-600">{t("passwordMismatch")}</p>
        )}
        {state.message === "stalwartError" && (
          <p className="mb-4 text-sm text-red-600">{t("stalwartError")}</p>
        )}
        <form action={action} className="space-y-4">
          <div>
            <Label htmlFor="password">{t("newPassword")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="confirm">{t("confirmPassword")}</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
              className="mt-1.5"
            />
          </div>
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
