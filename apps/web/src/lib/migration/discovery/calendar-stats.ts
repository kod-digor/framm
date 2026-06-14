/** Plage d'activité affichée : exclut anniversaires très anciens et expansions de récurrence lointaines. */
const ACTIVITY_MIN_YEAR = 1990;
const ACTIVITY_MAX_YEARS_AHEAD = 5;

export function eventStartDate(event: {
  start?: { date?: string; dateTime?: string };
}): string | undefined {
  const start = event.start?.dateTime ?? event.start?.date;
  return start?.slice(0, 10);
}

export function isValidIsoDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

export function isActivityDate(date: string, now = new Date()): boolean {
  if (!isValidIsoDate(date)) return false;
  const year = yearOf(date);
  const maxYear = now.getFullYear() + ACTIVITY_MAX_YEARS_AHEAD;
  return year >= ACTIVITY_MIN_YEAR && year <= maxYear;
}

export function computeCalendarDateRange(
  dates: string[],
  now = new Date()
): {
  firstEventDate?: string;
  lastEventDate?: string;
  activityFirstEventDate?: string;
  activityLastEventDate?: string;
} {
  const valid = [...new Set(dates.filter(isValidIsoDate))].sort();
  if (valid.length === 0) return {};

  const activity = valid.filter((d) => isActivityDate(d, now));

  return {
    firstEventDate: valid[0],
    lastEventDate: valid[valid.length - 1],
    activityFirstEventDate: activity[0] ?? valid[0],
    activityLastEventDate: activity[activity.length - 1] ?? valid[valid.length - 1],
  };
}
