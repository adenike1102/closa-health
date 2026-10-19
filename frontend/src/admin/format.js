// Small helpers for showing numbers and dates in the dashboard.
export const num = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('en'));
export const pct = (x) => (x === null || x === undefined ? '–' : Math.round(x * 100) + '%');

// Today in Lagos as YYYY-MM-DD (the dashboard works in Lagos days).
export function lagosToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
}

export function addDays(date, days) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function shortDate(date) {
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function longDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }) : '';
}

// Change versus the previous period, as a signed percentage. null when there is nothing to compare.
export function change(now, before) {
  if (before === null || before === undefined || now === null || now === undefined) return null;
  if (before === 0) return now === 0 ? 0 : null;
  return (now - before) / before;
}
