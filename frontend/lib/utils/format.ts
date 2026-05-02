export function formatCurrency(value: number | string) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '৳0.00';
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 2,
  }).format(num);
}

export const toNumber = (value: string | number | null | undefined): number => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
};



export function formatDate(value: string | Date | undefined) {
  if (!value) return '-';
  try {
    const date = typeof value === 'string' ? new Date(value) : value;
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    }).format(date).replace(/ /g, '-').replace(/\//g, '-').toLowerCase();
  } catch (e) {
    return '-';
  }
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const time = new Intl.DateTimeFormat('en-BD', {
    timeZone: 'Asia/Dhaka',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${formatDate(value)}, ${time}`;
}

export function formatNumber(value: number | string) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-BD', {
    maximumFractionDigits: 0,
  }).format(num);
}

export function getTodayBD() {
  // Returns a Date object representing the current point in time.
  // When using this for date calculations (like yesterday), 
  // we must be careful about the local machine timezone.
  return new Date();
}

export function getTodayBDDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function formatBDDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
