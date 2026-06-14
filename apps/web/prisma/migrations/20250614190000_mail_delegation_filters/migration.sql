-- CreateEnum
CREATE TYPE "MailboxDelegationPermission" AS ENUM ('READ', 'SEND');

-- CreateEnum
CREATE TYPE "MailboxFilterAction" AS ENUM ('MOVE_TO', 'MARK_READ', 'MARK_FLAGGED', 'DELETE', 'STOP');

-- CreateTable
CREATE TABLE "MailboxDelegation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "delegateUserId" TEXT NOT NULL,
    "permission" "MailboxDelegationPermission" NOT NULL DEFAULT 'SEND',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailboxDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailboxFilter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fromAddress" TEXT,
    "subjectContains" TEXT,
    "action" "MailboxFilterAction" NOT NULL,
    "targetFolder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxFilter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailboxDelegation_mailboxId_delegateUserId_key" ON "MailboxDelegation"("mailboxId", "delegateUserId");

-- CreateIndex
CREATE INDEX "MailboxDelegation_delegateUserId_organizationId_idx" ON "MailboxDelegation"("delegateUserId", "organizationId");

-- CreateIndex
CREATE INDEX "MailboxFilter_mailboxId_sortOrder_idx" ON "MailboxFilter"("mailboxId", "sortOrder");

-- AddForeignKey
ALTER TABLE "MailboxDelegation" ADD CONSTRAINT "MailboxDelegation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxDelegation" ADD CONSTRAINT "MailboxDelegation_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxDelegation" ADD CONSTRAINT "MailboxDelegation_delegateUserId_fkey" FOREIGN KEY ("delegateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxFilter" ADD CONSTRAINT "MailboxFilter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxFilter" ADD CONSTRAINT "MailboxFilter_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
