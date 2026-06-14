-- CreateEnum
CREATE TYPE "MigrationProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'ICLOUD', 'IMAP_GENERIC');

-- CreateEnum
CREATE TYPE "MigrationStatus" AS ENUM ('PENDING_OAUTH', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MigrationPhase" AS ENUM ('CONNECTING', 'SCANNING', 'SYNCING_MAIL', 'FINALIZING');

-- CreateTable
CREATE TABLE "MailboxMigration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "provider" "MigrationProvider" NOT NULL,
    "status" "MigrationStatus" NOT NULL DEFAULT 'PENDING_OAUTH',
    "phase" "MigrationPhase",
    "sourceAddress" TEXT,
    "targetAddress" TEXT NOT NULL,
    "sourceCredentialsEnc" TEXT,
    "oauthRefreshTokenEnc" TEXT,
    "scopeMail" BOOLEAN NOT NULL DEFAULT true,
    "scopeContacts" BOOLEAN NOT NULL DEFAULT false,
    "scopeCalendar" BOOLEAN NOT NULL DEFAULT false,
    "progressJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxMigration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationEvent" (
    "id" TEXT NOT NULL,
    "migrationId" TEXT NOT NULL,
    "phase" "MigrationPhase",
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MigrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailboxMigration_status_idx" ON "MailboxMigration"("status");

-- CreateIndex
CREATE INDEX "MailboxMigration_mailboxId_idx" ON "MailboxMigration"("mailboxId");

-- CreateIndex
CREATE INDEX "MailboxMigration_organizationId_idx" ON "MailboxMigration"("organizationId");

-- CreateIndex
CREATE INDEX "MigrationEvent_migrationId_createdAt_idx" ON "MigrationEvent"("migrationId", "createdAt");

-- AddForeignKey
ALTER TABLE "MailboxMigration" ADD CONSTRAINT "MailboxMigration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxMigration" ADD CONSTRAINT "MailboxMigration_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationEvent" ADD CONSTRAINT "MigrationEvent_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "MailboxMigration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
