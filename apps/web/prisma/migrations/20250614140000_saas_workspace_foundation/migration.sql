-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

-- AlterTable Organization: presentation optional, default APPROVED
ALTER TABLE "Organization" ALTER COLUMN "presentation" DROP NOT NULL;
ALTER TABLE "Organization" ALTER COLUMN "status" SET DEFAULT 'APPROVED';

-- CreateTable OrganizationModule
CREATE TABLE "OrganizationModule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mail" BOOLEAN NOT NULL DEFAULT true,
    "calendar" BOOLEAN NOT NULL DEFAULT false,
    "accounting" BOOLEAN NOT NULL DEFAULT false,
    "members" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable Subscription
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "payplugCustomerId" TEXT,
    "payplugPaymentId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'workspace_starter',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable MailboxAddress
CREATE TABLE "MailboxAddress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "stalwartAliasId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserMailbox
CREATE TABLE "UserMailbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable SharedMailbox
CREATE TABLE "SharedMailbox" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "displayName" TEXT,
    "stalwartAliasId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable SharedMailboxRecipient
CREATE TABLE "SharedMailboxRecipient" (
    "id" TEXT NOT NULL,
    "sharedMailboxId" TEXT NOT NULL,
    "userId" TEXT,
    "mailboxId" TEXT,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedMailboxRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationModule_organizationId_key" ON "OrganizationModule"("organizationId");
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");
CREATE UNIQUE INDEX "MailboxAddress_address_key" ON "MailboxAddress"("address");
CREATE UNIQUE INDEX "MailboxAddress_organizationId_address_key" ON "MailboxAddress"("organizationId", "address");
CREATE UNIQUE INDEX "UserMailbox_userId_mailboxId_key" ON "UserMailbox"("userId", "mailboxId");
CREATE UNIQUE INDEX "SharedMailbox_address_key" ON "SharedMailbox"("address");
CREATE UNIQUE INDEX "SharedMailboxRecipient_sharedMailboxId_email_key" ON "SharedMailboxRecipient"("sharedMailboxId", "email");

-- AddForeignKey
ALTER TABLE "OrganizationModule" ADD CONSTRAINT "OrganizationModule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailboxAddress" ADD CONSTRAINT "MailboxAddress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailboxAddress" ADD CONSTRAINT "MailboxAddress_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMailbox" ADD CONSTRAINT "UserMailbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMailbox" ADD CONSTRAINT "UserMailbox_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMailbox" ADD CONSTRAINT "UserMailbox_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedMailbox" ADD CONSTRAINT "SharedMailbox_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedMailboxRecipient" ADD CONSTRAINT "SharedMailboxRecipient_sharedMailboxId_fkey" FOREIGN KEY ("sharedMailboxId") REFERENCES "SharedMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedMailboxRecipient" ADD CONSTRAINT "SharedMailboxRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SharedMailboxRecipient" ADD CONSTRAINT "SharedMailboxRecipient_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill modules + subscription for existing orgs
INSERT INTO "OrganizationModule" ("id", "organizationId", "mail", "calendar", "accounting", "members", "updatedAt")
SELECT 'mod_' || "id", "id", true, false, false, false, NOW()
FROM "Organization"
ON CONFLICT ("organizationId") DO NOTHING;

INSERT INTO "Subscription" ("id", "organizationId", "status", "plan", "createdAt", "updatedAt")
SELECT 'sub_' || "id", "id",
  CASE WHEN "status" = 'APPROVED' THEN 'ACTIVE'::"SubscriptionStatus" ELSE 'PENDING_PAYMENT'::"SubscriptionStatus" END,
  'workspace_starter', NOW(), NOW()
FROM "Organization"
ON CONFLICT ("organizationId") DO NOTHING;
