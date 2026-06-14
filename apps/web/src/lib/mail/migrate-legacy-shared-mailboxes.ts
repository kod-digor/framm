export type LegacyMigrationResult = {
  migrated: string[];
  deleted: string[];
  failed: { address: string; reason: string }[];
};

/**
 * Migration one-shot des boîtes partagées MailingList → compte Stalwart unique.
 * Schéma post-legacy : colonnes isLegacy / SharedMailboxRecipient supprimées (20250614180000).
 */
export async function migrateLegacySharedMailboxes(): Promise<LegacyMigrationResult> {
  return { migrated: [], deleted: [], failed: [] };
}
