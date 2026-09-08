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

export interface BDPeriodRange {
  startUtc: Date | null;
  endUtc: Date | null;
  startDateStr: string | null;
  endDateStr: string | null;
  periodStartUtc: Date | null;
  periodEndUtc: Date | null;
  periodStartDateStr: string | null;
  periodEndDateStr: string | null;
  periodLabel: string;
  isAllTime: boolean;
  month?: number;
  year?: number;
  monthName?: string;
  totalDays?: number;
}

/**
 * Returns date range and metadata for a given period in Bangladesh Standard Time.
 */
export function getBDDateRangeForPeriod(
  period: string = 'this_month',
  customYear?: number,
  customMonth?: number,
): BDPeriodRange {
  const bdToday = getBDTodayString();
  const [currentYear, currentMonth] = bdToday.split('-').map(Number);

  if (period === 'today') {
    const { startUtc, endUtc } = getBDDayRange();
    return {
      startUtc,
      endUtc,
      startDateStr: bdToday,
      endDateStr: bdToday,
      periodStartUtc: startUtc,
      periodEndUtc: endUtc,
      periodStartDateStr: bdToday,
      periodEndDateStr: bdToday,
      periodLabel: 'আজকের হিসাব (Today)',
      isAllTime: false,
      year: currentYear,
      month: currentMonth,
      totalDays: 1,
    };
  }

  if (period === 'last_7_days') {
    const { endUtc } = getBDDayRange();
    const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(sevenDaysAgo);
    const [sYear, sMonth, sDay] = sevenDaysAgoStr.split('-').map(Number);
    const startUtc = new Date(Date.UTC(sYear, sMonth - 1, sDay, 0, 0, 0) - 6 * 60 * 60 * 1000);
    return {
      startUtc,
      endUtc,
      startDateStr: sevenDaysAgoStr,
      endDateStr: bdToday,
      periodStartUtc: startUtc,
      periodEndUtc: endUtc,
      periodStartDateStr: sevenDaysAgoStr,
      periodEndDateStr: bdToday,
      periodLabel: 'বিগত ৭ দিন (Last 7 Days)',
      isAllTime: false,
      year: currentYear,
      month: currentMonth,
      totalDays: 7,
    };
  }

  if (period === 'last_month') {
    let targetMonth = currentMonth - 1;
    let targetYear = currentYear;
    if (targetMonth < 1) {
      targetMonth = 12;
      targetYear -= 1;
    }
    const monthRange = getBDMonthRange(targetYear, targetMonth);
    return {
      startUtc: monthRange.startUtc,
      endUtc: monthRange.endUtc,
      startDateStr: monthRange.startDateStr,
      endDateStr: monthRange.endDateStr,
      periodStartUtc: monthRange.startUtc,
      periodEndUtc: monthRange.endUtc,
      periodStartDateStr: monthRange.startDateStr,
      periodEndDateStr: monthRange.endDateStr,
      periodLabel: `${monthRange.monthName} ${monthRange.year}`,
      isAllTime: false,
      month: monthRange.month,
      year: monthRange.year,
      monthName: monthRange.monthName,
      totalDays: monthRange.totalDays,
    };
  }

  if (period === 'this_year') {
    const startUtc = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0) - 6 * 60 * 60 * 1000);
    const endUtc = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999) - 6 * 60 * 60 * 1000);
    const startDateStr = `${currentYear}-01-01`;
    const endDateStr = `${currentYear}-12-31`;
    return {
      startUtc,
      endUtc,
      startDateStr,
      endDateStr,
      periodStartUtc: startUtc,
      periodEndUtc: endUtc,
      periodStartDateStr: startDateStr,
      periodEndDateStr: endDateStr,
      periodLabel: `${currentYear} সাল (This Year)`,
      isAllTime: false,
      year: currentYear,
    };
  }

  if (period === 'custom' && customYear && customMonth) {
    const monthRange = getBDMonthRange(customYear, customMonth);
    return {
      startUtc: monthRange.startUtc,
      endUtc: monthRange.endUtc,
      startDateStr: monthRange.startDateStr,
      endDateStr: monthRange.endDateStr,
      periodStartUtc: monthRange.startUtc,
      periodEndUtc: monthRange.endUtc,
      periodStartDateStr: monthRange.startDateStr,
      periodEndDateStr: monthRange.endDateStr,
      periodLabel: `${monthRange.monthName} ${monthRange.year}`,
      isAllTime: false,
      month: monthRange.month,
      year: monthRange.year,
      monthName: monthRange.monthName,
      totalDays: monthRange.totalDays,
    };
  }

  if (period === 'all_time') {
    return {
      startUtc: null,
      endUtc: null,
      startDateStr: null,
      endDateStr: null,
      periodStartUtc: null,
      periodEndUtc: null,
      periodStartDateStr: null,
      periodEndDateStr: null,
      periodLabel: 'সকল ইতিহাস (All Time)',
      isAllTime: true,
    };
  }

  // Default: this_month
  const monthRange = getBDMonthRange(currentYear, currentMonth);
  return {
    startUtc: monthRange.startUtc,
    endUtc: monthRange.endUtc,
    startDateStr: monthRange.startDateStr,
    endDateStr: monthRange.endDateStr,
    periodStartUtc: monthRange.startUtc,
    periodEndUtc: monthRange.endUtc,
    periodStartDateStr: monthRange.startDateStr,
    periodEndDateStr: monthRange.endDateStr,
    periodLabel: `${monthRange.monthName} ${monthRange.year}`,
    isAllTime: false,
    month: monthRange.month,
    year: monthRange.year,
    monthName: monthRange.monthName,
    totalDays: monthRange.totalDays,
  };
}


