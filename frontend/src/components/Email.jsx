import { Back, Check, Info } from './Icons.jsx';
import { SidePanel } from './Intake.jsx';

const EMAIL_OK = /^\S+@\S+\.\S+$/;

// Screen 3: email capture (required) + consent.
export default function Email({ state, setState, showTtcConsent, saving, error, onBack, onSubmit, onSkipSave }) {
  const { email, name, consent, ttcConsent, launchOptin } = state;
  const ok = EMAIL_OK.test(email) && consent && !saving;

  return (
    <div className="screen form-screen">
      <SidePanel
        kicker="All questions answered"
        title="Your plan is ready."
        text="How soon to be seen, what it may point to, who to see, which tests to ask for and a summary for your doctor."
        note="Guidance, not diagnosis. Only a clinician can diagnose you."
        noteIcon={<Info color="#D8C6D1" />}
      />
      <div className="form-col">
        <header className="form-head" style={{ paddingBottom: 16 }}>
          <div className="form-head-row">
            <button className="icon-btn" onClick={onBack} aria-label="Back"><Back /></button>
          </div>
        </header>
        <form className="q-main sm" onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit(); }} id="email-form">
          <img className="mobile-only-mark" src="/brand/app-icon-aubergine.png" alt="" width="56" height="56" style={{ borderRadius: 14 }} />
          <div>
            <h2 className="q-title">Your plan is ready. Where should we send it?</h2>
            <p className="q-help" style={{ marginTop: 10 }}>We’ll email you a copy so you can come back to it and show it to a doctor. It also keeps your answers safe if you close this page.</p>
          </div>
          <label className="field">
            <span>What should we call you? <span className="optional">(optional)</span></span>
            <input type="text" value={name} onChange={(e) => setState({ name: e.target.value })} placeholder="First name or nickname" autoComplete="given-name" maxLength={60} />
          </label>
          <label className="field">
            <span>Email address</span>
            <input type="email" value={email} onChange={(e) => setState({ email: e.target.value })} placeholder="you@example.com" autoComplete="email" inputMode="email" maxLength={254} />
          </label>
          <button type="button" className={'check' + (consent ? ' on' : '')} onClick={() => setState({ consent: !consent })} role="checkbox" aria-checked={consent}>
            <span className="box">{consent && <Check size={13} />}</span>
            <span>I agree that Closa can store my answers to create my care plan, as set out in the <a href="/privacy" target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>privacy policy</a>. I can delete them at any time.</span>
          </button>
          {showTtcConsent && (
            <button type="button" className={'check' + (ttcConsent ? ' on' : '')} onClick={() => setState({ ttcConsent: !ttcConsent })} role="checkbox" aria-checked={ttcConsent}>
              <span className="box">{ttcConsent && <Check size={13} />}</span>
              <span>Optional: save my pregnancy plans with my care plan. If you leave this unticked, we’ll still use them to build your plan but won’t store them. We never use them for marketing.</span>
            </button>
          )}
          <button type="button" className={'check' + (launchOptin ? ' on' : '')} onClick={() => setState({ launchOptin: !launchOptin })} role="checkbox" aria-checked={launchOptin}>
            <span className="box">{launchOptin && <Check size={13} />}</span>
            <span>Keep me updated about new features on Closa Health. No spamming!</span>
          </button>
          {error && (
            <div className="error-note" role="alert">
              We couldn’t save your plan just now. Please check your connection and try again.
              {' '}<button type="button" className="btn-text" style={{ minHeight: 32, padding: 0, color: '#7a1f1f' }} onClick={onSkipSave}>Continue without saving</button>
            </div>
          )}
        </form>
        <div className="bottom-bar" style={{ gap: 10 }}>
          <button className="btn btn-block" type="submit" form="email-form" disabled={!ok}>{saving ? 'Saving…' : 'See my plan'}</button>
          <span className="small">No spam. Unsubscribe any time.</span>
        </div>
      </div>
    </div>
  );
}
