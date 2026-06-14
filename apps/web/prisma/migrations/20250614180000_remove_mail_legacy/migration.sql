-- Migration legacy shared mailboxes → run scripts/migrate-legacy-shared-mailboxes.ts before deploy

DROP TABLE IF EXISTS "SharedMailboxRecipient";

DELETE FROM "SharedMailbox" WHERE "mailboxId" IS NULL;

ALTER TABLE "SharedMailbox" DROP COLUMN IF EXISTS "stalwartAliasId";
ALTER TABLE "SharedMailbox" DROP COLUMN IF EXISTS "isLegacy";
ALTER TABLE "SharedMailbox" ALTER COLUMN "mailboxId" SET NOT NULL;

ALTER TABLE "MailboxAddress" DROP COLUMN IF EXISTS "provisionStatus";
DROP TYPE IF EXISTS "MailboxAddressProvisionStatus";
