-- Quota boîte mail optionnel : null = pas de limite configurée
ALTER TABLE "Mailbox" ALTER COLUMN "quotaBytes" DROP NOT NULL;
ALTER TABLE "Mailbox" ALTER COLUMN "quotaBytes" DROP DEFAULT;

-- Les boîtes créées avec la valeur par défaut (1 Go) n'avaient pas de limite explicite
UPDATE "Mailbox" SET "quotaBytes" = NULL WHERE "quotaBytes" = 1073741824;
