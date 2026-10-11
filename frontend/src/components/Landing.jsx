import { SYMPTOMS, REASONS, HOW, STATS } from '../lib/data.js';
import { Arrow, Check, Lock, Info, Deco } from './Icons.jsx';
import { HeroVisual, GETS } from './Visuals.jsx';

// Screen 1: the long-scroll landing page. It never mentions trying to conceive.
export default function Landing({ pre, setPre, onStart }) {
  const picked = SYMPTOMS.filter((s) => pre[s.name]).length;
  const toggle = (name) => setPre({ ...pre, [name]: !pre[name] });

  return (
    <div className="screen">
      <header className="l-header">
        <div className="l-header-in">
          <img className="logo" src="/brand/lockup-aubergine.png" alt="Closa Health" />
          <button className="nav-btn" onClick={onStart}>Get my free care plan <Arrow /></button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-in">
          <div className="hero-text">
            <h1>Years of painful symptoms. <b>One step to the right care.</b></h1>
            <p className="hero-sub pretty">A free, personalised care plan that shows you who to see, what to ask for and how soon.</p>
            <div className="hero-cta">
              <button className="btn btn-lg" onClick={onStart}>Get my free care plan <Arrow /></button>
              <span>About 5 minutes</span>
            </div>
          </div>
          <div style={{ minWidth: 0 }}><HeroVisual /></div>
        </div>
      </section>

      <section className="dark">
        <Deco size={640} stroke={5} style={{ left: -260, top: -120 }} />
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">You know this feeling</p>
            <h2>Does any of this sound like you?</h2>
            <p className="pretty">Tap the ones you know too well. We’ll start your plan from there.</p>
          </div>
          <div className="sym-grid">
            {SYMPTOMS.map((s) => {
              const on = !!pre[s.name];
              return (
                <button key={s.name} className={'sym-card' + (on ? ' on' : '')} onClick={() => toggle(s.name)} aria-pressed={on}>
                  <span className="name">{s.name}</span>
                  <span className="feel">{s.feel}</span>
                  <span className="me"><span className="tick">{on && <Check />}</span>That’s me</span>
                </button>
              );
            })}
          </div>
          {picked > 0 && (
            <div className="pre-cta">
              <button className="btn btn-light" onClick={onStart}>
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
              <h2>You’re not imagining it. Help is often missed or delayed.</h2>
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
              <div key={s.value + s.source} className="stat" style={{ background: s.bg }}>
                <span className="v">{s.value}</span>
                <span className="x">{s.text}</span>
                <span className="s">Source: {s.source}</span>
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
            <p className="pretty">These symptoms are common, and they’re real. When the right person looks properly, there are tests that can find out what’s going on and options that can help you feel more like yourself. Your free care plan shows you where to start.</p>
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

      <section className="how">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">How it works</p>
            <h2>One simple step toward the right care.</h2>
          </div>
          <div className="how-grid">
            {HOW.map((h) => (
              <div key={h.n} className="how-step"><span className="n">{h.n}</span><span className="t">{h.t}</span><span className="d">{h.d}</span></div>
            ))}
          </div>
          <div className="trust-grid">
            <div className="trust"><Lock /><span><strong style={{ fontWeight: 500 }}>Private by design.</strong> Your answers are encrypted. We never sell your data and only share it when you ask us to.</span></div>
            <div className="trust"><Info size={22} /><span><strong style={{ fontWeight: 500 }}>Guidance, not diagnosis.</strong> Closa helps you prepare for care. Only a clinician can diagnose you.</span></div>
          </div>
        </div>
      </section>

      <section className="close">
        <div className="close-card">
          <Deco size={520} stroke={5} style={{ right: -200, bottom: -220 }} />
          <h2 className="h2-xl">You’ve waited long enough.</h2>
          <p>Take a few minutes for yourself today, and leave with a clear next step.</p>
          <button className="btn btn-lg btn-light" onClick={onStart}>Get my free care plan <Arrow color="#4A2545" /></button>
        </div>
      </section>

      <footer className="footer">
        <img className="logo" src="/brand/lockup-aubergine.png" alt="Closa Health" />
        <p>Closa Health offers guidance, not diagnosis. If you need urgent help, call 112 or go to the nearest hospital emergency unit.</p>
        <span>© 2026 Closa Health</span>
      </footer>
    </div>
  );
}
