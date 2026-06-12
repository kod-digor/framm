"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function approveOrganization(orgId: string) {
  await requireAuth(["BUREAU"]);
  await prisma.organization.update({
    where: { id: orgId },
    data: { status: "APPROVED", approvedAt: new Date(), rejectReason: null },
  });
  revalidatePath("/bureau");
}

export async function rejectOrganization(orgId: string, reason: string) {
  await requireAuth(["BUREAU"]);
  await prisma.organization.update({
    where: { id: orgId },
    data: { status: "REJECTED", rejectReason: reason },
  });
  revalidatePath("/bureau");
}
