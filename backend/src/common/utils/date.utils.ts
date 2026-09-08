/**
 * Timezone-aware date utilities for Bangladesh Standard Time (UTC+6)
 */

/**
 * Returns the start and end of the day in UTC for a given date in Asia/Dhaka timezone.
 * @param date Optional date object, defaults to now.
 */
export function getBDDayRange(date: Date = new Date()) {
  // 1. Get the date string in YYYY-MM-DD format for Bangladesh
  const bdDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  // 2. Create the start and end of that day in Asia/Dhaka
  // Note: We use the YYYY-MM-DD + time + " Asia/Dhaka" parsing if supported,
  // or calculate UTC manually by knowing BD is always UTC+6.
  const [year, month, day] = bdDateStr.split('-').map(Number);

  // Start of day in BD (00:00:00) is UTC-6
  const startUtc = new Date(
    Date.UTC(year, month - 1, day, 0, 0, 0) - 6 * 60 * 60 * 1000,
  );
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  return { startUtc, endUtc };
}

/**
 * Helper to check if a date falls within the Bangladesh "Today" range.
 */
export function isTodayBD(date: Date | string | undefined): boolean {
  if (!date) return false;
  const d = typeof date === 'string' ? new Date(date) : date;
  const { startUtc, endUtc } = getBDDayRange();
  return d >= startUtc && d < endUtc;
}

/**
 * Returns the current date in YYYY-MM-DD format for Asia/Dhaka.
 */
export function getBDTodayString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Checks if a date (or date string) matches the current Bangladesh date (YYYY-MM-DD).
 */
export function isTodayBDDate(date: Date | string | undefined): boolean {
  if (!date) return false;

  const d = typeof date === 'string' ? new Date(date) : date;

  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

  return dateStr === getBDTodayString();
}

export interface BDMonthRange {
  startUtc: Date;
  endUtc: Date;
  startDateStr: string;
  endDateStr: string;
  year: number;
  month: number;
  monthName: string;
  totalDays: number;
}

/**
 * Returns the exact monthly boundary for Bangladesh timezone (1st of month to 28th/30th/31st).
 * @param targetYear Optional year (e.g. 2026). Defaults to current year in BD.
 * @param targetMonth Optional 1-indexed month (1=Jan .. 12=Dec). Defaults to current month in BD.
 */
export function getBDMonthRange(targetYear?: number, targetMonth?: number): BDMonthRange {
  const bdToday = getBDTodayString();
  const [currentYear, currentMonth] = bdToday.split('-').map(Number);

  const year = targetYear ?? currentYear;
  const month = targetMonth ?? currentMonth; // 1-12

  // Total days in target month (handles 28, 29, 30, 31 dynamically)
  const totalDays = new Date(year, month, 0).getDate();

  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;

  // Start of day 1 in BD (00:00:00 BD time = UTC-6)
  const startUtc = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - 6 * 60 * 60 * 1000);
  // End of last day in BD (23:59:59.999 BD time)
  const endUtc = new Date(Date.UTC(year, month - 1, totalDays, 23, 59, 59, 999) - 6 * 60 * 60 * 1000);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return {
    startUtc,
    endUtc,
    startDateStr,
    endDateStr,
    year,
    month,
    monthName: monthNames[month - 1] || `Month ${month}`,
    totalDays,
  };
}

