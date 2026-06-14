/**
 * Boîtes partagées Framm × Stalwart
 *
 * Stalwart ne propose pas de délégation native type Google Workspace / M365
 * (plusieurs utilisateurs, même store IMAP, sans credentials partagés côté client).
 *
 * Modèle Framm :
 * - 1 compte Stalwart (`x:Account`) par boîte partagée
 * - Mot de passe chiffré (`credentialsEnc`) — SSO webmail via proxy JMAP Framm
 * - `SharedMailboxMember` : utilisateurs autorisés ; tous voient le même store JMAP
 *
 * Limite : l'accès hors Framm (client mail tiers) n'est pas prévu pour les membres ;
 * ils passent par `/dashboard/mail/[mailboxId]`.
 */

export const SHARED_MAILBOX_STALWART_NOTES = "shared-mailbox-stalwart" as const;
