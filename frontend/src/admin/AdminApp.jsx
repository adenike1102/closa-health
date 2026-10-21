import { useCallback, useEffect, useState } from 'react';
import './admin.css';
import { adminApi } from './api.js';
import { num, pct, lagosToday, addDays, shortDate, longDate } from './format.js';
import { Tile, LineChart, BarList, Funnel, PLUM, AMBER } from './charts.jsx';
import { QUESTIONS, optOf } from '../lib/questions.js';
import { CONTENT } from '../lib/content.js';
import { GOALS } from '../lib/data.js';

const WHO = { gp: 'GP or general hospital', gyn: 'Gynaecologist', lab: 'Lab or testing clinic', haem: 'Sickle cell or blood clinic', fp: 'Family planning clinic', fert: 'Fertility clinic', emerg: 'Emergency care' };
const SOURCES = { hero: 'Top of the page', nav: 'Menu button', goals: 'After picking goals', example: 'Under the example plan', closing: 'Bottom of the page', symptoms: 'After picking symptoms (old page)' };
// Goal cards on the landing page. The older symptom cards are kept so earlier counts still have a name.
const GOAL = { ...Object.fromEntries(GOALS.map((g) => [g.key, g.name])), pain: 'Painful periods (old card)', heavy: 'Heavy periods (old card)', irregular: 'Irregular or missed periods (old card)', ttc: 'Trying to get pregnant (old card)' };
const DEVICE = { m: 'Phone', t: 'Tablet', d: 'Computer', '?': 'Unknown' };
const TABS = ['Overview', 'Funnel', 'Audience', 'Care plans', 'Engagement', 'Health & future', 'Contacts'];

const q = (id) => (code) => optOf(id, code)?.label || code;
const rowsOf = (list, label) => (list || []).map((r) => ({ key: r.key, label: label(r.key), value: r.count ?? 0, small: r.small }));
const plain = (list, label) => (list || []).map((r) => ({ key: r.key, label: label(r.key), value: r.n }));

// ---------------------------------------------------------------- sign in
function Login({ onDone, off }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await adminApi.login(pw); onDone(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  if (off) {
    return (
      <div className="ad-center"><div className="ad-card ad-login">
        <h1>Dashboard not set up yet</h1>
        <p>Add the two dashboard passwords to <code>api/config.php</code> on your hosting, then reload this page. The steps are in the README.</p>
      </div></div>
    );
  }
  return (
    <div className="ad-center">
      <form className="ad-card ad-login" onSubmit={submit}>
        <img src="/brand/lockup-aubergine.png" alt="Closa Health" height="26" />
        <h1>Dashboard</h1>
        <label className="ad-field"><span>Password</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" autoFocus />
        </label>
        {error && <p className="ad-error" role="alert">{error}</p>}
        <button className="ad-btn" disabled={!pw || busy}>{busy ? 'Checking…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- tabs
function Section({ title, note, children, wide }) {
  return (
    <section className={'ad-card ad-section' + (wide ? ' wide' : '')}>
      <h2 className="ad-h3">{title}</h2>
      {note && <p className="ad-note">{note}</p>}
      {children}
    </section>
  );
}

function Overview({ d }) {
  const c = d.kpis.current, p = d.kpis.previous;
  return (
    <>
      {d.alerts.map((a, i) => <div key={i} className={'ad-alert ' + a.level}><b>{a.level === 'warning' ? '⚠ Needs attention' : 'ℹ Note'}</b> {a.text}</div>)}
      <div className="ad-hero">
        <span className="ad-tile-label">Plans that led to a “Get directions” tap</span>
        <span className="ad-hero-value">{pct(c.care_intent)}</span>
        <span className="ad-sub">Of the people who got a care plan, the share who then took a step toward care. {c.north_sessions} of {c.plan_sessions} this period{p.care_intent !== null ? ` · previous period ${pct(p.care_intent)}` : ''}.</span>
      </div>
      <div className="ad-tiles">
        <Tile label="Visitors" now={c.visitors} before={p.visitors} hint="People who opened the site (one per browser tab)" />
        <Tile label="Started the questions" now={c.started} before={p.started} />
        <Tile label="Care plans made" now={c.plans} before={p.plans} hint="Includes plans that were later deleted" />
        <Tile label="Finish rate" value={pct(c.completion)} now={c.completion} before={p.completion} points sub="started → plan" />
        <Tile label="Launch list sign-ups" now={c.launch_optins} before={p.launch_optins} sub="ticked “keep me updated”" />
        <Tile label="Deleted plans" now={c.deleted} before={p.deleted} upIsGood={false} sub="shown, not removed" />
      </div>
      <div className="ad-grid2">
        <LineChart title="Visitors per day" color={PLUM} data={d.series.map((s) => ({ date: s.date, value: s.visitors }))} />
        <LineChart title="Care plans per day" color={AMBER} data={d.series.map((s) => ({ date: s.date, value: s.plans }))} />
      </div>
      <Section title="All time">
        <div className="ad-totals">
          <div><b>{num(d.totals.plans)}</b><span>plans made</span></div>
          <div><b>{num(d.totals.active)}</b><span>still saved</span></div>
          <div><b>{num(d.totals.deleted)}</b><span>deleted by the user</span></div>
          <div><b>{num(d.totals.launch_optins)}</b><span>on the launch list</span></div>
        </div>
      </Section>
    </>
  );
}

function FunnelTab({ d }) {
  const qs = d.questions.map((x) => {
    const title = x.id === 'UP' ? 'Period-app upload (optional)' : QUESTIONS.find((z) => z.id === x.id)?.title || '';
    return { key: x.id, label: `${x.id === 'UP' ? 'Upload' : x.id} · ${title}`, value: x.count };
  });
  const started = d.funnel.find((f) => f.key === 'started')?.count || 0;
  return (
    <>
      <Section title="From visit to directions" note="Each number is people (one per browser tab), not clicks."><Funnel steps={d.funnel} /></Section>
      <Section title="Who saw each question" note="Not everyone sees every question, because some are skipped depending on earlier answers. A sudden big drop from one question to the next shows where people give up." wide>
        <BarList rows={qs} total={started} empty="Questions will appear once people start answering." />
      </Section>
      <div className="ad-grid2">
        <Section title="Where visitors come from" wide>
          {d.sources.length ? (
            <div className="ad-table-wrap"><table className="ad-table">
              <thead><tr><th>Source</th><th>Medium</th><th>Campaign</th><th className="r">Visitors</th><th className="r">Started</th><th className="r">Plans</th><th className="r">Visit → plan</th></tr></thead>
              <tbody>{d.sources.map((s, i) => (
                <tr key={i}><td>{s.source}</td><td>{s.medium || '–'}</td><td>{s.campaign || '–'}</td><td className="r">{num(s.visitors)}</td><td className="r">{num(s.started)}</td><td className="r">{num(s.plans)}</td><td className="r">{pct(s.visitors ? s.plans / s.visitors : null)}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <p className="ad-empty">No visits counted yet.</p>}
          <p className="ad-note">For ads, add <code>?utm_source=instagram&amp;utm_medium=paid&amp;utm_campaign=launch</code> to the end of your link. The three words are yours to choose.</p>
        </Section>
        <Section title="Devices"><BarList rows={plain(d.devices, (k) => DEVICE[k] || k)} total={d.devices.reduce((a, x) => a + x.n, 0)} /></Section>
        <Section title="Goals picked on the landing page"><BarList rows={plain(d.symptoms, (k) => GOAL[k] || k)} /></Section>
        <Section title="Which button starts the questions"><BarList rows={plain(d.cta, (k) => SOURCES[k] || k)} /></Section>
      </div>
    </>
  );
}

function Gate({ d, what, children }) {
  return d.enough ? children : <p className="ad-empty">Not enough data yet. Totals appear once at least {d.min ?? 5} plans are made in this period, so nobody can be picked out. {what}</p>;
}

function AudienceTab({ d }) {
  const a = d.audience;
  const g = { ...a, min: d.min_group };
  return (
    <>
      <p className="ad-note top">Anonymous totals from <b>{num(a.n)}</b> plans made in this period (deleted plans are included in these totals, with no identity). Groups under {d.min_group} people show “&lt;5”.</p>
      <Gate d={g}>
        <div className="ad-grid2">
          <Section title="Age"><BarList rows={rowsOf(a.age, q('Q2'))} total={a.n} /></Section>
          <Section title="What they want help with" note="People can pick up to three."><BarList rows={rowsOf(a.concerns, q('Q1'))} total={a.n} /></Section>
          <Section title="When it started"><BarList rows={rowsOf(a.onset, q('Q19'))} total={a.n} empty="Asked since the questionnaire update." /></Section>
          <Section title="Days a month it gets in the way"><BarList rows={rowsOf(a.days, q('Q20'))} total={a.n} empty="Asked since the questionnaire update." /></Section>
          <Section title="Before their period" note="Symptoms in the week before a period. People can tick more than one."><BarList rows={rowsOf(a.premenstrual, q('Q17'))} total={a.n} empty="Asked since the questionnaire update." /></Section>
          <Section title="How often periods come"><BarList rows={rowsOf(a.cycle, q('Q5'))} total={a.n} /></Section>
          <Section title="Worst pain"><BarList rows={rowsOf(a.pain, q('Q10'))} total={a.n} /></Section>
          <Section title="Contraception"><BarList rows={rowsOf(a.contraception, q('Q4'))} total={a.n} /></Section>
          <Section title="Conditions already diagnosed"><BarList rows={rowsOf(a.conditions, q('Q14'))} total={a.n} /></Section>
          <Section title="Care so far"><BarList rows={rowsOf(a.history, q('Q15'))} total={a.n} /></Section>
        </div>
      </Gate>
    </>
  );
}

function CareTab({ d }) {
  const c = d.care;
  const g = { ...c, min: d.min_group };
  return (
    <>
      <p className="ad-note top">What the care plans told people, from <b>{num(c.n)}</b> plans in this period. This is guidance output, not diagnoses.</p>
      <Gate d={g}>
        <div className="ad-grid2">
          <Section title="How soon people were told to be seen"><BarList rows={rowsOf(c.urgency, (k) => CONTENT.urgency[k]?.label || k)} total={c.n} /></Section>
          <Section title="What the plans pointed to" note="The most common possibilities shown."><BarList rows={rowsOf(c.flags, (k) => CONTENT.flags[k]?.title || k)} total={c.n} /></Section>
          <Section title="Who people were told to see"><BarList rows={rowsOf(c.who, (k) => WHO[k] || k)} total={c.n} /></Section>
          <Section title="Tests suggested most"><BarList rows={rowsOf(c.tests, (k) => CONTENT.tests[k]?.[0] || k)} total={c.n} /></Section>
          <Section title="Safety screens shown" note="People who said something at the start that needs urgent care."><BarList rows={rowsOf(c.safety, q('Q0'))} total={c.n} empty="None in this period." /></Section>
        </div>
      </Gate>
    </>
  );
}

function EngagementTab({ d }) {
  const e = d.engagement;
  return (
    <div className="ad-grid2">
      <Section title="Which kind of care people looked for" note="Taps on the buttons in the care plan."><BarList rows={plain(e.actions_by_category, (k) => WHO[k] || k)} /></Section>
      <Section title="Which “Get directions” were tapped"><BarList rows={plain(e.directions_by_category, (k) => WHO[k] || k)} /></Section>
      <Section title="Using the plan">
        <ul className="ad-facts">
          <li><b>{num(e.link_opens)}</b> plan opens from the emailed link</li>
          <li><b>{num(e.checklist_ticks)}</b> doctor questions ticked, by <b>{num(e.checklist_sessions)}</b> people</li>
          <li><b>{num(e.summary_copy)}</b> doctor summaries copied</li>
          <li><b>{num(e.summary_print)}</b> doctor summaries printed</li>
        </ul>
        <h3 className="ad-h4">Period-app upload</h3>
        <BarList rows={plain(e.csv_by_result, (k) => (k === 'suggested' ? 'Suggested an answer' : k === 'none' ? 'Nothing it could use' : k))} empty="Nobody has used it yet." />
      </Section>
      <Section title="Demand by city" note="If a city gets many taps but has few listed clinics, that is where to add clinics first.">
        <div className="ad-table-wrap"><table className="ad-table">
          <thead><tr><th>City</th><th className="r">Clinics listed</th><th className="r">Lists opened</th><th className="r">Directions taps</th></tr></thead>
          <tbody>{e.cities.map((c) => <tr key={c.city}><td>{c.city}</td><td className="r">{num(c.listings)}</td><td className="r">{num(c.views)}</td><td className="r">{num(c.directions)}</td></tr>)}</tbody>
        </table></div>
      </Section>
    </div>
  );
}

function HealthTab({ d }) {
  const h = d.health;
  const sent = h.mail.sent + h.mail.failed + h.mail.pending;
  const soon = [
    ['Did they see a doctor?', 'A short follow-up email a few weeks after the plan. This is the truest measure of success. Not built yet.'],
    ['App waitlist interest', 'The launch list sign-ups above are the start of this.'],
    ['Weekly return rate', 'Needs a way to recognise returning women across visits. Planned for the app.'],
    ['Cost per plan', 'Appears once ad spend is entered. Campaign tags are already being collected.'],
  ];
  return (
    <>
      <div className="ad-grid2">
        <Section title="Plan emails">
          <ul className="ad-facts">
            <li><b>{num(h.mail.sent)}</b> sent</li>
            <li><b className={h.mail.failed ? 'ad-bad' : ''}>{num(h.mail.failed)}</b> failed to send{h.mail.failed ? ' — check the mailbox settings' : ''}</li>
            <li><b>{num(h.mail.pending)}</b> waiting</li>
          </ul>
          <p className="ad-note">{sent ? pct(h.mail.sent / sent) + ' delivered to the mail system (this cannot see spam folders).' : 'No plans in this period.'}</p>
        </Section>
        <Section title="Choices people made">
          <ul className="ad-facts">
            <li><b>{pct(h.launch_optin_rate)}</b> joined the launch list ({num(h.launch_optins)})</li>
            <li><b>{num(h.deleted)}</b> deleted their plan in this period</li>
          </ul>
        </Section>
      </div>
      <Section title="Coming with the app" note="These need data we don't collect yet.">
        <div className="ad-soon">{soon.map(([t, x]) => <div key={t}><b>{t}</b><span>{x}</span><em>Not tracked yet</em></div>)}</div>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- contacts (second password)
function Contacts() {
  const [state, setState] = useState('checking'); // checking | locked | open
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [optin, setOptin] = useState(true);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await adminApi.contacts(optin, search);
      setRows(r.contacts); setState('open');
    } catch (e) {
      if (e.status === 403) setState('locked'); else setError(e.message);
    }
  }, [optin, search]);

  useEffect(() => { load(); }, [load]);

  const unlock = async (e) => {
    e.preventDefault(); setError('');
    try { await adminApi.unlock(pw); setPw(''); await load(); } catch (err) { setError(err.message); }
  };
  const lock = async () => { await adminApi.lock(); setRows([]); setState('locked'); };
  const remove = async (id) => { await adminApi.deleteContact(id); setConfirm(null); load(); };

  if (state === 'checking') return <p className="ad-empty">Loading…</p>;
  if (state === 'locked') {
    return (
      <form className="ad-card ad-login" onSubmit={unlock}>
        <h2 className="ad-h3">Contacts are locked</h2>
        <p className="ad-note">Email addresses need a second password. It locks again by itself after 15 minutes.</p>
        <label className="ad-field"><span>Contacts password</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" />
        </label>
        {error && <p className="ad-error" role="alert">{error}</p>}
        <button className="ad-btn" disabled={!pw}>Unlock contacts</button>
      </form>
    );
  }
  const active = rows.filter((r) => r.status === 'active').length;
  return (
    <section className="ad-card ad-section wide">
      <div className="ad-toolbar">
        <input className="ad-search" type="search" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="ad-check"><input type="checkbox" checked={optin} onChange={(e) => setOptin(e.target.checked)} /> Launch list only</label>
        <a className="ad-btn small" href="/api/admin/contacts.csv">Download launch list (CSV)</a>
        <button className="ad-btn ghost small" onClick={lock}>Lock now</button>
      </div>
      <p className="ad-note">{active} shown. The download only contains people who ticked “Keep me updated” and haven’t deleted their plan. Deleted plans appear as “Deleted”, with no name or email, because that data was removed.</p>
      {error && <p className="ad-error">{error}</p>}
      <div className="ad-table-wrap"><table className="ad-table">
        <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Launch list</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => r.status === 'deleted' ? (
            <tr key={r.id} className="deleted"><td colSpan="3"><span className="ad-badge del">Deleted</span> by the user on {longDate(r.deleted_at)} (joined {longDate(r.created_at)})</td><td>–</td><td>Deleted</td><td /></tr>
          ) : (
            <tr key={r.id}>
              <td>{r.name || <span className="ad-muted">–</span>}</td><td>{r.email}</td><td>{longDate(r.created_at)}</td>
              <td>{r.launch_optin ? '✓ Yes' : 'No'}</td><td>Active</td>
              <td className="r">{confirm === r.id
                ? <><button className="ad-link danger" onClick={() => remove(r.id)}>Yes, delete</button> <button className="ad-link" onClick={() => setConfirm(null)}>Cancel</button></>
                : <button className="ad-link" onClick={() => setConfirm(r.id)}>Delete</button>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="6" className="ad-empty">Nobody to show.</td></tr>}
        </tbody>
      </table></div>
    </section>
  );
}

// ---------------------------------------------------------------- the whole dashboard
function Dashboard({ onSignedOut }) {
  const [tab, setTab] = useState(0);
  const [preset, setPreset] = useState('30');
  const today = lagosToday();
  const [range, setRange] = useState({ from: addDays(today, -29), to: today });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const pick = (p) => {
    setPreset(p);
    if (p !== 'custom') setRange({ from: addDays(today, -(Number(p) - 1)), to: today });
  };

  useEffect(() => {
    if (range.from > range.to) return;
    let stale = false;
    setError('');
    adminApi.stats(range.from, range.to)
      .then((d) => { if (!stale) setData(d); })
      .catch((e) => { if (e.status === 401) onSignedOut(); else if (!stale) setError(e.message); });
    return () => { stale = true; };
  }, [range, onSignedOut]);

  const signOut = async () => { await adminApi.logout().catch(() => {}); onSignedOut(); };

  return (
    <div className="ad-wrap">
      <header className="ad-head">
        <img src="/brand/lockup-aubergine.png" alt="Closa Health" height="24" />
        <span className="ad-title">Dashboard</span>
        <button className="ad-link" onClick={signOut}>Sign out</button>
      </header>
      <div className="ad-bar">
        <nav className="ad-tabs" aria-label="Sections">
          {TABS.map((t, i) => <button key={t} className={i === tab ? 'on' : ''} onClick={() => setTab(i)} aria-current={i === tab}>{t}</button>)}
        </nav>
        {tab !== 6 && (
          <div className="ad-range">
            {['7', '30', '90'].map((p) => <button key={p} className={preset === p ? 'on' : ''} onClick={() => pick(p)}>{p} days</button>)}
            <button className={preset === 'custom' ? 'on' : ''} onClick={() => pick('custom')}>Custom</button>
            {preset === 'custom' && (
              <span className="ad-dates">
                <input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="From" />
                <span>to</span>
                <input type="date" value={range.to} min={range.from} max={today} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="To" />
              </span>
            )}
          </div>
        )}
      </div>
      {tab !== 6 && data && <p className="ad-period">{shortDate(range.from)} to {shortDate(range.to)} ({data.range.days} days), compared with the {data.range.days} days before. Lagos time.</p>}
      {error && <p className="ad-error" role="alert">{error}</p>}
      <main>
        {tab === 6 ? <Contacts /> : !data ? <p className="ad-empty">Loading…</p> : (
          [<Overview d={data} />, <FunnelTab d={data} />, <AudienceTab d={data} />, <CareTab d={data} />, <EngagementTab d={data} />, <HealthTab d={data} />][tab]
        )}
      </main>
      <footer className="ad-foot">Totals only. Individual answers are never shown here. Emails are on the Contacts tab, behind the second password.</footer>
    </div>
  );
}

export default function AdminApp() {
  const [phase, setPhase] = useState('checking'); // checking | login | off | app
  useEffect(() => {
    document.title = 'Dashboard · Closa Health';
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    adminApi.session().then(() => setPhase('app')).catch((e) => setPhase(e.status === 503 ? 'off' : 'login'));
    return () => meta.remove();
  }, []);
  const signedOut = useCallback(() => setPhase('login'), []);
  if (phase === 'checking') return <div className="ad-center"><p>Loading…</p></div>;
  if (phase === 'off') return <Login off />;
  if (phase === 'login') return <Login onDone={() => setPhase('app')} />;
  return <Dashboard onSignedOut={signedOut} />;
}
