// Pure helpers for moving through the intake. Kept free of React so they are easy to test.
import { QUESTIONS, arrOf } from './questions.js';

// Questions that apply for these answers (skip logic lives in each question's show()).
export const visibleQuestions = (answers) => QUESTIONS.filter((q) => !q.show || q.show(answers));

// Does the safety screen need to be shown after Q0?
export const hasSafetyFlags = (answers) => arrOf(answers, 'Q0').some((c) => c !== 'none');

// Where to go after the current step. `emergency` is true while the safety screen is showing.
export function nextStep({ qid, emergency, answers, hist }) {
  if (qid === 'Q0' && !emergency && hasSafetyFlags(answers)) {
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

// Toggle an option in a multi-choice answer. "None of these" is exclusive.
export function toggleMulti(current, code) {
  if (code === 'none') return current.includes('none') ? [] : ['none'];
  const without = current.filter((c) => c !== 'none');
  return without.includes(code) ? without.filter((c) => c !== code) : [...without, code];
}
