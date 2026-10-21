// Small inline line icons (1.6-1.8 stroke, aubergine) used across the screens.

const base = { fill: 'none', 'aria-hidden': true };

export const Arrow = ({ color = '#F7F6F2' }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...base} stroke={color} strokeWidth="1.8"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
);
export const Check = ({ size = 12, color = '#F7F6F2' }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" {...base} stroke={color} strokeWidth="2"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>
);
export const Back = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" {...base} stroke="#1A1A1A" strokeWidth="1.8"><path d="M12 4l-6 6 6 6" /></svg>
);
export const Lock = ({ color = '#4A2545', size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" {...base} stroke={color} strokeWidth="1.6"><rect x="4" y="9" width="12" height="8" rx="2" /><path d="M7 9V6a3 3 0 0 1 6 0v3" /></svg>
);
export const Info = ({ color = '#4A2545', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" {...base} stroke={color} strokeWidth="1.6"><circle cx="10" cy="10" r="7" /><path d="M10 9v5M10 6.5v.5" /></svg>
);
export const Warn = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" {...base} stroke="#1A1A1A" strokeWidth="1.7"><path d="M11 3l9 16H2z" /><path d="M11 9v4.5M11 16v.5" /></svg>
);
export const Upload = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" {...base} stroke="#4A2545" strokeWidth="1.6"><path d="M14 19V6M8.5 11.5L14 6l5.5 5.5M6 21h16" /></svg>
);
export const FileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" {...base} stroke="#4A2545" strokeWidth="1.6"><path d="M4 2h7l3 3v11H4z" /></svg>
);

// Plan section icons (26px, in a 52px circle)
const S = ({ children }) => (
  <svg width="26" height="26" viewBox="0 0 26 26" {...base} stroke="#4A2545" strokeWidth="1.7">{children}</svg>
);
export const PlanIcons = {
  soon: <S><circle cx="13" cy="14" r="9" /><path d="M13 9v5l3 2M10 2h6" /></S>,
  preg: <S><rect x="9" y="3" width="8" height="20" rx="4" /><path d="M11 9h4M11 13h4" /></S>,
  point: <S><circle cx="13" cy="13" r="9" /><path d="M3 13h10" /><circle cx="13" cy="13" r="2" fill="#4A2545" /></S>,
  who: <S><circle cx="13" cy="9" r="4" /><path d="M5 22c1-4.5 4.3-7 8-7s7 2.5 8 7" /></S>,
  tests: <S><path d="M10 3h6M11 3v7l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" /><path d="M8 16h10" /></S>,
  ask: <S><path d="M4 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 4v-4H6a2 2 0 0 1-2-2z" /><path d="M10.5 9a2.5 2.5 0 1 1 3.2 2.4c-.5.2-.7.6-.7 1.1M13 15v.3" /></S>,
  self: <S><path d="M13 22s-8-4.6-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 21 11c0 6.4-8 11-8 11z" /></S>,
  ttc: <S><path d="M13 22V12" /><path d="M13 13c0-4 3-7 7-7 0 4-3 7-7 7zM13 15c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z" /></S>,
  summary: <S><path d="M7 3h9l4 4v16H7z" /><path d="M16 3v4h4M10 12h7M10 16h7M10 20h4" /></S>,
};

// The Closa mark drawn as a big decorative outline behind dark panels.
export const Deco = ({ size, color = '#5c3557', stroke = 5, style }) => (
  <svg className="deco" width={size} height={size} viewBox="0 0 180 180" {...base} stroke={color} strokeWidth={stroke} style={style}>
    <path d="M40 70A62 62 0 1 1 40 110" /><path d="M0 90h90" /><circle cx="90" cy="90" r="9" fill={color} stroke="none" />
  </svg>
);

// Landing-page extras
export const Triangle = ({ color = '#4A2545', size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" {...base} stroke={color} strokeWidth="1.6"><path d="M11 3l9 16H2z" /><path d="M11 9v4.5M11 16v.5" /></svg>
);
export const CardSlash = ({ color = '#4A2545', size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" {...base} stroke={color} strokeWidth="1.6"><rect x="2.5" y="5" width="17" height="12" rx="2" /><path d="M2.5 9.5h17M4 19L18 3" /></svg>
);
export const PlusMinus = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" {...base} stroke="#4A2545" strokeWidth="1.8"><path d="M2 7h10" />{!open && <path d="M7 2v10" />}</svg>
);
