import type { MigrationProvider } from "@prisma/client";

export function providerSupportsContacts(provider: MigrationProvider): boolean {
  return provider === "GOOGLE" || provider === "MICROSOFT" || provider === "ICLOUD";
}

export function providerSupportsCalendar(provider: MigrationProvider): boolean {
  return provider === "GOOGLE" || provider === "MICROSOFT" || provider === "ICLOUD";
}
