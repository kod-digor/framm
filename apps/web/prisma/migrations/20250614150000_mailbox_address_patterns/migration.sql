-- CreateEnum
CREATE TYPE "MailboxAddressPatternType" AS ENUM ('EXACT', 'WILDCARD_LOCAL', 'WILDCARD_DOMAIN');

-- CreateEnum
CREATE TYPE "MailboxAddressProvisionStatus" AS ENUM ('SYNCED', 'MANUAL');

-- AlterTable
ALTER TABLE "MailboxAddress" ADD COLUMN "patternType" "MailboxAddressPatternType" NOT NULL DEFAULT 'EXACT';
ALTER TABLE "MailboxAddress" ADD COLUMN "provisionStatus" "MailboxAddressProvisionStatus" NOT NULL DEFAULT 'SYNCED';
