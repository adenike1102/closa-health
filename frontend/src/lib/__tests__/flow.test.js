import { describe, it, expect } from 'vitest';
import { visibleQuestions, nextStep, backStep, toggleMulti, hasSafetyFlags } from '../intakeFlow.js';
import { parseCycleCsv } from '../cycleCsv.js';
import { buildSchema } from '../../../../scripts/export_schema.mjs';
import { readFileSync } from 'node:fs';

const ids = (A) => visibleQuestions(A).map((q) => q.id);

describe('skip logic', () => {
  it('starts with the safety screen', () => expect(ids({})[0]).toBe('Q0'));
  it('asks about recent pregnancy only for missed or irregular periods', () => {
    expect(ids({ Q5: 'regular' })).not.toContain('Q6');
    expect(ids({ Q5: 'none_3m' })).toContain('Q6');
  });
  it('asks about pain details only when there is pain', () => {
    expect(ids({ Q10: 'none' })).not.toContain('Q11');
    expect(ids({ Q10: 'mild' })).toContain('Q11');
  });
  it('asks the lifestyle question only for missing/irregular cycles', () => {
    expect(ids({ Q5: 'regular' })).not.toContain('Q13');
    expect(ids({ Q5: 'never' })).toContain('Q13');
  });
  it('asks the trying-to-conceive follow-ups only when trying now', () => {
    expect(ids({ Q16: 'later' })).not.toContain('T1');
    expect(ids({ Q16: 'trying_now' })).toEqual(expect.arrayContaining(['T1', 'T2', 'T3']));
  });
  it('asks about anaemia symptoms when periods are heavy', () => {
    expect(ids({ Q1: ['lighter_periods'] })).toContain('Q8');
  });
});

describe('moving through the intake', () => {
  it('shows the safety screen before leaving Q0 when something applies', () => {
    const r = nextStep({ qid: 'Q0', emergency: false, answers: { Q0: ['s2_sudden_pain'] }, hist: [] });
    expect(r).toEqual({ emergency: true });
  });
  it('continues after the safety screen', () => {
    const r = nextStep({ qid: 'Q0', emergency: true, answers: { Q0: ['s2_sudden_pain'] }, hist: [] });
    expect(r.qid).toBe('Q1');
    expect(r.emergency).toBe(false);
  });
  it('skips the safety screen for "none"', () => {
    expect(hasSafetyFlags({ Q0: ['none'] })).toBe(false);
    expect(nextStep({ qid: 'Q0', emergency: false, answers: { Q0: ['none'] }, hist: [] }).qid).toBe('Q1');
  });
  it('goes to the email screen after the last question', () => {
    const last = visibleQuestions({}).at(-1).id;
    expect(nextStep({ qid: last, emergency: false, answers: {}, hist: ['Q1'] }).screen).toBe('email');
  });
  it('goes back through history, then to the landing page', () => {
    expect(backStep({ screen: 'intake', qid: 'Q2', emergency: false, hist: ['Q0', 'Q1'] })).toEqual({ qid: 'Q1', hist: ['Q0'] });
    expect(backStep({ screen: 'intake', qid: 'Q0', emergency: false, hist: [] })).toEqual({ screen: 'landing' });
    expect(backStep({ screen: 'intake', qid: 'Q0', emergency: true, hist: [] })).toEqual({ emergency: false });
  });
  it('goes back from the email screen to the last question', () => {
    expect(backStep({ screen: 'email', qid: 'x', emergency: false, hist: ['Q1', 'Q16'] })).toEqual({ screen: 'intake', qid: 'Q16', hist: ['Q1'] });
  });
  it('"none of these" clears the others and is cleared by them', () => {
    expect(toggleMulti(['pain'], 'none')).toEqual(['none']);
    expect(toggleMulti(['none'], 'pain')).toEqual(['pain']);
    expect(toggleMulti(['none'], 'none')).toEqual([]);
    expect(toggleMulti(['pain'], 'pain')).toEqual([]);
    expect(toggleMulti(['pain'], 'heavy')).toEqual(['pain', 'heavy']);
  });
});

describe('period-app CSV', () => {
  const day = 864e5;
  const iso = (daysAgo) => new Date(Date.now() - daysAgo * day).toISOString().slice(0, 10);
  const csv = (agos) => 'date,type\n' + agos.map((a) => iso(a) + ',period').join('\n');
  it('suggests regular for ~28 day cycles', () => {
    expect(parseCycleCsv(csv([150, 149, 122, 121, 94, 93, 66, 65, 38, 37, 10, 9])).q5).toBe('regular');
  });
  it('suggests infrequent for ~45 day cycles', () => {
    expect(parseCycleCsv(csv([170, 125, 80, 35])).q5).toBe('infrequent');
  });
  it('suggests frequent for ~20 day cycles', () => {
    expect(parseCycleCsv(csv([100, 80, 60, 40, 20])).q5).toBe('frequent');
  });
  it('suggests none for 3 months when the last period was long ago', () => {
    expect(parseCycleCsv(csv([175, 147, 119, 100])).q5).toBe('none_3m');
  });
  it('suggests unpredictable for wildly varying gaps', () => {
    expect(parseCycleCsv(csv([160, 140, 100, 80, 40, 10])).q5).toBe('unpredictable');
  });
  it('gives no suggestion for fewer than 3 cycles', () => {
    const r = parseCycleCsv(csv([60, 30]));
    expect(r.q5).toBeNull();
    expect(r.message).toMatch(/fewer than 3/);
  });
  it('notices spotting between periods', () => {
    const text = csv([150, 122, 94, 66, 38, 10]) + '\n' + iso(20) + ',spotting';
    expect(parseCycleCsv(text).spotting).toBe(true);
  });
  it('copes with junk and empty files', () => {
    expect(parseCycleCsv('').q5).toBeNull();
    expect(parseCycleCsv('hello\nworld').q5).toBeNull();
  });
  it('reads day/month/year dates', () => {
    const d = new Date(Date.now() - 20 * day);
    expect(() => parseCycleCsv(`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()},period`)).not.toThrow();
  });
});

describe('server answer list', () => {
  it('api/data/questions_schema.json matches the questions (run: node scripts/export_schema.mjs)', () => {
    const file = JSON.parse(readFileSync(new URL('../../../../api/data/questions_schema.json', import.meta.url), 'utf8'));
    expect(file).toEqual(buildSchema());
  });
});
