import { arrOf } from '../lib/questions.js';
import { CONTENT } from '../lib/content.js';
import { visibleQuestions, toggleMulti } from '../lib/intakeFlow.js';
import { Back, Check, Lock, Upload, FileIcon, Warn, Deco } from './Icons.jsx';

// Shown on desktop beside the form (hidden by CSS on smaller screens).
export function SidePanel({ kicker, title, text, note, noteIcon }) {
  return (
    <aside className="side-panel">
      <img className="mark-img" src="/brand/app-icon-bone.png" alt="Closa Health" />
      <Deco size={420} stroke={6} style={{ right: -140, bottom: -60 }} />
      <div className="side-copy">
        <span className="k">{kicker}</span>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <div className="side-note">{noteIcon}<span>{note}</span></div>
    </aside>
  );
}

// Screen 2: one question per screen.
export default function Intake({ state, setState, onNext, onBack, onCsv }) {
  const { qid, emergency, answers, upload } = state;
  const vis = visibleQuestions(answers);
  let qi = vis.findIndex((q) => q.id === qid);
  if (qi < 0) qi = 0;
  const q = vis[qi];
  const isMulti = q.type === 'multi';
  const cur = arrOf(answers, q.id);
  const counter = 'Question ' + (qi + 1) + ' of ' + vis.length;

  const choose = (code) => {
    if (isMulti) {
      setState({ answers: { ...answers, [q.id]: toggleMulti(cur, code) } });
    } else {
      setState({ answers: { ...answers, [q.id]: code } });
      // Single choice moves on by itself after a short pause so she sees her pick.
      setTimeout(() => onNext({ ...answers, [q.id]: code }), 220);
    }
  };

  const suggested = q.id === 'Q5' && upload && upload.q5 && answers.Q5 === upload.q5;
  const answered = q.type === 'upload' ? true : cur.length > 0;

  return (
    <div className="screen form-screen">
      <SidePanel
        kicker={counter}
        title="A few short questions."
        text="Answer what you can. You can go back and change an answer at any time."
        note="Your answers are private."
        noteIcon={<Lock color="#D8C6D1" size={20} />}
      />
      <div className="form-col">
        <header className="form-head">
          <div className="form-head-row">
            <button className="icon-btn" onClick={onBack} aria-label="Back"><Back /></button>
            <span>{counter}</span>
            <span style={{ width: 44 }} />
          </div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={vis.length} aria-valuenow={qi + 1}>
            <div style={{ width: ((qi + 1) / vis.length) * 100 + '%' }} />
          </div>
        </header>

        {!emergency ? (
          <>
            <main className="q-main">
              <div>
                <h2 className="q-title">{q.title}</h2>
                {q.help && <p className="q-help">{q.help}</p>}
              </div>
              {suggested && (
                <div className="q-note">
                  <Check size={20} color="#4A2545" />
                  <span>We suggested this from your period app. Change it if it doesn’t look right.</span>
                </div>
              )}
              {q.type !== 'upload' && (
                <div className="options" role={isMulti ? 'group' : 'radiogroup'} aria-label={q.title}>
                  {q.options.map((op) => {
                    const sel = cur.includes(op.code);
                    return (
                      <button key={op.code} className={'opt' + (sel ? ' sel' : '')} onClick={() => choose(op.code)} aria-pressed={sel}>
                        <span>{op.label}</span>
                        <span className={'mark' + (isMulti ? ' sq' : '')}>{sel && <Check />}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {q.type === 'upload' && <UploadStep upload={upload} onCsv={onCsv} onClear={() => setState({ upload: null })} />}
            </main>
            <div className="bottom-bar">
              <button className="btn btn-block" disabled={!answered} onClick={() => onNext(answers)}>
                {q.type === 'upload' ? (upload ? 'Continue' : 'Continue without a file') : 'Continue'}
              </button>
              {q.optional && <button className="btn-text" onClick={() => onNext(answers)}>Skip for now</button>}
            </div>
          </>
        ) : (
          <>
            <main className="q-main sm" style={{ gap: 16 }}>
              {arrOf(answers, 'Q0').filter((c) => c !== 'none').map((c) => {
                const item = CONTENT.q0[c];
                return item.u1 ? (
                  <div key={c} className="emerg-card">
                    <div className="top"><span className="emerg-icon"><Warn /></span><h2>{item.title}</h2></div>
                    <p>{item.body}</p>
                    <a className="call-btn" href="tel:112">Call 112</a>
                  </div>
                ) : (
                  <div key={c} className="book-card"><h2>{item.title}</h2><p>{item.body}</p></div>
                );
              })}
              <p className="small-muted" style={{ fontSize: 15 }}>This message will stay at the top of your care plan. You can carry on with the questions when you’re ready.</p>
            </main>
            <div className="bottom-bar">
              <button className="btn btn-block btn-outline" onClick={() => onNext(answers)}>I understand, continue</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Optional step: read a period-app CSV in the browser. The file itself is never uploaded.
function UploadStep({ upload, onCsv, onClear }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label className="drop">
        <input type="file" accept=".csv,text/csv" onChange={onCsv} />
        <Upload />
        <b>Add a CSV export</b>
        <small>From Flo, Clue or another period app</small>
      </label>
      {upload && (
        <div className="upload-res">
          <div className="row"><FileIcon /><span>{upload.name}</span><button onClick={onClear}>Remove</button></div>
          <span>{upload.message}</span>
          <span className="small-muted">We’ve deleted the file. Only the suggestion is kept.</span>
        </div>
      )}
      <p className="small-muted">We read your period start dates from the last 6 months and suggest an answer for the next question. You can always change it.</p>
    </div>
  );
}

