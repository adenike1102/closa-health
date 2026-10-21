// Reads a cycle-app CSV export and suggests intake answers.
import { arrOf, optOf } from './questions.js';
function parseCycleCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const parseDate = (s) => { let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]); return null; };
  const day = 864e5, now = Date.now();
  const bleed = [], spot = [];
  lines.forEach(l => { const d = parseDate(l); if (!d) return; (/spot/i.test(l) ? spot : bleed).push(+d); });
  const days = [...new Set(bleed)].sort((a, b) => a - b).filter(d => d >= now - 183 * day - 40 * day);
  const starts = days.filter((d, i) => i === 0 || d - days[i - 1] > 2 * day);
  const recent = starts.filter(d => d >= now - 183 * day);
  const daySet = new Set(days);
  const spotting = spot.some(d => !daySet.has(d));
  if (recent.length < 3) return { q5: null, cycles: recent.length, spotting, message: 'We found fewer than 3 periods in the last 6 months, so we can’t suggest an answer. You can still answer yourself.' };
  const gaps = recent.slice(1).map((d, i) => Math.round((d - recent[i]) / day));
  const sorted = [...gaps].sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length / 2)];
  let q5 = 'regular';
  if (now - recent[recent.length - 1] > 90 * day) q5 = 'none_3m';
  else if (med < 24) q5 = 'frequent';
  else if (med > 38) q5 = 'infrequent';
  else if (sorted[sorted.length - 1] - sorted[0] > 7) q5 = 'unpredictable';
  return { q5, cycles: recent.length, spotting, message: 'We found ' + recent.length + ' periods in the last 6 months. Your periods seem to come: ' + optOf('Q5', q5).label.toLowerCase() + '.' };
}
export { parseCycleCsv };
