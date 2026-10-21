import { useState } from 'react';
import { GOALS, REASONS, HOW, STATS, FAQS } from '../lib/data.js';
import { Arrow, Check, Lock, Info, Triangle, CardSlash, PlusMinus, Deco } from './Icons.jsx';
import { HeroVisual, GETS } from './Visuals.jsx';
import { track } from '../lib/track.js';

// A button that starts the questions. `source` is an anonymous tag for the dashboard.
function Cta({ onStart, source, className = 'btn btn-lg', light = false, children = 'Get my free care plan' }) {
  return (
    <button className={className} onClick={() => onStart(source)}>
      {children} <Arrow color={light ? '#4A2545' : '#F7F6F2'} />
    </button>
  );
}

// Screen 1: the long-scroll landing page (v2 copy).
export default function Landing({ pre, setPre, onStart }) {
  const [faqOpen, setFaqOpen] = useState(0); // one open at a time; the first starts open
  const picked = GOALS.filter((g) => pre[g.key]).length;
  const toggle = (g) => {
    if (!pre[g.key]) track('symptom_pick', { step: g.key });
    setPre({ ...pre, [g.key]: !pre[g.key] });
  };

  return (
    <div className="screen">
      <header className="l-header">
        <div className="l-header-in">
          <img className="logo" src="/brand/lockup-aubergine.png" alt="Closa Health" />
          <button className="nav-btn" onClick={() => onStart('nav')}>Get my free care plan <Arrow /></button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-in">
          <div className="hero-text">
            <span className="pill-note"><i><Check size={10} /></i>Free · Private · About 3 minutes</span>
            <h1>Years of painful symptoms. <b>One step to the right care.</b></h1>
            <p className="hero-lead">Period and hormone problems are common. Clear answers aren’t. Get a free care plan in 3 minutes.</p>
            <div className="hero-cta-wrap">
              <button className="btn btn-hero" onClick={() => onStart('hero')}>Get my free care plan <i><Arrow color="#4A2545" /></i></button>
              <span className="hero-note">Guidance, not diagnosis. No card needed.</span>
            </div>
          </div>
          <div style={{ minWidth: 0 }}><HeroVisual /></div>
        </div>
      </section>

      <section className="dark">
        <Deco size={640} stroke={5} style={{ left: -260, top: -120 }} />
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">What you’re hoping for</p>
            <h2>What do you want most right now?</h2>
            <p>Tap the ones that feel true. We’ll start your plan there.</p>
          </div>
          <div className="sym-grid">
            {GOALS.map((g) => {
              const on = !!pre[g.key];
              return (
                <button key={g.key} className={'sym-card' + (on ? ' on' : '')} onClick={() => toggle(g)} aria-pressed={on}>
                  <span className="name">{g.name}</span>
                  <span className="feel">{g.feel}</span>
                  <span className="me"><span className="tick">{on && <Check />}</span>That’s me</span>
                </button>
              );
            })}
          </div>
          {picked > 0 && (
            <div className="pre-cta">
              <button className="btn btn-light" onClick={() => onStart('goals')}>
                Start my plan with {picked === 1 ? 'this' : 'these ' + picked} <Arrow color="#4A2545" />
              </button>
              <span>You’re not alone in this.</span>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="wrap why-grid">
          <div className="why-left">
            <div className="sec-head">
              <p className="eyebrow">Why it takes so long</p>
              <h2>It’s not in your head. And it’s not your fault.</h2>
              <p>Women wait years for answers. Not because their symptoms aren’t real, but because the path to care isn’t clear.</p>
            </div>
            <div className="reasons">
              {REASONS.map((r) => (
                <div key={r.n} className="reason">
                  <span className="n">{r.n}</span>
                  <div><span className="t">{r.t}</span><span className="d pretty">{r.d}</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="stats">
            {STATS.map((s) => (
              <div key={s.value} className="stat" style={{ background: s.bg }}>
                <span className="v">{s.value}</span>
                <span className="x">{s.text}</span>
                <a className="s" href={s.href} target="_blank" rel="noopener noreferrer">{s.source}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="help">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">There is help</p>
            <h2>You don’t have to keep putting up with it.</h2>
            <p>These conditions are common, and they are real. Most can be treated or managed once the right person looks properly. The hardest part is often the first step: knowing what to ask for, and who to ask. That’s what your free care plan is for.</p>
          </div>
          <div className="gets">
            {GETS.map((g) => (
              <div key={g.n} className="get">
                <div className="get-vis" style={{ background: g.bg }}>{g.visual}</div>
                <div className="get-txt"><span className="n">{g.n}</span><span className="t">{g.t}</span><span className="d">{g.d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap look-grid">
          <div className="look-left">
            <div className="sec-head">
              <p className="eyebrow">A look inside</p>
              <h2>Here’s what a care plan looks like.</h2>
            </div>
            <div className="btn-wrap-d"><Cta onStart={onStart} source="example" /></div>
          </div>
          <div className="look-right">
            <div className="phone" role="img" aria-label="An example care plan on a phone screen">
              <div className="phone-screen">
                <div className="notch" />
                <div className="phone-top"><img src="/brand/lockup-aubergine.png" alt="" /><span>Example plan</span></div>
                <div className="pblock blush"><small>How soon to be seen</small><b style={{ color: '#4A2545' }}>Book an appointment within 4–6 weeks.</b>
                  <div className="pscale"><i /><i /><i /><i className="on" /><i /></div></div>
                <div className="pblock rose"><small>What your answers may point to</small><b>Endometriosis</b>
                  <p className="why">Why we suggest this: your pain has got worse over the years, and you have deep pain during sex.</p></div>
                <div className="pblock blush"><small>Who to see</small><p>A gynaecologist who treats endometriosis and does keyhole surgery.</p></div>
                <div className="pblock sand"><small>Ask for</small><p>A pelvic scan, ideally an internal one.</p><span className="good">Good to know: a normal scan doesn’t rule out endometriosis.</span></div>
                <div className="pblock outline"><small>Summary for your doctor</small>
                  <p className="sum">Age 20–34. Main concern: painful periods, started over 3 years ago. Pain: severe, worsening over years; deep pain during sex. Days affected per month: 3–5. Previously told symptoms were normal.</p></div>
              </div>
            </div>
            <p className="caption">Your plan is built from your own answers, so no two plans are the same.</p>
            <div className="btn-wrap-m"><Cta onStart={onStart} source="example" /></div>
          </div>
        </div>
      </section>

      <section className="how">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">How it works</p>
            <h2>Three steps to a clear next step.</h2>
          </div>
          <div className="how-grid">
            {HOW.map((h) => (
              <div key={h.n} className="how-step"><span className="n">{h.n}</span><span className="t">{h.t}</span><span className="d">{h.d}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="trust-sec">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">Why you can trust it</p>
            <h2>Built carefully, for you.</h2>
          </div>
          <div className="trust-grid">
            <div className="trust"><CardSlash /><span><strong style={{ fontWeight: 500 }}>Free.</strong> No card, no catch. You don’t pay anything to get your plan.</span></div>
            <div className="trust"><Lock /><span><strong style={{ fontWeight: 500 }}>Private by design.</strong> Your answers are kept private and secure. We never sell your data, and we only share it when you ask us to.</span></div>
            <div className="trust"><Info size={22} /><span><strong style={{ fontWeight: 500 }}>Guidance, not diagnosis.</strong> Your plan helps you prepare for care. Only a clinician can diagnose you.</span></div>
            <div className="trust"><Triangle /><span><strong style={{ fontWeight: 500 }}>Safety first.</strong> If your answers show warning signs, your plan tells you to get help straight away.</span></div>
          </div>
        </div>
      </section>

      <section className="faq">
        <div className="wrap faq-grid">
          <div className="sec-head faq-head">
            <p className="eyebrow">Questions women ask</p>
            <h2>Questions you might have</h2>
          </div>
          <div className="faq-list">
            {FAQS.map(([q, a], i) => {
              const open = faqOpen === i;
              return (
                <div key={q} className="faq-item">
                  <button className="faq-q" aria-expanded={open} aria-controls={'faq-a-' + i} onClick={() => setFaqOpen(open ? -1 : i)}>
                    <span>{q}</span><i aria-hidden="true"><PlusMinus open={open} /></i>
                  </button>
                  {open && <p className="faq-a" id={'faq-a-' + i}>{a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="close">
        <div className="close-card">
          <Deco size={520} stroke={5} style={{ right: -200, bottom: -220 }} />
          <h2 className="h2-xl">You’ve waited long enough.</h2>
          <p>Take three minutes for yourself today, and leave with a clear next step.</p>
          <Cta onStart={onStart} source="closing" light className="btn btn-lg btn-light" />
        </div>
      </section>

      <footer className="footer">
        <img className="logo" src="/brand/lockup-aubergine.png" alt="Closa Health" />
        <p>Closa Health offers guidance, not diagnosis. If you need urgent help, call 112 or go to the nearest hospital emergency unit.</p>
        <span>© 2026 Closa Health · <a href="/privacy">Privacy policy</a></span>
      </footer>
    </div>
  );
}
