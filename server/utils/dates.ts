/**
 * Parse a YYYY-MM-DD date string as noon UTC.
 *
 * Due dates are calendar dates, not moments in time. Storing at noon UTC
 * ensures the date displays correctly in any timezone from UTC-12 to UTC+11.
 * (new Date("YYYY-MM-DD") defaults to midnight UTC, which shifts backward
 * by one day in timezones west of UTC.)
 */
export const parseDateOnly = (dateStr: string): Date => {
  return new Date(`${dateStr}T12:00:00.000Z`);
};
