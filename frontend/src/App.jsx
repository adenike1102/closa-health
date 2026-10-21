import { useCallback, useEffect, useRef, useState } from 'react';
import Landing from './components/Landing.jsx';
import Intake from './components/Intake.jsx';
import Email from './components/Email.jsx';
import Plan from './components/Plan.jsx';
import Providers from './components/Providers.jsx';
import { parseCycleCsv } from './lib/cycleCsv.js';
import { evaluate } from './lib/evaluate.js';
import { arrOf } from './lib/questions.js';
import { nextStep, backStep, visibleAnswers, validAnswers } from './lib/intakeFlow.js';
import { QMAP } from './lib/questions.js';
import { GOALS } from './lib/data.js';
import { savePlan, loadPlan, deletePlan } from './api.js';
import { track, startSession, getSid, trackingAllowed } from './lib/track.js';
import { outcomeSummary } from './lib/outcome.js';

const STORE_KEY = 'closa:v1';

const initial = {
  screen: 'landing', // landing | intake | email | plan | providers
  qid: 'Q0', hist: [], emergency: false,
  answers: {}, upload: null, pre: {},
  email: '', name: '', launchOptin: false,
  activeCat: 'gyn', city: 'Lagos', token: null,
};

// Keeps an in-progress intake across a page refresh. The email, name and tickbox are never stored here.
function restore() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
    if (!saved) return initial;
    const screen = saved.screen === 'providers' ? 'plan' : saved.screen;
    // Progress saved before the questionnaire changed may use answers we no longer recognise.
    const answers = validAnswers(saved.answers);
    const qid = QMAP[saved.qid] || saved.qid === 'UP' ? saved.qid : 'Q0';
    return { ...initial, ...saved, answers, qid, hist: (saved.hist || []).filter((h) => QMAP[h] || h === 'UP'), screen, upload: null, pre: {} };
  } catch (e) {
    return initial;
  }
}

// The link in the email looks like /plan/<token>.
const tokenFromPath = () => (window.location.pathname.match(/^\/plan\/([\w-]{10,})\/?$/) || [])[1] || null;

export default function App() {
  const linkToken = tokenFromPath();
  const [s, setS] = useState(() => (linkToken ? initial : restore()));
  const [linkState, setLinkState] = useState(linkToken ? 'loading' : 'none'); // loading | missing | none
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // setState accepts an object (merged) or a function of the previous state.
  const patch = useCallback((p) => setS((prev) => ({ ...prev, ...(typeof p === 'function' ? p(prev) : p) })), []);

  // Open a saved plan from the emailed link.
  useEffect(() => {
    if (!linkToken) return;
    loadPlan(linkToken)
      .then((r) => { patch({ answers: r.answers, email: r.email, name: r.name || '', token: linkToken, screen: 'plan' }); setLinkState('none'); })
      .catch(() => setLinkState('missing'));
  }, [linkToken, patch]);

  // Remember progress for refreshes.
  useEffect(() => {
    try {
      const { email, name, launchOptin, upload, ...keep } = s;
      sessionStorage.setItem(STORE_KEY, JSON.stringify(keep));
    } catch (e) { /* storage may be blocked; the app works without it */ }
  }, [s]);

  useEffect(() => { window.scrollTo(0, 0); }, [s.screen, s.qid, s.emergency]);

  // ---- anonymous usage statistics (see lib/track.js) ----
  useEffect(() => { startSession(); }, []);
  const prevScreen = useRef(null);
  useEffect(() => {
    if (s.screen === 'intake' && !s.emergency) track('question_view', { step: s.qid });
    if (s.screen === 'intake' && s.emergency) {
      (s.answers.Q0 || []).filter((c) => c !== 'none').forEach((c) => track('safety_screen', { source: c }));
    }
    if (s.screen === 'email') track('email_view');
    if (s.screen === 'plan' && prevScreen.current !== 'providers') track('plan_view', { source: linkToken ? 'link' : 'new' });
    prevScreen.current = s.screen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.screen, s.qid, s.emergency]);

  const start = (source) => {
    track('cta_click', { source });
    // Goal cards fill in the first question (at most 3 answers, no repeats).
    const picked = [...new Set(GOALS.filter((x) => s.pre[x.key]).flatMap((x) => x.codes))].slice(0, 3);
    patch((prev) => ({
      screen: 'intake', qid: 'Q0', hist: [], emergency: false,
      answers: picked.length ? { ...prev.answers, Q1: picked } : prev.answers,
    }));
  };

  // Called after an answer. fromQid stops a delayed auto-advance from firing twice.
  const onNext = (answers, fromQid) => patch((prev) => {
    if (fromQid && prev.qid !== fromQid) return {};
    return nextStep({ qid: prev.qid, emergency: prev.emergency, answers, hist: prev.hist });
  });
  const onBack = () => patch((prev) => backStep(prev));

  const onCsv = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    f.text().then((txt) => {
      const r = parseCycleCsv(txt);
      track('csv_upload', { source: r.q5 ? 'suggested' : 'none' });
      patch((prev) => {
        const A = { ...prev.answers };
        if (r.q5) A.Q5 = r.q5;
        if (r.spotting) A.Q9 = [...arrOf(A, 'Q9').filter((c) => c !== 'none' && c !== 'between'), 'between'];
        return { upload: { name: f.name, ...r }, answers: A };
      });
    });
  };

  const submitEmail = async () => {
    setSaving(true); setSaveError(false);
    try {
      const r = await savePlan({
        email: s.email.trim(), name: s.name.trim() || undefined, consent: true, // pressing "See my plan" is the agreement
        launch_optin: s.launchOptin, answers: visibleAnswers(s.answers), sid: trackingAllowed() ? getSid() : undefined, outcome: outcomeSummary(evaluate(visibleAnswers(s.answers))),
      });
      window.history.replaceState(null, '', '/plan/' + r.token);
      patch({ token: r.token, screen: 'plan' });
    } catch (e) {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // Deletes the saved plan on the server, then starts over on the landing page.
  const onDelete = async () => {
    try {
      await deletePlan(s.token);
    } catch (e) {
      if (e.status !== 404) return false; // 404 means it was already gone
    }
    try { sessionStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    window.history.replaceState(null, '', '/');
    setS(initial);
    return true;
  };

  const onAction = (cat, from) => {
    if (cat === 'emerg') { window.location.href = 'tel:112'; return; }
    track('plan_action', { category: cat, source: from, token: s.token });
    patch({ activeCat: cat, screen: 'providers' });
  };

  // ---- screens ----
  if (linkState === 'loading') return <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}><p>Opening your care plan…</p></div>;
  if (linkState === 'missing') {
    return (
      <div className="screen" style={{ alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24, textAlign: 'center' }}>
        <img className="logo" src="/brand/lockup-aubergine.png" alt="Closa Health" />
        <h1 style={{ fontWeight: 400, fontSize: 28 }}>We couldn’t find that care plan.</h1>
        <p className="small-muted" style={{ maxWidth: 420 }}>The link may be old, or the plan may have been deleted. You can make a new one in about 5 minutes.</p>
        <a className="btn" href="/">Get my free care plan</a>
      </div>
    );
  }

  const hasAnswers = arrOf(s.answers, 'Q1').length > 0;

  if (s.screen === 'plan' && hasAnswers) return <Plan answers={s.answers} email={s.email} name={s.name} canDelete={!!s.token} onAction={onAction} onDelete={onDelete} />;
  if (s.screen === 'providers' && hasAnswers) {
    return <Providers cat={s.activeCat} city={s.city} setCity={(city) => patch({ city })} onBack={() => patch({ screen: 'plan' })} />;
  }
  if (s.screen === 'email') {
    return (
      <Email
        state={s} setState={patch} saving={saving} error={saveError}
        onBack={onBack} onSubmit={submitEmail}
        onSkipSave={() => patch({ screen: 'plan' })}
      />
    );
  }
  if (s.screen === 'intake') return <Intake state={s} setState={patch} onNext={(a) => onNext(a, s.qid)} onBack={onBack} onCsv={onCsv} />;
  return <Landing pre={s.pre} setPre={(pre) => patch({ pre })} onStart={start} />;
}
