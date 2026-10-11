import { useMemo, useState } from 'react';
import { evaluate, CAT_ACTION } from '../lib/evaluate.js';
import { CONTENT } from '../lib/content.js';
import { optOf, arrOf } from '../lib/questions.js';
import { Arrow, Check, Info, Warn, Deco, PlanIcons } from './Icons.jsx';

const SCALE = ['Emergency', '1–2 days', '2 weeks', '4–6 weeks', 'Routine'];

// One numbered, tinted block of the plan.
function Section({ id, tint, step, title, icon, children }) {
  return (
    <section id={'plan-' + id} className={'psec ' + tint}>
      <div className="psec-head">
        <span className="ic">{icon}</span>
        <div><span className="step">Step {step}</span><h2>{title}</h2></div>
      </div>
      {children}
    </section>
  );
}

const ActionButton = ({ label, onClick }) => (
  <button className="btn btn-act" onClick={onClick}>{label}<Arrow /></button>
);

const Dots = ({ items }) => (
  <div className="dots">{items.map((t) => <div key={t} className="dot-row"><i /><span>{t}</span></div>)}</div>
);

// Opens a clean printable page with the doctor summary.
function printSummary(text) {
  const w = window.open('', '_blank');
  if (!w) return;
  const doc = w.document;
  doc.title = 'Closa · Summary for your doctor';
  doc.body.style.cssText = 'font-family:Jost,Arial,sans-serif;max-width:640px;margin:48px auto;padding:0 24px;color:#1A1A1A;line-height:1.6';
  const add = (css, content) => { const p = doc.createElement('p'); p.style.cssText = css; p.textContent = content; doc.body.appendChild(p); };
  add('font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#4A2545', 'Closa Health · Summary for your doctor');
  add('font-size:17px', text);
  add('font-size:12px;color:#4a4a4a', 'Patient-reported answers. Guidance, not a diagnosis.');
  setTimeout(() => w.print(), 400);
}

// Screen 4: the care plan, built from her answers by the rules engine.
export default function Plan({ answers, email, canDelete, onAction, onDelete }) {
  const P = useMemo(() => evaluate(answers), [answers]);
  const [asked, setAsked] = useState({});
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const chips = arrOf(answers, 'Q1').map((c) => optOf('Q1', c)?.label).filter(Boolean);

  // Only sections that apply get a step number.
  const defs = [
    ['soon', 'How soon to be seen', 'How soon', true],
    ['preg', 'Take a pregnancy test first', 'Pregnancy test', P.pregFirst],
    ['point', 'What your answers may point to', 'What it may be', true],
    ['who', 'Who to see', 'Who to see', true],
    ['tests', 'Tests to ask for', 'Tests', P.tests.length > 0],
    ['ask', 'Questions to ask your doctor', 'Questions', true],
    ['warn', 'Warning signs', 'Warning signs', true],
    ['self', 'What you can do now', 'What you can do', P.selfcare.length > 0],
    ['ttc', 'Trying to conceive', 'Trying to conceive', P.showTtc],
    ['summary', 'Summary for your doctor', 'Doctor summary', true],
  ].filter((d) => d[3]);
  const num = {};
  const steps = defs.map((d, i) => { const n = String(i + 1).padStart(2, '0'); num[d[0]] = n; return { id: d[0], n, title: d[1], label: d[2] }; });

  const jump = (id) => {
    const el = document.getElementById('plan-' + id);
    if (el) el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  const copy = () => {
    try { navigator.clipboard.writeText(P.summary); } catch (e) { /* clipboard may be blocked */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const go = (cat, from) => () => onAction(cat, from);

  return (
    <div className="screen">
      <header className="plan-header">
        <img className="logo" src="/brand/lockup-aubergine.png" alt="Closa Health" />
        {email && <span>Sent to {email}</span>}
      </header>
      <div className="plan-grid">
        <aside className="plan-aside">
          <div className="aside-card">
            <Deco size={180} color="#6b4566" stroke={10} style={{ right: -50, top: -40 }} />
            <p className="k">Your care plan · {today}</p>
            <h1>Here’s what to do next, step by step.</h1>
            <div className="chips">{chips.map((c) => <span key={c} className="chip">{c}</span>)}</div>
            <div className="howsoon"><small>How soon</small><b>{P.urgency.label}</b></div>
            <nav className="step-index" aria-label="Plan steps">
              {steps.map((s) => <button key={s.id} onClick={() => jump(s.id)}><i>{s.n}</i><span>{s.title}</span></button>)}
            </nav>
          </div>
          <div className="step-chips">
            {steps.map((s) => <button key={s.id} onClick={() => jump(s.id)}><i>{s.n}</i>{s.label}</button>)}
          </div>
          <div className="aside-note">
            <Info />
            <span className="pretty">This is guidance based on your answers, not a diagnosis. Share it with a clinician, who can examine you and arrange tests.</span>
          </div>
        </aside>

        <main className="plan-main">
          {P.banners.length > 0 && (
            <div className="banners">
              {P.banners.map((b) => b.u1 ? (
                <div key={b.code} className="banner-u1">
                  <div className="top"><span className="emerg-icon"><Warn /></span><h2>{b.title}</h2></div>
                  <p>{b.body}</p>
                  <a className="call-btn" href="tel:112">Call 112</a>
                </div>
              ) : (
                <div key={b.code} className="banner-book"><h2>{b.title}</h2><p>{b.body}</p></div>
              ))}
            </div>
          )}

          <Section id="soon" tint="blush" step={num.soon} title="How soon to be seen" icon={PlanIcons.soon}>
            <div className="inner">
              <h3 className="urg-label">{P.urgency.label}</h3>
              <div className="scale">
                {SCALE.map((l, i) => <div key={l} className={P.urgency.level === i + 1 ? 'on' : ''}><i /><span>{l}</span></div>)}
              </div>
              <p>{P.urgency.body}</p>
            </div>
          </Section>

          {P.pregFirst && (
            <Section id="preg" tint="sand" step={num.preg} title="Take a pregnancy test first" icon={PlanIcons.preg}>
              <div className="inner"><p>{CONTENT.pregFirst}</p></div>
            </Section>
          )}

          <Section id="point" tint="rose" step={num.point} title="What your answers may point to" icon={PlanIcons.point}>
            <p className="psec-lead">Possibilities to talk through with a clinician. Only they can diagnose you.</p>
            {!P.reassure ? (
              <div className="cards">
                {P.possibilities.map((p) => (
                  <div key={p.id} className="inner">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><h3>{p.title}</h3><p>{p.body}</p></div>
                    {p.evidence && <p className="evidence">{p.evidence}</p>}
                    <span className="grow" />
                    <ActionButton label={p.action} onClick={go(p.cat, 'possibility:' + p.id)} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="inner"><p>{CONTENT.reassure}</p></div>
            )}
            {P.notes.length > 0 && (
              <div className="notes">
                {P.notes.map((n) => <div key={n} className="note"><Info /><span className="pretty">{n}</span></div>)}
              </div>
            )}
          </Section>

          <Section id="who" tint="blush" step={num.who} title="Who to see" icon={PlanIcons.who}>
            <div className="cards">
              {P.who.map((w) => (
                <div key={w.stop} className="inner">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><h3>{w.stop}</h3><span className="who-for">For: {w.fors.join(', ')}</span></div>
                  {w.asks.length > 0 && <div className="ask-for"><small>Then ask for</small><span>{w.asks.join('. ')}</span></div>}
                  <span className="grow" />
                  {w.cat === 'emerg'
                    ? <a className="btn btn-act btn-ink" href="tel:112">Call 112</a>
                    : <ActionButton label={CAT_ACTION[w.cat]} onClick={go(w.cat, 'who')} />}
                </div>
              ))}
            </div>
          </Section>

          {P.tests.length > 0 && (
            <Section id="tests" tint="sand" step={num.tests} title="Tests to ask for" icon={PlanIcons.tests}>
              {P.bringReports && <p className="bring">{CONTENT.testNotes.bringReports}</p>}
              <div className="tests">
                {P.tests.map((t, i) => (
                  <div key={t.id} className="test">
                    <span className="n">{i + 1}</span>
                    <div><b>{t.name}</b><span className="tm">{t.timing}</span>{t.note && <span className="nt">{t.note}</span>}</div>
                  </div>
                ))}
              </div>
              {P.maySuggest.length > 0 && (
                <div className="inner"><span className="label-sm">Your specialist may suggest</span><Dots items={P.maySuggest} /></div>
              )}
              <ActionButton label="Find a lab" onClick={go('lab', 'tests')} />
            </Section>
          )}

          <Section id="ask" tint="sage" step={num.ask} title="Questions to ask your doctor" icon={PlanIcons.ask}>
            <div className="inner">
              <span className="counter">Tap to tick off as you ask · {Object.values(asked).filter(Boolean).length} of {P.questions.length} asked</span>
              {P.questions.map((text, i) => (
                <button key={text} className={'q-check' + (asked[i] ? ' on' : '')} onClick={() => setAsked({ ...asked, [i]: !asked[i] })} aria-pressed={!!asked[i]}>
                  <span className="ring">{asked[i] && <Check />}</span><span>{text}</span>
                </button>
              ))}
            </div>
          </Section>

          <div id="plan-warn" className="warn">
            <div className="psec-head" style={{ padding: 0, gap: 12 }}>
              <span className="ic"><Warn /></span>
              <div><span className="step">Step {num.warn}</span><h2>Warning signs: get help straight away if you have</h2></div>
            </div>
            <ul>{P.warnings.map((u) => <li key={u}><span>—</span><span>{u}</span></li>)}</ul>
            <div className="foot">
              <p>Call <strong style={{ fontWeight: 600 }}>112</strong> or go to the nearest hospital emergency unit.</p>
              <a className="call-btn" href="tel:112">Call 112</a>
            </div>
          </div>

          {P.selfcare.length > 0 && (
            <Section id="self" tint="sage" step={num.self} title="What you can do now" icon={PlanIcons.self}>
              <div className="inner"><Dots items={P.selfcare} /></div>
            </Section>
          )}

          {P.showTtc && (
            <Section id="ttc" tint="sand" step={num.ttc} title="Trying to conceive" icon={PlanIcons.ttc}>
              <div className="cards">
                {P.ttc.map((t) => (
                  <div key={t.title} className="inner">
                    <h3>{t.title}</h3><p>{t.body}</p>
                    {t.list && t.list.length > 0 && <Dots items={t.list} />}
                  </div>
                ))}
              </div>
              <ActionButton label="Find a fertility clinic" onClick={go('fert', 'ttc')} />
            </Section>
          )}

          <Section id="summary" tint="outline" step={num.summary} title="Summary for your doctor" icon={PlanIcons.summary}>
            <p className="psec-lead" style={{ color: 'var(--muted)' }}>Show or send this to your doctor so you don’t have to start from the beginning.</p>
            <div className="summary-box">{P.summary}</div>
            <div className="btn-row">
              {copied
                ? <span className="copied"><Check color="#4A2545" />Copied</span>
                : <button className="btn" onClick={copy}>Copy summary</button>}
              <button className="btn btn-outline" onClick={() => printSummary(P.summary)}>Print</button>
            </div>
          </Section>

          <p className="disclaimer">{CONTENT.disclaimer}</p>

          {canDelete && (
            <div className="delete-box">
              <p>Your answers are saved with your email so you can come back to this plan. You can delete them at any time.</p>
              {!confirming ? (
                <button className="btn-text" onClick={() => setConfirming(true)}>Delete my saved plan</button>
              ) : (
                <div className="btn-row">
                  <button
                    className="btn btn-ink"
                    onClick={async () => { setDeleteError(!(await onDelete())); }}
                  >Yes, delete it</button>
                  <button className="btn btn-outline" onClick={() => setConfirming(false)}>Keep it</button>
                </div>
              )}
              {deleteError && <div className="error-note" role="alert">We couldn’t delete it just now. Please try again.</div>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
