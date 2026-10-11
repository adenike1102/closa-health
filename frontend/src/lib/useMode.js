import { useEffect, useState } from 'react';

// 'm' (< 700px), 't' (700-1023px) or 'd' (>= 1024px). Only used where CSS alone can't do the job.
const modeFor = (w) => (w < 700 ? 'm' : w < 1024 ? 't' : 'd');

export function useMode() {
  const [mode, setMode] = useState(() => modeFor(window.innerWidth));
  useEffect(() => {
    const onResize = () => setMode(modeFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mode;
}
