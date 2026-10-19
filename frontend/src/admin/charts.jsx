import { useState } from 'react';
import { num, pct, shortDate, change } from './format.js';

// Chart colours (checked for colour-blind safety): plum and amber. Text uses the normal text colours.
export const PLUM = '#9B4F96';
export const AMBER = '#D07A2E';
const SURFACE = '#ffffff';

// ---------- a headline number ----------
export function Tile({ label, value, sub, now, before, upIsGood = true, format = num, hint, points = false }) {
  // With very little to compare against, a percentage is misleading ("up 5400%"), so say it is new instead.
  const tiny = !points && typeof now === 'number' && typeof before === 'number' && before < 5 && now !== before;
  // Rates are compared in percentage points (38% vs 25% = up 13 points), counts as a percentage change.
  const c = points
    ? (typeof now === 'number' && typeof before === 'number' ? now - before : null)
    : typeof now === 'number' && !tiny ? change(now, before) : null;
  const size = points && c !== null ? Math.round(Math.abs(c) * 100) + ' pts' : c !== null ? pct(Math.abs(c)) : '';
  const good = c === null || c === 0 ? null : (c > 0) === upIsGood;
  return (
    <div className="ad-tile" title={hint}>
      <span className="ad-tile-label">{label}</span>
      <span className="ad-tile-value">{value ?? format(now)}</span>
      <span className="ad-tile-foot">
        {c !== null && (
          <span className={'ad-delta ' + (c === 0 ? 'flat' : good ? 'good' : 'bad')}>
            <span aria-hidden="true">{c === 0 ? '■' : c > 0 ? '▲' : '▼'}</span> {c === 0 || size === '0 pts' ? 'No change' : (c > 0 ? 'Up ' : 'Down ') + size}
          </span>
        )}
        {tiny && <span className="ad-delta flat">{before === 0 ? 'New' : `Was ${before} before`}</span>}
        {sub && <span className="ad-sub">{sub}</span>}
      </span>
    </div>
  );
}

// ---------- a line over time, with a hover readout and a table view ----------
function niceMax(max) {
  if (max <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const m = max / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

export function LineChart({ title, data, color = PLUM, unit = '' }) {
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);
  const W = 640, H = 220, L = 40, R = 14, T = 14, B = 26;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const x = (i) => L + (data.length <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (data.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const line = data.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d.value).toFixed(1)).join(' ');
  const area = data.length > 1 ? line + ` L${x(data.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z` : '';
  const ticks = [0, 1, 2, 3, 4].map((k) => (max * k) / 4);
  const total = data.reduce((a, d) => a + d.value, 0);
  const peak = data.reduce((a, d) => (d.value > a.value ? d : a), data[0] || { value: 0, date: '' });
  const last = data[data.length - 1];

  const move = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = data.length <= 1 ? 0 : Math.round(((px - L) / (W - L - R)) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };
  const h = hover !== null ? data[hover] : null;

  return (
    <figure className="ad-card ad-chart">
      <figcaption className="ad-chart-head">
        <span className="ad-h3">{title}</span>
        <button className="ad-link" onClick={() => setTable(!table)}>{table ? 'View chart' : 'View as table'}</button>
      </figcaption>
      {table ? (
        <div className="ad-table-wrap" style={{ maxHeight: 220 }}>
          <table className="ad-table"><thead><tr><th>Day</th><th className="r">{title}</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.date}><td>{shortDate(d.date)}</td><td className="r">{num(d.value)}</td></tr>)}</tbody></table>
        </div>
      ) : (
        <div className="ad-plot">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${num(total)} in total, busiest day ${peak.date ? shortDate(peak.date) : 'none'} with ${num(peak.value)}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e6e1dc" strokeWidth="1" />
                <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6b6b6b">{t >= 1000 ? t / 1000 + 'K' : Math.round(t * 10) / 10}</text>
              </g>
            ))}
            {data.length > 0 && <text x={L} y={H - 6} fontSize="11" fill="#6b6b6b">{shortDate(data[0].date)}</text>}
            {data.length > 2 && <text x={x((data.length - 1) / 2)} y={H - 6} fontSize="11" fill="#6b6b6b" textAnchor="middle">{shortDate(data[Math.floor((data.length - 1) / 2)].date)}</text>}
            {data.length > 1 && <text x={W - R} y={H - 6} fontSize="11" fill="#6b6b6b" textAnchor="end">{shortDate(last.date)}</text>}
            {area && <path d={area} fill={color} opacity="0.1" />}
            {data.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
            {last && <circle cx={x(data.length - 1)} cy={y(last.value)} r="4" fill={color} stroke={SURFACE} strokeWidth="2" />}
            {h && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#9a948e" strokeWidth="1" />
                <circle cx={x(hover)} cy={y(h.value)} r="5" fill={color} stroke={SURFACE} strokeWidth="2" />
              </g>
            )}
            <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)} />
          </svg>
          {h && (
            <div className="ad-tip" style={{ left: Math.min(78, Math.max(8, (x(hover) / W) * 100)) + '%' }}>
              <b>{shortDate(h.date)}</b><span>{num(h.value)}{unit}</span>
            </div>
          )}
        </div>
      )}
      <div className="ad-chart-foot">{num(total)} in total · busiest day {peak.date ? shortDate(peak.date) : '–'} ({num(peak.value)})</div>
    </figure>
  );
}

// ---------- horizontal bars: one hue, value at the tip, small groups hidden ----------
export function BarList({ rows, empty = 'Nothing to show yet.', total, color = PLUM }) {
  const shown = rows.filter((r) => r.value !== undefined);
  if (!shown.length) return <p className="ad-empty">{empty}</p>;
  const max = Math.max(1, ...shown.map((r) => r.value || 0));
  return (
    <ul className="ad-bars">
      {shown.map((r) => (
        <li key={r.key || r.label} title={r.small ? 'Fewer than 5 people, so the number is hidden' : num(r.value)}>
          <span className="ad-bar-label">{r.label}</span>
          <span className="ad-bar-track">
            {!r.small && <span className="ad-bar" style={{ width: Math.max(2, ((r.value || 0) / max) * 100) + '%', background: color }} />}
          </span>
          <span className="ad-bar-value">
            {r.small ? <span className="ad-muted">&lt;5</span> : num(r.value)}
            {!r.small && total ? <span className="ad-muted"> · {pct(r.value / total)}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------- the funnel: each step as a share of the first, and of the step before ----------
export function Funnel({ steps }) {
  const first = steps[0]?.count || 0;
  return (
    <ol className="ad-funnel">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].count : null;
        return (
          <li key={s.key}>
            <div className="ad-funnel-top">
              <span className="ad-funnel-label">{s.label}</span>
              <span className="ad-funnel-num">{num(s.count)}</span>
            </div>
            <span className="ad-bar-track tall"><span className="ad-bar" style={{ width: first ? Math.max(1, (s.count / first) * 100) + '%' : '0%', background: PLUM }} /></span>
            <span className="ad-funnel-sub">
              {first ? pct(s.count / first) + ' of visitors' : ''}
              {prev ? ' · ' + pct(prev ? Math.min(1, s.count / prev) : 0) + ' of the step before' : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
