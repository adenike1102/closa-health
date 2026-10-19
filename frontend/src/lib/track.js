// Anonymous usage statistics. A random code is made for each browser tab (kept in sessionStorage, so it
// disappears when the tab is closed). It is never linked to an email, a name or an answer.
// Nothing is sent if the visitor has "Do Not Track" or "Global Privacy Control" switched on.

const SID_KEY = 'closa:sid';
const STARTED_KEY = 'closa:started';
let memorySid = null; // used only if the browser blocks sessionStorage

function randomCode(length = 20) {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(length);
  (window.crypto || { getRandomValues: (a) => a.forEach((_, i) => (a[i] = Math.floor(Math.random() * 256))) }).getRandomValues(bytes);
  return Array.from(bytes, (b) => letters[b % letters.length]).join('');
}

export function getSid() {
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = randomCode();
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch (e) {
    return (memorySid ||= randomCode());
  }
}

export const trackingAllowed = () =>
  navigator.doNotTrack !== '1' && window.doNotTrack !== '1' && navigator.globalPrivacyControl !== true;

// m = phone, t = tablet, d = desktop (same breakpoints as the design)
export const deviceCode = () => (window.innerWidth < 700 ? 'm' : window.innerWidth < 1024 ? 't' : 'd');

// Fire and forget: a tracking problem must never get in the way of the page.
export function track(name, detail = {}) {
  if (!trackingAllowed() || window.location.pathname.startsWith('/admin')) return;
  try {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sid: getSid(), device: deviceCode(), ...detail }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) { /* ignore */ }
}

// Counts the visit once per tab, with where it came from (campaign tags or the referring site).
export function startSession() {
  try {
    if (sessionStorage.getItem(STARTED_KEY)) return;
    sessionStorage.setItem(STARTED_KEY, '1');
  } catch (e) { /* storage blocked: it may be counted again, which is harmless */ }
  const q = new URLSearchParams(window.location.search);
  let referrer;
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    referrer = host && host !== window.location.hostname ? host : undefined;
  } catch (e) { /* ignore */ }
  track('session_start', {
    utm_source: q.get('utm_source') || undefined,
    utm_medium: q.get('utm_medium') || undefined,
    utm_campaign: q.get('utm_campaign') || undefined,
    referrer,
  });
}
