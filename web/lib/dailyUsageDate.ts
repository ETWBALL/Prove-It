/**
 * Helpers for `DailyUsage.date` — PostgreSQL `DATE` stored as UTC calendar day (`@db.Date`).
 *
 * Use `utcCalendarDate()` when upserting by “today” so the value matches the DB default and
 * `@@unique([privateUserId, date])` lookups stay stable across regions.
 */

/** UTC midnight for the given instant’s calendar date (safe to pass to Prisma for `@db.Date`). */
export function utcCalendarDate(from: Date = new Date()): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0)
  );
}
