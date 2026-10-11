// Tests for the rules engine, written from reference/Closa Intake and Care Plan Rules.docx.
import { describe, it, expect } from 'vitest';
import { evaluate } from '../evaluate.js';

// A "nothing to report" baseline; each test overrides only what it needs.
const base = { Q0: ['none'], Q1: ['pain'], Q2: '20_34', Q3: 'no', Q4: 'none', Q5: 'regular', Q7: ['none'], Q9: ['none'], Q10: 'none', Q12: ['none'], Q14: ['none'], Q15: ['none'], Q16: 'not_planning' };
const run = (over = {}) => evaluate({ ...base, ...over });
const flags = (P) => Object.keys(P.F).filter((k) => P.F[k].on);
const testIds = (P) => P.tests.map((t) => t.id);
const stops = (P) => P.who.map((w) => w.stop);
const titles = (P) => P.possibilities.map((p) => p.title);

describe('urgency (section 4)', () => {
  it.each(['s1_heavy_faint', 's2_sudden_pain', 's3_preg_symptoms', 's4_post_pregnancy'])('U1 for %s', (code) => {
    expect(run({ Q0: [code] }).urgency.level).toBe(1);
  });
  it('U2 for fever with pelvic pain', () => expect(run({ Q12: ['fever_pain'] }).urgency.level).toBe(2));
  it('U2 for heavy bleeding with dizziness', () => expect(run({ Q7: ['clots'], Q8: ['dizzy'] }).urgency.level).toBe(2));
  it('U3 for post-menopausal bleeding', () => expect(run({ Q0: ['s5_postmeno_bleed'] }).urgency.level).toBe(3));
  it('U3 for bleeding after sex', () => expect(run({ Q9: ['after_sex'] }).urgency.level).toBe(3));
  it('U3 for a bulk plus age 45+', () => expect(run({ Q12: ['bulk'], Q2: '45_54' }).urgency.level).toBe(3));
  it('U4 for heavy periods', () => expect(run({ Q7: ['clots'] }).urgency.level).toBe(4));
  it('U5 for irregular periods', () => expect(run({ Q5: 'infrequent' }).urgency.level).toBe(5));
  it('severe impact raises U5 to U4', () => expect(run({ Q5: 'infrequent', Q10: 'severe' }).urgency.level).toBeLessThanOrEqual(4));
  it('the most urgent rule wins', () => expect(run({ Q0: ['s2_sudden_pain'], Q7: ['clots'], Q5: 'frequent' }).urgency.level).toBe(1));
  it('reassures when nothing flags', () => {
    const P = run({ Q10: 'none' });
    expect(P.reassure).toBe(true);
    expect(P.urgency.level).toBe(5);
  });
});

describe('flags (section 3)', () => {
  it('F-HMB from any heavy-bleeding sign', () => {
    for (const c of ['change_1_2h', 'clots', 'gt8_days', 'flooding']) expect(flags(run({ Q7: [c] }))).toContain('F-HMB');
  });
  it('F-ANAEMIA from tiredness, dizziness or pica', () => {
    for (const c of ['fatigue', 'dizzy', 'pica']) expect(flags(run({ Q8: [c] }))).toContain('F-ANAEMIA');
  });
  it('F-FIBROID needs heavy bleeding plus bulk or known fibroids', () => {
    expect(flags(run({ Q7: ['clots'], Q12: ['bulk'] }))).toContain('F-FIBROID');
    expect(flags(run({ Q7: ['clots'], Q14: ['fibroids'] }))).toContain('F-FIBROID');
    expect(flags(run({ Q12: ['bulk'] }))).not.toContain('F-FIBROID');
  });
  it('F-ENDO from deep pain during sex or bowel/bladder pain', () => {
    expect(flags(run({ Q10: 'moderate', Q11: ['deep_sex_pain'] }))).toContain('F-ENDO');
    expect(flags(run({ Q10: 'moderate', Q11: ['bowel_bladder'] }))).toContain('F-ENDO');
  });
  it('F-ADENO needs heavy + painful periods at 35 or older', () => {
    const a = { Q7: ['clots'], Q10: 'severe' };
    expect(flags(run({ ...a, Q2: '35_39' }))).toContain('F-ADENO');
    expect(flags(run({ ...a, Q2: '20_34' }))).not.toContain('F-ADENO');
  });
  it('F-BLEEDDIS from heavy bleeding since the first period or easy bruising', () => {
    expect(flags(run({ Q7: ['clots'], Q8: ['since_first_period'] }))).toContain('F-BLEEDDIS');
    expect(flags(run({ Q7: ['clots'], Q8: ['bruising'] }))).toContain('F-BLEEDDIS');
  });
  it('F-PRIMDYSM only for mild/moderate pain with no other pain features', () => {
    expect(flags(run({ Q10: 'mild', Q11: ['none'] }))).toContain('F-PRIMDYSM');
    expect(flags(run({ Q10: 'severe', Q11: ['none'] }))).not.toContain('F-PRIMDYSM');
  });
  it('F-PCOS from irregular periods plus hair/acne, dark skin, weight change or a PCOS diagnosis', () => {
    expect(flags(run({ Q5: 'infrequent', Q12: ['hair_acne'] }))).toContain('F-PCOS');
    expect(flags(run({ Q5: 'infrequent', Q14: ['pcos'] }))).toContain('F-PCOS');
    expect(flags(run({ Q5: 'regular', Q12: ['hair_acne'] }))).not.toContain('F-PCOS');
  });
  it('F-POI only below 40', () => {
    const a = { Q5: 'none_3m', Q12: ['hot_flushes'] };
    expect(flags(run({ ...a, Q2: '20_34' }))).toContain('F-POI');
    expect(flags(run({ ...a, Q2: '40_44' }))).not.toContain('F-POI');
  });
  it('F-PERI from 40 with irregular periods or hot flushes', () => {
    expect(flags(run({ Q2: '40_44', Q12: ['hot_flushes'] }))).toContain('F-PERI');
    expect(flags(run({ Q2: '20_34', Q12: ['hot_flushes'] }))).not.toContain('F-PERI');
  });
  it('F-PRIMAMEN needs age 16 or over', () => {
    expect(flags(run({ Q5: 'never', Q2: '16_19' }))).toContain('F-PRIMAMEN');
    expect(flags(run({ Q5: 'never', Q2: 'lt16' }))).not.toContain('F-PRIMAMEN');
  });
  it('breastfeeding after a pregnancy is postpartum, not amenorrhoea', () => {
    const P = run({ Q5: 'none_3m', Q6: 'yes_bf' });
    expect(flags(P)).toContain('F-POSTPARTUM');
    expect(flags(P)).not.toContain('F-AMEN');
  });
  it('F-ASHERMAN: no period after a pregnancy and not breastfeeding', () => {
    expect(flags(run({ Q5: 'none_3m', Q6: 'yes_not_bf' }))).toContain('F-ASHERMAN');
  });
  it('F-ENDOMRISK at 45+ with heavy or between-period bleeding', () => {
    expect(flags(run({ Q2: '45_54', Q9: ['between'] }))).toContain('F-ENDOMRISK');
    expect(flags(run({ Q2: '20_34', Q9: ['between'] }))).not.toContain('F-ENDOMRISK');
  });
  it('F-CONTRA needs hormonal contraception plus bleeding between periods or unpredictable cycles', () => {
    expect(flags(run({ Q4: 'hormonal', Q9: ['between'] }))).toContain('F-CONTRA');
    expect(flags(run({ Q4: 'none', Q9: ['between'] }))).not.toContain('F-CONTRA');
  });
  it('F-PREG when pregnant or unsure', () => {
    expect(flags(run({ Q3: 'yes' }))).toContain('F-PREG');
    expect(flags(run({ Q3: 'unsure' }))).toContain('F-PREG');
    expect(flags(run({ Q3: 'not_active' }))).not.toContain('F-PREG');
  });
});

describe('possibilities (section 3 and 8)', () => {
  it('shows at most 4', () => {
    const P = run({ Q3: 'unsure', Q7: ['clots'], Q8: ['fatigue'], Q9: ['between', 'after_sex'], Q10: 'severe', Q11: ['deep_sex_pain'], Q12: ['bulk', 'discharge'], Q2: '35_39' });
    expect(P.possibilities.length).toBeLessThanOrEqual(4);
  });
  it('hides heavy periods under fibroids', () => {
    const P = run({ Q7: ['clots'], Q12: ['bulk'] });
    expect(titles(P)).toContain('Fibroids');
    expect(titles(P)).not.toContain('Heavy periods');
  });
  it('hides general period pain under endometriosis', () => {
    const P = run({ Q10: 'severe', Q11: ['deep_sex_pain'] });
    expect(titles(P)).toContain('Endometriosis');
    expect(titles(P)).not.toContain('Period pain that needs checking');
  });
  it('explains each one with her own answers', () => {
    const P = run({ Q7: ['clots'] });
    expect(P.possibilities[0].evidence).toMatch(/^Why we suggest this: .*clots/);
  });
  it('uses the fertility-aware wording when she has pregnancy goals', () => {
    const plain = run({ Q7: ['clots'], Q12: ['bulk'], Q16: 'not_planning' }).possibilities.find((p) => p.title === 'Fibroids');
    const fert = run({ Q7: ['clots'], Q12: ['bulk'], Q16: 'within_12m' }).possibilities.find((p) => p.title === 'Fibroids');
    expect(fert.body).not.toBe(plain.body);
    expect(fert.body).toMatch(/fertility/);
  });
});

describe('who to see (section 5)', () => {
  it('sends U1 to the emergency unit', () => {
    const P = run({ Q0: ['s2_sudden_pain'] });
    expect(P.who[0].cat).toBe('emerg');
  });
  it('shows at most 3 stops', () => {
    const P = run({ Q7: ['clots'], Q8: ['fatigue', 'bruising'], Q9: ['between', 'after_sex'], Q10: 'severe', Q11: ['deep_sex_pain'], Q12: ['bulk', 'discharge'], Q14: ['sickle_cell'], Q4: 'hormonal' });
    expect(P.who.length).toBeLessThanOrEqual(3);
  });
  it('heavy periods: GP first, gynaecologist if it continues', () => {
    const P = run({ Q7: ['clots'] });
    expect(stops(P)[0]).toMatch(/GP/);
  });
  it('fibroids go straight to a gynaecologist', () => {
    const P = run({ Q7: ['clots'], Q12: ['bulk'] });
    expect(stops(P)).toContain('A gynaecologist');
  });
  it('seen several times: a consultant gynaecologist replaces the GP first stop', () => {
    const P = run({ Q7: ['clots'], Q15: ['many_visits'] });
    expect(stops(P).join(' ')).not.toMatch(/\bGP\b/);
    expect(P.notes.join(' ')).toMatch(/consultant gynaecologist/);
  });
  it('a contraception problem goes to family planning', () => {
    const P = run({ Q4: 'hormonal', Q9: ['between'] });
    expect(P.who.some((w) => w.cat === 'fp')).toBe(true);
  });
});

describe('tests (section 6)', () => {
  it('heavy periods: blood count and iron', () => {
    const ids = testIds(run({ Q7: ['clots'] }));
    expect(ids).toEqual(expect.arrayContaining(['T-FBC', 'T-FERR']));
  });
  it('pregnancy test first when she could be pregnant', () => {
    const P = run({ Q3: 'unsure', Q7: ['clots'] });
    expect(testIds(P)[0]).toBe('T-PREG');
    expect(P.pregFirst).toBe(true);
  });
  it('no pregnancy test if she is not having sex', () => {
    expect(testIds(run({ Q3: 'not_active', Q5: 'none_3m' }))).not.toContain('T-PREG');
  });
  it('missing periods: pregnancy, thyroid, prolactin and hormone tests', () => {
    expect(testIds(run({ Q5: 'none_3m' }))).toEqual(expect.arrayContaining(['T-PREG', 'T-TFT', 'T-PRL', 'T-FSH']));
  });
  it('fibroids: a pelvic scan, with the "ask for the report" timing', () => {
    const t = run({ Q7: ['clots'], Q12: ['bulk'] }).tests.find((x) => x.id === 'T-USS');
    expect(t.timing).toMatch(/written report/);
  });
  it('endometriosis: a normal scan does not rule it out', () => {
    const t = run({ Q10: 'moderate', Q11: ['deep_sex_pain'] }).tests.find((x) => x.id === 'T-USS');
    expect(t.note).toMatch(/normal scan doesn’t rule out endometriosis/);
  });
  it('hormonal contraception adds a warning to hormone tests', () => {
    const t = run({ Q4: 'hormonal', Q5: 'none_3m' }).tests.find((x) => x.id === 'T-FSH');
    expect(t.note).toMatch(/Hormonal contraception/);
  });
  it('cervical screening only from the configured age band', () => {
    expect(testIds(run({ Q9: ['after_sex'], Q2: '20_34' }))).toContain('T-CERV');
    expect(testIds(run({ Q9: ['after_sex'], Q2: '16_19' }))).not.toContain('T-CERV');
  });
  it('clotting tests for a suspected bleeding disorder', () => {
    expect(testIds(run({ Q7: ['clots'], Q8: ['bruising'] }))).toContain('T-COAG');
  });
  it('no duplicates', () => {
    const ids = testIds(run({ Q7: ['clots'], Q8: ['fatigue'], Q9: ['between', 'after_sex'], Q5: 'none_3m' }));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('asks her to bring previous reports', () => {
    expect(run({ Q7: ['clots'], Q15: ['had_scan'] }).bringReports).toBe(true);
  });
  it('lists womb lining sampling under "may suggest" for post-menopausal bleeding', () => {
    expect(run({ Q0: ['s5_postmeno_bleed'] }).maySuggest.join(' ')).toMatch(/womb lining/i);
  });
});

describe('trying to conceive (section 7)', () => {
  const ttc = (over) => run({ Q16: 'trying_now', T1: 'lt6m', T2: 'normal', T3: ['none'], ...over });
  it('only appears when trying now or within 12 months', () => {
    expect(run({ Q16: 'later' }).showTtc).toBe(false);
    expect(run({ Q16: 'not_planning' }).showTtc).toBe(false);
    expect(run({ Q16: 'within_12m' }).showTtc).toBe(true);
    expect(ttc().showTtc).toBe(true);
  });
  it('under 35 and trying for 12 months or more: time to get checked', () => {
    expect(ttc({ T1: 'gte12m' }).ttc.map((x) => x.title).join(' ')).toMatch(/get checked/i);
  });
  it('35-39 and trying for 6 months: time to get checked', () => {
    expect(ttc({ Q2: '35_39', T1: '6_11m' }).ttc.map((x) => x.title).join(' ')).toMatch(/get checked/i);
  });
  it('does not say to get checked yet for a young woman trying for under 6 months', () => {
    expect(ttc({ T1: 'lt6m' }).ttc.map((x) => x.title).join(' ')).not.toMatch(/get checked/i);
  });
  it('40+ is told not to wait and a fertility specialist is added', () => {
    const P = ttc({ Q2: '40_44' });
    expect(P.ttc.map((x) => x.title).join(' ')).toMatch(/don.t wait/i);
    expect(P.who.some((w) => w.cat === 'fert')).toBe(true);
  });
  it('two or more miscarriages: assessment and support', () => {
    expect(ttc({ T3: ['miscarriage_2plus'] }).ttc.map((x) => x.title).join(' ')).toMatch(/miscarriage/i);
  });
  it('semen test not yet done is flagged', () => {
    expect(ttc({ T2: 'not_done' }).ttc.map((x) => x.title + x.body).join(' ')).toMatch(/semen/i);
  });
  it('never recommends AMH or IVF', () => {
    const P = ttc({ Q2: '40_44', T1: 'gte12m', T2: 'abnormal', T3: ['miscarriage_2plus'] });
    const everything = JSON.stringify(P);
    expect(everything).not.toMatch(/\bAMH\b|\bIVF\b/);
  });
});

describe('plan output', () => {
  it('pins the post-menopausal bleeding banner as a non-emergency', () => {
    const b = run({ Q0: ['s5_postmeno_bleed'] }).banners;
    expect(b).toHaveLength(1);
    expect(b[0].u1).toBe(false);
  });
  it('always includes the general warning signs, at most the configured number of specific ones', () => {
    const P = run({ Q7: ['clots'] });
    expect(P.warnings).toContain('Soaking a pad every hour for 2 hours or more');
  });
  it('always has questions for the doctor, including the generic ones', () => {
    expect(run({ Q7: ['clots'] }).questions).toContain('When should I come back if things don’t improve?');
  });
  it('writes a clinical summary for the doctor', () => {
    const s = run({ Q7: ['clots'], Q10: 'severe' }).summary;
    expect(s).toMatch(/^Age 20–34 woman\./);
    expect(s).toMatch(/Bleeding: clots/);
  });
  it('produces a plan for every empty-ish answer set without crashing', () => {
    expect(() => evaluate({ Q1: ['pain'] })).not.toThrow();
  });
});
