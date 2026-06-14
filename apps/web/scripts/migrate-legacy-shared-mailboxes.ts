import { migrateLegacySharedMailboxes } from "../src/lib/mail/migrate-legacy-shared-mailboxes";

async function main() {
  const result = await migrateLegacySharedMailboxes();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
