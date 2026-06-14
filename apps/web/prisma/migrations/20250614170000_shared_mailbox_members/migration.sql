-- Boîte partagée = compte mail réel + membres organisation

ALTER TABLE "Mailbox" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SharedMailbox" ADD COLUMN "mailboxId" TEXT;
ALTER TABLE "SharedMailbox" ADD COLUMN "isLegacy" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "SharedMailbox_mailboxId_key" ON "SharedMailbox"("mailboxId");

ALTER TABLE "SharedMailbox" ADD CONSTRAINT "SharedMailbox_mailboxId_fkey"
  FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SharedMailboxMember" (
    "id" TEXT NOT NULL,
    "sharedMailboxId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedMailboxMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SharedMailboxMember_sharedMailboxId_userId_key"
  ON "SharedMailboxMember"("sharedMailboxId", "userId");

ALTER TABLE "SharedMailboxMember" ADD CONSTRAINT "SharedMailboxMember_sharedMailboxId_fkey"
  FOREIGN KEY ("sharedMailboxId") REFERENCES "SharedMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SharedMailboxMember" ADD CONSTRAINT "SharedMailboxMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Anciennes boîtes (MailingList forwarding) : marquer legacy
UPDATE "SharedMailbox" SET "isLegacy" = true WHERE "mailboxId" IS NULL;
