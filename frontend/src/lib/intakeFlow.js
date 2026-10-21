// Pure helpers for moving through the intake. Kept free of React so they are easy to test.
import { QUESTIONS, QMAP, arrOf } from './questions.js';

// Questions that apply for these answers (skip logic lives in each question's show()).
export const visibleQuestions = (answers) => QUESTIONS.filter((q) => !q.show || q.show(answers));

// Does the safety screen need to be shown after Q0?
export const hasSafetyFlags = (answers) => arrOf(answers, 'Q0').some((c) => c !== 'none');

// Does the mood support screen need to be shown after Q18?
export const needsMoodSupport = (answers) => answers.Q18 === 'yes';

// Where to go after the current step. `emergency` is true while a safety screen is showing
// (the emergency cards after Q0, or the mood support card after Q18).
export function nextStep({ qid, emergency, answers, hist }) {
  if (!emergency && ((qid === 'Q0' && hasSafetyFlags(answers)) || (qid === 'Q18' && needsMoodSupport(answers)))) {
    return { emergency: true };
  }
  const vis = visibleQuestions(answers);
  const i = vis.findIndex((q) => q.id === qid);
  const nx = vis[i + 1];
  if (nx) return { qid: nx.id, hist: [...hist, qid], emergency: false };
  return { screen: 'email', hist: [...hist, qid], emergency: false };
}

// Where to go on Back. `screen` is 'intake' or 'email'.
export function backStep({ screen, qid, emergency, hist }) {
  if (screen === 'email') {
    const h = hist.slice();
    const prev = h.pop();
    return { screen: 'intake', qid: prev || 'Q0', hist: h };
  }
  if (emergency) return { emergency: false };
  if (!hist.length) return { screen: 'landing' };
  const h = hist.slice();
  const prev = h.pop();
  return { qid: prev, hist: h };
}

// Toggle an option in a multi-choice answer. "None of these" is exclusive, and `max` (if given) caps the picks:
// taps beyond the cap are ignored.
export function toggleMulti(current, code, max) {
  if (code === 'none') return current.includes('none') ? [] : ['none'];
  const without = current.filter((c) => c !== 'none');
  if (without.includes(code)) return without.filter((c) => c !== code);
  if (max && without.length >= max) return without;
  return [...without, code];
}

// Answers to questions that are hidden by skip logic are ignored when the plan is built or saved
// (for example, if she goes back and changes an earlier answer).
export const visibleAnswers = (answers) =>
  Object.fromEntries(Object.entries(answers).filter(([k]) => !QMAP[k] || !QMAP[k].show || QMAP[k].show(answers)));

// Drops answers that this version of the questionnaire doesn't recognise (for example progress saved in the
// browser before the questionnaire changed).
export function validAnswers(answers) {
  const out = {};
  for (const [k, v] of Object.entries(answers || {})) {
    const q = QMAP[k];
    if (!q || q.type === 'upload') continue;
    const codes = q.options.map((o) => o.code);
    if (q.type === 'single') {
      if (typeof v === 'string' && codes.includes(v)) out[k] = v;
    } else if (Array.isArray(v)) {
      const keep = v.filter((c) => codes.includes(c));
      if (keep.length) out[k] = keep;
    }
  }
  return out;
}
