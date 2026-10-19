// Tests for the anonymous tracking helper and the plan summary sent with a saved plan.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { evaluate } from '../evaluate.js';
import { outcomeSummary } from '../outcome.js';

// A tiny stand-in for the browser, because these tests run in Node.
function fakeBrowser({ dnt = null, gpc = false, search = '', referrer = '', path = '/' } = {}) {
  const store = new Map();
  const sent = [];
  globalThis.sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  globalThis.window = { innerWidth: 390, location: { pathname: path, search, hostname: 'closahealth.com' }, doNotTrack: dnt, crypto: globalThis.crypto };
  globalThis.document = { referrer };
  Object.defineProperty(globalThis, 'navigator', { value: { doNotTrack: dnt, globalPrivacyControl: gpc }, configurable: true });
  globalThis.fetch = vi.fn((url, opts) => { sent.push({ url, body: JSON.parse(opts.body) }); return Promise.resolve({}); });
  return { sent, store };
}

async function load() {
  vi.resetModules();
  return import('../track.js');
}

describe('anonymous tracking', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends a random code and the device size with every event', async () => {
    const { sent } = fakeBrowser();
    const t = await load();
    t.track('cta_click', { source: 'hero' });
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/api/events');
    expect(sent[0].body).toMatchObject({ name: 'cta_click', source: 'hero', device: 'm' });
    expect(sent[0].body.sid).toMatch(/^[A-Za-z0-9]{20}$/);
  });

  it('uses the same code for the whole visit, and a new one for a new visit', async () => {
    const a = fakeBrowser();
    const t = await load();
    t.track('cta_click'); t.track('email_view');
    expect(a.sent[0].body.sid).toBe(a.sent[1].body.sid);
    const b = fakeBrowser();
    const t2 = await load();
    t2.track('cta_click');
    expect(b.sent[0].body.sid).not.toBe(a.sent[0].body.sid);
  });

  it('never sends an email, name or answer', async () => {
    const { sent } = fakeBrowser();
    const t = await load();
    t.startSession(); t.track('question_view', { step: 'Q1' });
    const text = JSON.stringify(sent);
    expect(text).not.toContain('@');
    expect(text).not.toContain('"email"');
    expect(text).not.toContain('"answers"');
    expect(text).not.toContain('"token"');
  });

  it('counts a visit once, with campaign tags and the referring site', async () => {
    const { sent } = fakeBrowser({ search: '?utm_source=instagram&utm_medium=paid&utm_campaign=launch', referrer: 'https://l.instagram.com/x?y=1' });
    const t = await load();
    t.startSession(); t.startSession();
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toMatchObject({ name: 'session_start', utm_source: 'instagram', utm_medium: 'paid', utm_campaign: 'launch', referrer: 'l.instagram.com' });
  });

  it('ignores the site itself as a referrer', async () => {
    const { sent } = fakeBrowser({ referrer: 'https://closahealth.com/privacy' });
    const t = await load();
    t.startSession();
    expect(sent[0].body.referrer).toBeUndefined();
  });

  it.each([['Do Not Track', { dnt: '1' }], ['Global Privacy Control', { gpc: true }]])('sends nothing when %s is on', async (_n, opts) => {
    const { sent } = fakeBrowser(opts);
    const t = await load();
    t.startSession(); t.track('cta_click');
    expect(sent).toHaveLength(0);
  });

  it('sends nothing from the dashboard pages', async () => {
    const { sent } = fakeBrowser({ path: '/admin' });
    const t = await load();
    t.track('cta_click');
    expect(sent).toHaveLength(0);
  });

  it('still works if the browser blocks session storage, and never throws if the network fails', async () => {
    fakeBrowser();
    globalThis.sessionStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')));
    const t = await load();
    expect(() => { t.track('cta_click'); t.startSession(); }).not.toThrow();
    expect(t.getSid()).toBe(t.getSid());
  });

  it('maps screen widths to phone, tablet and computer', async () => {
    fakeBrowser();
    const t = await load();
    window.innerWidth = 699; expect(t.deviceCode()).toBe('m');
    window.innerWidth = 700; expect(t.deviceCode()).toBe('t');
    window.innerWidth = 1024; expect(t.deviceCode()).toBe('d');
  });
});

describe('plan summary for the dashboard', () => {
  const answers = { Q0: ['none'], Q1: ['pain', 'heavy'], Q2: '20_34', Q3: 'no', Q4: 'none', Q5: 'regular', Q7: ['change_1_2h', 'clots'], Q8: ['fatigue'], Q9: ['none'], Q10: 'severe', Q11: ['worsening', 'deep_sex_pain'], Q12: ['none'], Q14: ['none'], Q15: ['told_normal'], Q16: 'within_12m' };

  it('contains only the outcome, never the answers', () => {
    const o = outcomeSummary(evaluate(answers));
    expect(Object.keys(o).sort()).toEqual(['flags', 'safety', 'tests', 'urgency', 'who']);
    expect(o.urgency).toBe(4);
    expect(o.flags).toEqual(expect.arrayContaining(['F-HMB', 'F-ENDO', 'F-ANAEMIA']));
    expect(o.who.length).toBeGreaterThan(0);
    expect(o.tests).toEqual(expect.arrayContaining(['T-FBC']));
    expect(JSON.stringify(o)).not.toMatch(/Q\d|clots|20_34/);
  });

  it('records safety screens', () => {
    const o = outcomeSummary(evaluate({ ...answers, Q0: ['s2_sudden_pain'] }));
    expect(o.safety).toEqual(['s2_sudden_pain']);
    expect(o.urgency).toBe(1);
    expect(o.who).toContain('emerg');
  });

  it('only uses values the server accepts', () => {
    const o = outcomeSummary(evaluate({ ...answers, Q14: ['sickle_cell'], Q16: 'trying_now', T1: 'gte12m', T2: 'not_done', T3: ['none'] }));
    for (const f of o.flags) expect(f).toMatch(/^F-[A-Z]{2,12}$/);
    for (const t of o.tests) expect(t).toMatch(/^T-[A-Z]{2,12}$/);
    for (const w of o.who) expect(['gp', 'gyn', 'lab', 'haem', 'fp', 'fert', 'emerg']).toContain(w);
  });
});
