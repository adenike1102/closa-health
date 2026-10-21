// Tests for what is new in questionnaire v2 (see reference/Closa Intake and Care Plan Rules v2.docx).
import { describe, it, expect } from 'vitest';
import { evaluate } from '../evaluate.js';
import { visibleQuestions, nextStep, backStep, toggleMulti, visibleAnswers, validAnswers, needsMoodSupport } from '../intakeFlow.js';
import { GOALS } from '../data.js';
import { QUESTIONS, QMAP } from '../questions.js';
import { CONTENT } from '../content.js';
import { outcomeSummary } from '../outcome.js';

const base = { Q0: ['none'], Q1: ['less_pain'], Q2: '20_34', Q3: 'no', Q4: 'none', Q5: 'regular', Q7: ['none'], Q9: ['none'], Q10: 'none', Q12: ['none'], Q14: ['none'], Q15: ['none'], Q16: 'not_planning' };
const run = (over = {}) => evaluate({ ...base, ...over });
const flags = (P) => Object.keys(P.F).filter((k) => P.F[k].on);
const ids = (A) => visibleQuestions(A).map((q) => q.id);

describe('goals (question 1)', () => {
  it('has the 11 goals, up to 3 can be picked', () => {
    const q = QMAP.Q1;
    expect(q.options).toHaveLength(11);
    expect(q.max).toBe(3);
  });
  it('ignores a fourth pick', () => {
    let v = [];
    for (const c of ['less_pain', 'regular_periods', 'get_pregnant', 'steady_mood']) v = toggleMulti(v, c, 3);
    expect(v).toEqual(['less_pain', 'regular_periods', 'get_pregnant']);
  });
  it('lets her un-pick one to choose another', () => {
    let v = ['less_pain', 'regular_periods', 'get_pregnant'];
    v = toggleMulti(v, 'regular_periods', 3);
    v = toggleMulti(v, 'steady_mood', 3);
    expect(v).toEqual(['less_pain', 'get_pregnant', 'steady_mood']);
  });
  it('every landing goal card points at real options', () => {
    const real = QMAP.Q1.options.map((o) => o.code);
    for (const g of GOALS) for (const c of g.codes) expect(real).toContain(c);
    expect(GOALS).toHaveLength(6);
  });
  it('the cards fill in at most 3 answers, with no repeats (same rule the page uses)', () => {
    const picked = (keys) => [...new Set(GOALS.filter((g) => keys.includes(g.key)).flatMap((g) => g.codes))].slice(0, 3);
    expect(picked(['more_energy'])).toEqual(['more_energy', 'steady_mood']);
    expect(picked(['less_pain', 'more_energy', 'get_pregnant'])).toEqual(['less_pain', 'get_pregnant', 'more_energy']); // card order, first 3
    expect(picked(['less_pain', 'less_pain'])).toEqual(['less_pain']);
  });
});

describe('new skip logic', () => {
  it('asks about heavy-bleeding signs when the goal is lighter periods or more energy', () => {
    expect(ids({ Q1: ['lighter_periods'] })).toContain('Q8');
    expect(ids({ Q1: ['more_energy'] })).toContain('Q8');
    expect(ids({ Q1: ['less_pain'], Q7: ['none'] })).not.toContain('Q8');
  });
  it('asks about pain details for pain during sex even with no period pain', () => {
    expect(ids({ Q1: ['sex_pain'], Q10: 'none' })).toContain('Q11');
    expect(ids({ Q1: ['less_pain'], Q10: 'none' })).not.toContain('Q11');
  });
  it('asks about the week before a period only when she has periods', () => {
    expect(ids({ Q5: 'regular' })).toContain('Q17');
    for (const c of ['never', 'menopause', 'none_3m']) expect(ids({ Q5: c })).not.toContain('Q17');
  });
  it('asks the mood safety question only after low mood is ticked', () => {
    expect(ids({ Q5: 'regular', Q17: ['pm_low'] })).toContain('Q18');
    expect(ids({ Q5: 'regular', Q17: ['pm_physical'] })).not.toContain('Q18');
    expect(ids({ Q5: 'regular', Q17: ['pm_mood'] })).not.toContain('Q18');
  });
  it('always asks when it started and how many days a month are affected', () => {
    expect(ids({})).toEqual(expect.arrayContaining(['Q19', 'Q20']));
  });
  it('is in the order of the spec', () => {
    const order = QUESTIONS.map((q) => q.id);
    expect(order.slice(0, 4)).toEqual(['Q0', 'Q1', 'Q19', 'Q2']);
    expect(order.indexOf('Q17')).toBeGreaterThan(order.indexOf('Q11'));
    expect(order.indexOf('Q18')).toBe(order.indexOf('Q17') + 1);
    expect(order.indexOf('Q20')).toBeLessThan(order.indexOf('Q14'));
  });
});

describe('the mood support screen', () => {
  it('opens after Q18 = yes and only then', () => {
    expect(needsMoodSupport({ Q18: 'yes' })).toBe(true);
    expect(needsMoodSupport({ Q18: 'no' })).toBe(false);
    expect(needsMoodSupport({ Q18: 'prefer_not' })).toBe(false);
  });
  it('is shown before moving on, then continues', () => {
    expect(nextStep({ qid: 'Q18', emergency: false, answers: { Q18: 'yes' }, hist: [] })).toEqual({ emergency: true });
    const after = nextStep({ qid: 'Q18', emergency: true, answers: { Q18: 'yes' }, hist: ['Q17'] });
    expect(after.emergency).toBe(false);
    expect(after.qid).not.toBe('Q18');
  });
  it('does not interrupt for no or prefer not to say', () => {
    for (const a of ['no', 'prefer_not']) {
      const r = nextStep({ qid: 'Q18', emergency: false, answers: { Q18: a, Q5: 'regular', Q17: ['pm_low'] }, hist: [] });
      expect(r.emergency).toBe(false);
    }
  });
  it('back from the screen returns to the question', () => {
    expect(backStep({ screen: 'intake', qid: 'Q18', emergency: true, hist: ['Q17'] })).toEqual({ emergency: false });
  });
  it('lists the helplines as phone numbers a phone can dial', () => {
    const body = CONTENT.support.mood.body;
    for (const n of ['0809 111 6264', '0800 078 7746', '0800 800 2000']) expect(body).toContain(n);
    expect(body).toContain('112');
  });
});

describe('mood in the plan', () => {
  const mood = { Q5: 'regular', Q17: ['pm_low'], Q18: 'yes' };
  it('Q18 = yes: urgent within 1-2 days, a pinned support banner and a doctor first', () => {
    const P = run(mood);
    expect(P.urgency.level).toBeLessThanOrEqual(2);
    expect(P.banners.some((b) => b.code === 'mood' && b.u1 === false)).toBe(true);
    expect(P.who[0].stop).toMatch(/mental health professional/);
  });
  it('it never lowers a more urgent level', () => {
    expect(run({ ...mood, Q0: ['s2_sudden_pain'] }).urgency.level).toBe(1);
  });
  it('Q18 = prefer not to say: support banner, but the urgency is not forced up', () => {
    const P = run({ Q5: 'regular', Q17: ['pm_low'], Q18: 'prefer_not' });
    expect(P.banners.some((b) => b.code === 'mood')).toBe(true);
    expect(P.urgency.level).toBe(5);
  });
  it('Q18 = no: nothing is added', () => {
    const P = run({ Q5: 'regular', Q17: ['pm_low'], Q18: 'no' });
    expect(P.banners.some((b) => b.code === 'mood')).toBe(false);
  });
  it('never puts the mood answer into the dashboard summary', () => {
    const o = outcomeSummary(run(mood));
    expect(o.safety).not.toContain('mood');
    expect(JSON.stringify(o)).not.toMatch(/MOOD/i);
  });
});

describe('premenstrual flags', () => {
  it('F-PMDD: mood symptoms, with impact, that settle after the period', () => {
    const P = run({ Q17: ['pm_mood', 'pm_impact', 'pm_resolves'] });
    expect(flags(P)).toContain('F-PMDD');
    expect(flags(P)).not.toContain('F-PMS');
    expect(P.urgency.level).toBe(4);
    expect(P.possibilities.some((p) => /premenstrual/i.test(p.title))).toBe(true);
  });
  it('low mood counts too', () => {
    expect(flags(run({ Q17: ['pm_low', 'pm_impact', 'pm_resolves'] }))).toContain('F-PMDD');
  });
  it('F-PMS: symptoms that settle, without a big impact', () => {
    const P = run({ Q17: ['pm_physical', 'pm_resolves'] });
    expect(flags(P)).toContain('F-PMS');
    expect(flags(P)).not.toContain('F-PMDD');
  });
  it('neither without the "settles after my period" answer', () => {
    const f = flags(run({ Q17: ['pm_mood', 'pm_impact'] }));
    expect(f).not.toContain('F-PMDD');
    expect(f).not.toContain('F-PMS');
  });
  it('is ignored when it is not asked (no periods)', () => {
    const A = visibleAnswers({ ...base, Q5: 'never', Q2: '20_34', Q17: ['pm_mood', 'pm_impact', 'pm_resolves'] });
    expect(flags(evaluate(A))).not.toContain('F-PMDD');
  });
});

describe('other v2 rules', () => {
  it('days affected per month: 3 or more raises routine to 4-6 weeks', () => {
    expect(run({ Q5: 'infrequent' }).urgency.level).toBe(5);
    expect(run({ Q5: 'infrequent', Q20: 'd3_5' }).urgency.level).toBe(4);
    expect(run({ Q5: 'infrequent', Q20: 'd5p' }).urgency.level).toBe(4);
    expect(run({ Q5: 'infrequent', Q20: 'd1_2' }).urgency.level).toBe(5);
  });
  it('F-ENDOMRISK also for 40-44, onset under 3 months and heavy or between-period bleeding', () => {
    expect(flags(run({ Q2: '40_44', Q19: 'lt3m', Q9: ['between'] }))).toContain('F-ENDOMRISK');
    expect(flags(run({ Q2: '40_44', Q19: 'gt3y', Q9: ['between'] }))).not.toContain('F-ENDOMRISK');
    expect(flags(run({ Q2: '20_34', Q19: 'lt3m', Q9: ['between'] }))).not.toContain('F-ENDOMRISK');
  });
  it('long-standing symptoms with a flag add a validating note', () => {
    const P = run({ Q7: ['clots'], Q19: 'gt3y' });
    expect(P.notes.join(' ')).toMatch(/years/i);
    expect(run({ Q7: ['clots'], Q19: 'since_first' }).notes.join(' ')).toMatch(/years/i);
    expect(run({ Q7: ['clots'], Q19: 'lt3m' }).notes.join(' ')).not.toMatch(/years of symptoms/i);
  });
  it('"on treatment now" adds a note and makes her own doctor the first stop, with no provider button', () => {
    const P = run({ Q7: ['clots'], Q15: ['on_treatment'] });
    expect(P.who[0].cat).toBe('own');
    expect(P.who[0].stop).toMatch(/already treating you/);
    expect(P.notes.join(' ')).toMatch(/treatment/i);
  });
  it('the doctor summary says when it started and how many days a month are affected', () => {
    const s = run({ Q1: ['less_pain'], Q19: 'gt3y', Q20: 'd3_5' }).summary;
    expect(s).toMatch(/started/i);
    expect(s).toMatch(/Days affected per month/);
  });
  it('the doctor summary mentions the premenstrual symptoms', () => {
    expect(run({ Q17: ['pm_mood', 'pm_resolves'] }).summary).toMatch(/Premenstrual/);
  });
  it('PMOS replaces PCOS in what women read (PCOS only appears as "previously called PCOS")', () => {
    const copy = JSON.stringify(CONTENT) + JSON.stringify(QUESTIONS.map((q) => [q.title, q.help, q.options?.map((o) => o.label)]));
    const stray = [...copy.matchAll(/.{0,20}PCOS/g)].map((m) => m[0]).filter((t) => !/previously (called )?PCOS$/.test(t));
    expect(stray).toEqual([]);
    expect(QMAP.Q14.options.some((o) => o.label.includes('PMOS (polyendocrine metabolic ovarian syndrome, previously called PCOS)'))).toBe(true);
  });
});

describe('hidden answers are ignored', () => {
  it('drops the mood answer if low mood is un-ticked', () => {
    const v = visibleAnswers({ ...base, Q17: ['pm_physical'], Q18: 'yes' });
    expect(v.Q18).toBeUndefined();
    expect(evaluate(v).urgency.level).toBe(5);
  });
  it('drops pain details when pain is "none" and she did not pick pain during sex', () => {
    expect(visibleAnswers({ ...base, Q10: 'none', Q11: ['deep_sex_pain'] }).Q11).toBeUndefined();
    expect(visibleAnswers({ ...base, Q10: 'mild', Q11: ['worsening'] }).Q11).toEqual(['worsening']);
  });
  it('keeps answers to questions that have no skip rule', () => {
    expect(visibleAnswers(base).Q2).toBe('20_34');
  });
});

describe('progress saved by an older version of the questionnaire', () => {
  it('drops answers the new questionnaire does not recognise', () => {
    const v = validAnswers({ Q1: ['pain', 'less_pain'], Q2: '20_34', Q3: 'maybe', Q14: ['pcos', 'fibroids'], Q99: 'x', Q5: ['regular'] });
    expect(v).toEqual({ Q1: ['less_pain'], Q2: '20_34', Q14: ['fibroids'] });
  });
  it('copes with nothing at all', () => {
    expect(validAnswers(undefined)).toEqual({});
    expect(validAnswers({})).toEqual({});
  });
});
