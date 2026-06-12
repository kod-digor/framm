"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { UserRole } from "@prisma/client";
import { z } from "zod";

const signupSchema = z.object({
  orgName: z.string().min(2),
  presentation: z.string().min(20),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    orgName: formData.get("orgName"),
    presentation: formData.get("presentation"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/signup?error=invalid");
  }

  const { orgName, presentation, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/signup?error=exists");

  const hash = await bcrypt.hash(password, 12);
  const slug = slugify(orgName);

  await prisma.organization.create({
    data: {
      name: orgName,
      slug: `${slug}-${Date.now()}`,
      presentation,
      users: {
        create: {
          email,
          passwordHash: hash,
          role: UserRole.ASSOC_ADMIN,
        },
      },
    },
  });

  redirect("/signup?success=pending");
}

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const result = await signIn("credentials", {
    email,
    password,
    redirect: false,
  });

  if (result?.error) redirect("/login?error=invalid");

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.role === "BUREAU" && !user.organizationId) redirect("/bureau");
  redirect("/dashboard");
}
