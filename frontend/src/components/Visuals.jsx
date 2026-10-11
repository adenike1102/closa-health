import { useMode } from '../lib/useMode.js';

// Hero illustration and the four small looping animations on the landing page.
// Animations are plain CSS keyframes (see styles.css) and switch off for prefers-reduced-motion.

const anim = (name, dur, delay = 0) => `${name} ${dur}s ease-in-out ${delay}s infinite`;

export function HeroVisual() {
  const m = useMode() === 'm';
  const chips = m
    ? [
        { t: 'Painful periods', s: { left: '2%', top: '2%' }, d: 5.5, dl: 0 },
        { t: 'Heavy periods', s: { right: '2%', top: '9%' }, d: 6.2, dl: 0.8 },
        { t: 'Irregular periods', s: { left: '4%', bottom: '8%' }, d: 5.8, dl: 1.6 },
        { t: 'Missing periods', s: { right: '2%', bottom: '1%' }, d: 7, dl: 1.2 },
      ]
    : [
        { t: 'Painful periods', s: { left: '0%', top: '10%' }, d: 5.5, dl: 0 },
        { t: 'Heavy periods', s: { right: '0%', top: '20%' }, d: 6.2, dl: 0.8 },
        { t: 'Irregular periods', s: { left: '2%', bottom: '18%' }, d: 5.8, dl: 1.6 },
        { t: 'Missing periods', s: { right: '4%', bottom: '8%' }, d: 6.6, dl: 0.4 },
      ];
  const rows = ['What it may point to', 'Who to see', 'What to ask', 'What to watch for'];
  const tints = ['#EFE6EB', '#E7DCE4', '#F0E7DD', '#E4E8E1'];
  const mark = m ? 300 : 400;
  return (
    <div className="hv" aria-hidden="true">
      <div className="hv-circle" />
      <svg className="hv-mark" width={mark} height={mark} viewBox="0 0 180 180" fill="none" stroke="#D8C6D1" strokeWidth="5">
        <path d="M40 70A62 62 0 1 1 40 110" /><path d="M0 90h90" />
      </svg>
      <div className="hv-center">
        <div className="hv-card">
          <div className="hv-card-head">
            <span>Your care plan</span>
            <img src="/brand/app-icon-aubergine.png" alt="" width="24" height="24" style={{ borderRadius: 7 }} />
          </div>
          {rows.map((r, i) => (
            <div key={r} className="hv-row" style={{ background: tints[i] }}><i>{i + 1}</i>{r}</div>
          ))}
        </div>
      </div>
      {chips.map((c) => (
        <span key={c.t} className="hv-chip" style={{ ...c.s, animation: anim('clFloat', c.d, c.dl) }}>{c.t}</span>
      ))}
    </div>
  );
}

// 01 What it may point to: pulsing rings
const Point = () => (
  <div style={{ position: 'relative', width: 96, height: 96 }}>
    {[0, 1.2].map((dl) => (
      <span key={dl} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #4A2545', animation: `clPulse 2.4s ease-out ${dl}s infinite` }} />
    ))}
    <span style={{ position: 'absolute', inset: 30, borderRadius: '50%', background: '#4A2545' }} />
    <span style={{ position: 'absolute', inset: 42, borderRadius: '50%', background: '#F7F6F2' }} />
  </div>
);

// 02 Who to see: bobbing map pin
const Who = () => (
  <div style={{ position: 'relative', width: 96, height: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
    <div style={{ animation: anim('clBob', 2.2) }}>
      <svg width="52" height="64" viewBox="0 0 52 64">
        <path d="M26 2C13 2 3 12 3 25c0 17 23 37 23 37s23-20 23-37C49 12 39 2 26 2z" fill="#4A2545" />
        <circle cx="26" cy="24" r="9" fill="#F7F6F2" />
      </svg>
    </div>
    <span style={{ width: 40, height: 8, borderRadius: '50%', background: '#4A2545', marginTop: 8, animation: anim('clShadow', 2.2) }} />
  </div>
);

// 03 What to ask: chat bubble + typing dots
const Ask = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
    <div style={{ background: '#F7F6F2', borderRadius: '16px 16px 16px 4px', padding: '8px 14px', fontSize: 13, color: '#4A2545', fontWeight: 500 }}>Which tests do I need?</div>
    <div style={{ alignSelf: 'flex-end', background: '#4A2545', borderRadius: '16px 16px 4px 16px', padding: '12px 16px', display: 'flex', gap: 6 }}>
      {[0, 0.15, 0.3].map((dl) => (
        <span key={dl} style={{ width: 8, height: 8, borderRadius: '50%', background: '#F7F6F2', animation: anim('clDot', 1.2, dl) }} />
      ))}
    </div>
  </div>
);

// 04 What to watch for: calendar cells filling
const Watch = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,16px)', gap: 6 }}>
    {Array.from({ length: 14 }, (_, i) => (
      <span key={i} style={{ width: 16, height: 16, borderRadius: 5, background: '#F7F6F2', animation: [1, 2, 3, 8, 9, 12].includes(i) ? anim('clFill', 4.8, i * 0.18) : 'none' }} />
    ))}
  </div>
);

export const GETS = [
  { n: '01', t: 'What it may point to', d: 'Possible causes in plain language, with the answers that led to each one.', bg: '#EFE6EB', visual: <Point /> },
  { n: '02', t: 'Who to see', d: 'The right kind of clinician, how soon to be seen, and providers near you.', bg: '#E7DCE4', visual: <Who /> },
  { n: '03', t: 'What to ask', d: 'The tests and questions to take to your appointment, plus a summary for your doctor.', bg: '#F0E7DD', visual: <Ask /> },
  { n: '04', t: 'What to watch for', d: 'What to track, and the warning signs that need urgent care.', bg: '#E4E8E1', visual: <Watch /> },
];
