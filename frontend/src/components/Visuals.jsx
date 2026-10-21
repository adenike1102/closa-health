import { Deco } from './Icons.jsx';
import { useMode } from '../lib/useMode.js';
import { HERO_PHOTO } from '../lib/data.js';

// Hero artwork and the five small looping animations on the landing page.
// Animations are plain CSS keyframes (see styles.css) and switch off for prefers-reduced-motion.

const anim = (name, dur, delay = 0) => `${name} ${dur}s ease-in-out ${delay}s infinite`;

// The arched photo frame with floating chips and a sample plan card on top.
// No photo has been supplied yet, so it shows a soft placeholder. To add one, see HERO_PHOTO in lib/data.js.
export function HeroVisual() {
  const chips = [
    ['c1', 'Energy back', 5.5, 0],
    ['c2', 'Plans, not pains', 6.2, 0.8],
    ['c3', 'No more surprises', 5.8, 1.6],
    ['c4', 'Ready for baby', 6.6, 0.4],
    ['c5', 'Girl boss all round', 6, 1.2],
  ];
  const rows = [['Who to see', 'A gynaecologist'], ['Ask for', 'A pelvic scan'], ['How soon', 'Within 4–6 weeks']];
  return (
    <div className="arch-wrap">
      <div className="arch">
        {HERO_PHOTO
          ? <img src={HERO_PHOTO.src} alt={HERO_PHOTO.alt} width={HERO_PHOTO.width} height={HERO_PHOTO.height} fetchpriority="high" decoding="async" />
          : <div className="ph" aria-hidden="true"><Deco size={260} color="#D8C6D1" stroke={4} style={{ position: 'static' }} /></div>}
      </div>
      <div className="hero-over" aria-hidden="true">
        {chips.map(([c, t, d, dl]) => <span key={t} className={'hchip ' + c} style={{ animation: anim('clFloat', d, dl) }}>{t}</span>)}
        <div className="hplan" style={{ animation: anim('clFloat', 6.5, 0.3) }}>
          <div className="hplan-top"><span>Your care plan</span><span className="hplan-dot" /></div>
          {rows.map(([k, v], i) => (
            <div key={k} className="hplan-row" style={{ animation: anim('clRow', 6, i * 0.5) }}><small>{k}</small><b>{v}</b></div>
          ))}
        </div>
      </div>
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

// 03 What to ask for: chat bubble + typing dots
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

// 05 A summary for your doctor: a floating document
const Summary = () => (
  <div style={{ width: 104, background: '#F7F6F2', borderRadius: 12, padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 7, boxShadow: '0 10px 24px rgba(74,37,69,.15)', animation: anim('clFloat', 5) }}>
    <span style={{ width: 40, height: 6, borderRadius: 3, background: '#4A2545' }} />
    {[78, 64, 72, 46].map((w, i) => <span key={i} style={{ width: w, height: 5, borderRadius: 3, background: '#D8C6D1', animation: anim('clRow', 4.8, i * 0.4) }} />)}
  </div>
);

export const GETS = [
  { n: '01', t: 'What it may point to', d: 'Possible causes in plain words, and the answers that led to each one.', bg: '#EFE6EB', visual: <Point /> },
  { n: '02', t: 'Who to see, and how soon', d: 'The right kind of doctor for your symptoms, and whether you should go this week or book a routine appointment.', bg: '#E7DCE4', visual: <Who /> },
  { n: '03', t: 'What to ask for', d: 'The tests and questions to take to your appointment, and when to do each test.', bg: '#F0E7DD', visual: <Ask /> },
  { n: '04', t: 'What to watch for', d: 'The warning signs that mean you should get help quickly.', bg: '#E4E8E1', visual: <Watch /> },
  { n: '05', t: 'A summary for your doctor', d: 'Your story, already written in the words doctors use, so you’re heard from the first minute.', bg: '#EFE6EB', visual: <Summary /> },
];

export { useMode };
