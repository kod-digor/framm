export type MigrationMailStats = {
  available: boolean;
  messageCount?: number;
  folderCount?: number;
  /** Messages avec pièce jointe (souvent une estimation API). */
  attachmentCount?: number;
  attachmentCountIsEstimate?: boolean;
  unavailableReason?: string;
};

export type MigrationContactsStats = {
  available: boolean;
  contactCount?: number;
  groupCount?: number;
  unavailableReason?: string;
};

export type MigrationCalendarStats = {
  available: boolean;
  /** Séries et événements ponctuels (hors instances récurrentes développées). */
  eventCount?: number;
  /** Séries avec règle de récurrence. */
  recurringCount?: number;
  firstEventDate?: string;
  lastEventDate?: string;
  /** Plage d'activité courante (hors anniversaires anciens / expansions lointaines). */
  activityFirstEventDate?: string;
  activityLastEventDate?: string;
  unavailableReason?: string;
};

export type MigrationSourceStats = {
  mail: MigrationMailStats;
  contacts: MigrationContactsStats;
  calendar: MigrationCalendarStats;
  discoveredAt: string;
};

export function parseSourceStatsJson(value: unknown): MigrationSourceStats | null {
  if (!value || typeof value !== "object") return null;
  const s = value as MigrationSourceStats;
  if (!s.mail || !s.contacts || !s.calendar || !s.discoveredAt) return null;
  return s;
}
