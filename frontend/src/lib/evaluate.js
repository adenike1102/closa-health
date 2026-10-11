// Rules engine: answers -> flags -> urgency -> plan.
import { CONFIG, AGES, ageAtLeast, ageBelow } from './config.js';
import { arrOf, QUESTIONS, QMAP, optOf, youOf, joinAnd } from './questions.js';
import { CONTENT } from './content.js';
const CLIN = ['F-PREG', 'F-ENDOMRISK', 'F-PCB', 'F-INFECT', 'F-ANAEMIA', 'F-BLEEDDIS', 'F-FIBROID', 'F-ENDO', 'F-ADENO', 'F-SECDYSM', 'F-HMB', 'F-BULK', 'F-IMB', 'F-POI', 'F-PRIMAMEN', 'F-AMEN', 'F-ASHERMAN', 'F-PRL', 'F-PCOS', 'F-THY', 'F-HYPO', 'F-PERI', 'F-OLIGO', 'F-FREQ', 'F-CONTRA', 'F-PRIMDYSM', 'F-POSTPARTUM'];
const U4F = ['F-HMB', 'F-FIBROID', 'F-ADENO', 'F-SECDYSM', 'F-ENDO', 'F-BLEEDDIS', 'F-IMB', 'F-AMEN', 'F-POI', 'F-PRIMAMEN', 'F-ASHERMAN', 'F-ANAEMIA', 'F-INFECT'];
const U5F = ['F-PCOS', 'F-OLIGO', 'F-FREQ', 'F-THY', 'F-PERI', 'F-HYPO', 'F-PRIMDYSM', 'F-CONTRA'];
const CAT_ACTION = { emerg: 'Call 112', lab: 'Find a lab', gp: 'Find a GP', gyn: 'Find a gynaecologist', haem: 'Find a sickle cell or blood clinic', fp: 'Find a family planning clinic', fert: 'Find a fertility clinic' };

function evaluate(A) {
  const has = (q, c) => arrOf(A, q).includes(c);
  const anyOf = (q, cs) => cs.filter(c => has(q, c)).map(c => q + '.' + c);
  const isIn = (q, cs) => cs.includes(A[q]);
  const F = {};
  const on = id => !!F[id]?.on;
  const ev = id => on(id) ? F[id].ev : [];
  const set = (id, cond, evid) => { F[id] = { on: !!cond, ev: cond ? [...new Set(evid.flat())] : [] }; };
  const q0 = arrOf(A, 'Q0').filter(c => c !== 'none');
  set('F-HMB', anyOf('Q7', ['change_1_2h', 'clots', 'gt8_days', 'flooding']).length, [anyOf('Q7', ['change_1_2h', 'clots', 'gt8_days', 'flooding'])]);
  set('F-IMB', has('Q9', 'between'), ['Q9.between']);
  set('F-PCB', has('Q9', 'after_sex'), ['Q9.after_sex']);
  set('F-BULK', has('Q12', 'bulk'), ['Q12.bulk']);
  set('F-OLIGO', isIn('Q5', ['infrequent', 'unpredictable']), ['Q5.' + A.Q5]);
  set('F-FREQ', A.Q5 === 'frequent', ['Q5.frequent']);
  set('F-POSTPARTUM', A.Q6 === 'yes_bf', ['Q6.yes_bf']);
  set('F-PREG', isIn('Q3', ['yes', 'unsure']), ['Q3.' + A.Q3]);
  const secE = [...(A.Q10 === 'severe' ? ['Q10.severe'] : []), ...anyOf('Q11', ['worsening', 'painkillers_fail', 'disabling', 'non_cyclic'])];
  set('F-SECDYSM', secE.length, [secE]);
  set('F-PRIMAMEN', A.Q5 === 'never' && A.Q2 && A.Q2 !== 'lt16', ['Q5.never']);
  set('F-AMEN', A.Q5 === 'none_3m' && !on('F-POSTPARTUM'), ['Q5.none_3m']);
  set('F-ASHERMAN', A.Q6 === 'yes_not_bf' && A.Q5 === 'none_3m', ['Q6.yes_not_bf', 'Q5.none_3m']);
  const cyc = on('F-OLIGO') || on('F-AMEN'), cycE = [...ev('F-OLIGO'), ...ev('F-AMEN')];
  const pcE = [...anyOf('Q12', ['hair_acne', 'dark_skin', 'weight_change']), ...anyOf('Q14', ['pcos'])];
  set('F-PCOS', cyc && pcE.length, [cycE, pcE]);
  const prE = [...anyOf('Q12', ['nipple_milk']), ...anyOf('Q13', ['headache_vision', 'mental_health_meds'])];
  set('F-PRL', cyc && prE.length, [cycE, prE]);
  const thE = [...anyOf('Q12', ['thyroid_sx']), ...anyOf('Q14', ['thyroid'])];
  const thCyc = ['F-HMB', 'F-IMB', 'F-OLIGO', 'F-FREQ', 'F-AMEN'].filter(on);
  set('F-THY', thE.length && thCyc.length, [thE, thCyc.map(ev)]);
  const hyE = anyOf('Q13', ['diet_weight_loss', 'hard_training', 'stress']);
  set('F-HYPO', cyc && hyE.length, [cycE, hyE]);
  const peri = ageAtLeast(A.Q2, CONFIG.PERI_MIN_AGE_BAND) && (on('F-OLIGO') || on('F-FREQ') || has('Q12', 'hot_flushes'));
  set('F-PERI', peri, ['Q2.' + A.Q2, ev('F-OLIGO'), ev('F-FREQ'), anyOf('Q12', ['hot_flushes'])]);
  set('F-POI', cyc && has('Q12', 'hot_flushes') && ageBelow(A.Q2, CONFIG.POI_BELOW_AGE_BAND), [cycE, 'Q12.hot_flushes']);
  const emA = ageAtLeast(A.Q2, CONFIG.ENDOMRISK_MIN_AGE_BAND) && (on('F-IMB') || on('F-HMB'));
  const emB = on('F-PCOS') && on('F-AMEN');
  set('F-ENDOMRISK', emA || emB, emA ? ['Q2.' + A.Q2, ev('F-IMB'), ev('F-HMB')] : [ev('F-PCOS')]);
  const inE = [...anyOf('Q12', ['discharge', 'fever_pain']), ...(has('Q14', 'pid_sti') && A.Q10 && A.Q10 !== 'none' ? ['Q14.pid_sti'] : [])];
  set('F-INFECT', inE.length, [inE]);
  const anE = anyOf('Q8', ['fatigue', 'dizzy', 'pica']);
  set('F-ANAEMIA', anE.length, [anE]);
  const bdE = anyOf('Q8', ['since_first_period', 'bruising']);
  set('F-BLEEDDIS', on('F-HMB') && bdE.length, [ev('F-HMB'), bdE]);
  set('F-FIBROID', on('F-HMB') && (on('F-BULK') || has('Q14', 'fibroids')), [ev('F-HMB'), ev('F-BULK'), anyOf('Q14', ['fibroids'])]);
  const enE = anyOf('Q11', ['deep_sex_pain', 'bowel_bladder']);
  const enB = on('F-SECDYSM') && has('Q14', 'endometriosis');
  set('F-ENDO', enE.length || enB, [enE, enB ? [ev('F-SECDYSM'), 'Q14.endometriosis'] : []]);
  set('F-ADENO', on('F-HMB') && on('F-SECDYSM') && ageAtLeast(A.Q2, CONFIG.ADENO_MIN_AGE_BAND), [ev('F-HMB'), ev('F-SECDYSM'), 'Q2.' + A.Q2]);
  set('F-CONTRA', A.Q4 === 'hormonal' && (on('F-IMB') || isIn('Q5', ['unpredictable', 'none_3m'])), ['Q4.hormonal', ev('F-IMB'), isIn('Q5', ['unpredictable', 'none_3m']) ? ['Q5.' + A.Q5] : []]);
  const q11 = arrOf(A, 'Q11');
  set('F-PRIMDYSM', isIn('Q10', ['mild', 'moderate']) && q11.length === 1 && q11[0] === 'none', ['Q10.' + A.Q10]);
  const M = {
    SICKLE: has('Q14', 'sickle_cell'), NORMALISED: has('Q15', 'told_normal') && (on('F-HMB') || on('F-SECDYSM') || on('F-ANAEMIA')),
    ROUNDS: has('Q15', 'many_visits'), DONE: has('Q15', 'had_scan') || has('Q15', 'had_bloods'), IMPACT: A.Q10 === 'severe' || has('Q11', 'disabling'),
    FERTGOAL: isIn('Q16', ['trying_now', 'within_12m', 'later']), TTC: isIn('Q16', ['trying_now', 'within_12m'])
  };
  const anyClin = CLIN.filter(f => f !== 'F-POSTPARTUM' && f !== 'F-PREG').some(on);
  // urgency
  let U = 6, uKey = null;
  const raise = l => { if (l < U) U = l; };
  if (q0.some(c => CONTENT.q0[c]?.u1)) raise(1);
  if (has('Q12', 'fever_pain')) raise(2);
  if (on('F-HMB') && has('Q8', 'dizzy')) raise(2);
  if (q0.includes('s5_postmeno_bleed')) raise(3);
  if (on('F-PCB') || on('F-ENDOMRISK')) raise(3);
  if (on('F-PRL') && has('Q13', 'headache_vision')) raise(3);
  if (on('F-BULK') && (ageAtLeast(A.Q2, '45_54') || has('Q12', 'weight_change'))) raise(3);
  if (U4F.some(on)) raise(4);
  if (U5F.some(on)) raise(5);
  if (U === 6) { U = 5; uKey = 'reassure'; }
  if (U === 5 && M.IMPACT) { U = 4; uKey = null; }
  if (on('F-POSTPARTUM') && !anyClin && U >= 5) { U = 5; uKey = 'postpartum'; }
  const flagLevel = f => {
    if (f === 'F-INFECT') return has('Q12', 'fever_pain') ? 2 : 4;
    if (f === 'F-HMB') return has('Q8', 'dizzy') ? 2 : 4;
    if (f === 'F-PCB' || f === 'F-ENDOMRISK') return 3;
    if (f === 'F-PRL') return has('Q13', 'headache_vision') ? 3 : 5;
    if (f === 'F-BULK') return (ageAtLeast(A.Q2, '45_54') || has('Q12', 'weight_change')) ? 3 : 4;
    return U4F.includes(f) ? 4 : 5;
  };
  const prio = f => CLIN.indexOf(f);
  // possibilities
  const hidden = new Set();
  if (on('F-FIBROID') || on('F-ADENO')) hidden.add('F-HMB');
  if (on('F-ENDO') || on('F-ADENO')) hidden.add('F-SECDYSM');
  const poss = CLIN.filter(f => on(f) && f !== 'F-PREG' && f !== 'F-POSTPARTUM' && !hidden.has(f)).slice(0, CONFIG.MAX_POSSIBILITIES);
  const possibilities = poss.map(f => { const c = CONTENT.flags[f]; const yous = F[f].ev.map(youOf).filter(Boolean); return { id: f, title: c.title, body: (M.FERTGOAL && c.fert) || c.body, evidence: yous.length ? 'Why we suggest this: ' + joinAnd(yous) + '.' : '', cat: c.cat, action: c.action }; });
  // who to see
  const sp = [];
  const add = (cond, flags, stop, cat, ask) => { if (!cond) return; const fl = flags.filter(on); sp.push({ stop, cat, asks: ask ? [ask] : [], level: fl.length ? Math.min(...fl.map(flagLevel)) : 1, prio: fl.length ? Math.min(...fl.map(prio)) : -1, fors: fl.filter(f => CONTENT.flags[f]).map(f => CONTENT.flags[f].title) }); };
  add(U === 1, [], 'Nearest hospital emergency unit', 'emerg', null);
  add(on('F-INFECT'), ['F-INFECT'], 'A hospital or clinic with a laboratory for infection tests', 'lab', 'A gynaecologist if the pain continues after treatment');
  add((on('F-HMB') || on('F-ANAEMIA')) && !(on('F-FIBROID') || on('F-ADENO') || on('F-BULK')), ['F-HMB', 'F-ANAEMIA'], 'A GP or general hospital doctor for first blood tests', 'gp', 'A gynaecologist if bleeding continues or treatment doesn’t help');
  add(on('F-FIBROID') || on('F-BULK'), ['F-FIBROID', 'F-BULK'], 'A gynaecologist', 'gyn', M.FERTGOAL ? 'One experienced in fibroid surgery who offers fertility-sparing options (myomectomy)' : 'One experienced in fibroid surgery');
  add(on('F-ENDO') || (on('F-SECDYSM') && has('Q11', 'painkillers_fail')), ['F-ENDO', 'F-SECDYSM'], 'A gynaecologist', 'gyn', 'One who does laparoscopic (keyhole) surgery and treats endometriosis');
  add(on('F-ADENO'), ['F-ADENO'], 'A gynaecologist', 'gyn', 'A pelvic scan by an experienced sonographer');
  add(on('F-BLEEDDIS'), ['F-BLEEDDIS'], 'A GP for first blood tests', 'gp', 'A haematologist (blood specialist)');
  add(M.SICKLE && anyClin, CLIN.filter(on), 'Your usual sickle cell clinic', 'haem', 'A gynaecologist who works with your haematologist');
  add(on('F-PCOS'), ['F-PCOS'], 'A GP for first blood tests', 'gp', M.TTC ? 'A gynaecologist or endocrinologist (hormone specialist), and a fertility specialist' : 'A gynaecologist or endocrinologist (hormone specialist)');
  add(on('F-THY'), ['F-THY'], 'A GP for a thyroid test', 'gp', 'An endocrinologist if the result is abnormal');
  add(on('F-PRL'), ['F-PRL'], 'A GP for a prolactin test', 'gp', 'An endocrinologist if it’s raised');
  add(on('F-POI'), ['F-POI'], 'A gynaecologist', 'gyn', M.FERTGOAL ? 'A fertility specialist, promptly' : null);
  add(on('F-PERI'), ['F-PERI'], 'A GP', 'gp', 'A gynaecologist if symptoms are hard to manage');
  add(on('F-HYPO'), ['F-HYPO'], 'A GP', 'gp', 'A gynaecologist if your periods don’t come back');
  add(on('F-PCB'), ['F-PCB'], 'A gynaecologist or GP for an examination of the cervix', 'gyn', null);
  add(q0.includes('s5_postmeno_bleed') || on('F-ENDOMRISK'), ['F-ENDOMRISK'], 'A gynaecologist', 'gyn', null);
  add(on('F-CONTRA'), ['F-CONTRA'], 'A family planning clinic, or whoever gave you your contraception', 'fp', null);
  add(on('F-PRIMAMEN'), ['F-PRIMAMEN'], 'A gynaecologist', 'gyn', null);
  add(on('F-ASHERMAN'), ['F-ASHERMAN'], 'A gynaecologist', 'gyn', 'One who performs hysteroscopy');
  const onlyPrim = on('F-PRIMDYSM') && CLIN.filter(f => f !== 'F-PRIMDYSM' && f !== 'F-PREG' && f !== 'F-POSTPARTUM').every(f => !on(f));
  add(onlyPrim, ['F-PRIMDYSM'], 'A pharmacist or GP', 'gp', 'A gynaecologist if it’s no better after 3 months');
  const ttc3 = A.Q16 === 'trying_now' && (ageAtLeast(A.Q2, CONFIG.TTC_NO_WAIT_AGE_BAND) || ['F-OLIGO', 'F-AMEN', 'F-PCOS', 'F-ENDO', 'F-FIBROID', 'F-POI'].some(on) || M.SICKLE || has('Q14', 'pid_sti') || has('T3', 'ectopic') || A.T2 === 'abnormal');
  if (ttc3 && (on('F-POI') || ageAtLeast(A.Q2, '40_44'))) sp.push({ stop: 'A fertility specialist', cat: 'fert', asks: [], level: 4, prio: 50, fors: ['Trying to conceive'] });
  if (M.ROUNDS) sp.forEach(x => { if (x.cat === 'gp') { x.stop = 'A gynaecologist'; x.cat = 'gyn'; x.asks = ['A consultant gynaecologist at a teaching or specialist hospital']; } });
  if (!sp.length) sp.push({ stop: 'A GP or general hospital doctor', cat: 'gp', asks: [], level: 5, prio: 99, fors: ['A routine check'] });
  const merged = [];
  sp.sort((a, b) => a.level - b.level || a.prio - b.prio).forEach(x => { const m = merged.find(y => y.stop === x.stop); if (m) { x.asks.forEach(a => { if (!m.asks.includes(a)) m.asks.push(a); }); x.fors.forEach(f => { if (!m.fors.includes(f)) m.fors.push(f); }); } else merged.push({ ...x, asks: [...x.asks], fors: [...x.fors] }); });
  const who = merged.slice(0, CONFIG.MAX_SPECIALISTS);
  // tests
  const notActive = A.Q3 === 'not_active';
  const T = {};
  const t = (id, cond) => { if (cond) T[id] = true; };
  t('T-PREG', (on('F-PREG') || on('F-AMEN') || on('F-OLIGO')) && !notActive);
  t('T-FBC', on('F-HMB') || on('F-ANAEMIA')); t('T-FERR', on('F-HMB') || on('F-ANAEMIA'));
  t('T-TFT', ['F-THY', 'F-OLIGO', 'F-AMEN', 'F-FREQ', 'F-POI'].some(on));
  t('T-PRL', ['F-AMEN', 'F-OLIGO', 'F-PRL'].some(on)); t('T-FSH', ['F-AMEN', 'F-OLIGO', 'F-POI'].some(on));
  t('T-ANDRO', on('F-PCOS')); t('T-METAB', on('F-PCOS')); t('T-PROG', M.TTC && (on('F-OLIGO') || on('F-PCOS')));
  t('T-USS', ['F-FIBROID', 'F-BULK', 'F-ADENO', 'F-SECDYSM', 'F-ENDO', 'F-IMB', 'F-AMEN', 'F-PCOS', 'F-ASHERMAN', 'F-ENDOMRISK'].some(on) || q0.includes('s5_postmeno_bleed'));
  t('T-STI', ['F-INFECT', 'F-IMB', 'F-PCB'].some(on)); t('T-EXAM', ['F-PCB', 'F-IMB', 'F-INFECT'].some(on));
  t('T-CERV', (on('F-PCB') || on('F-IMB')) && ageAtLeast(A.Q2, CONFIG.CERV_MIN_AGE_BAND));
  t('T-COAG', on('F-BLEEDDIS')); t('T-GENO', (M.TTC || on('F-ANAEMIA')) && !M.SICKLE);
  // trying to conceive
  const ttc = [];
  const ttc1 = M.TTC && A.T1 === CONFIG.TTC_WAIT_UNDER_35 && ageBelow(A.Q2, '35_39');
  const ttc2 = M.TTC && CONFIG.TTC_WAIT_35_39.includes(A.T1) && A.Q2 === '35_39';
  const ttc3r = M.TTC && ttc3;
  const ttc5 = M.TTC && A.Q16 === 'trying_now' && A.T2 === 'not_done';
  if (M.TTC) {
    if (ttc3r) ttc.push({ title: 'Get checked now, don’t wait', body: 'Because of what you’ve told us, it’s best not to wait before you and your partner have your first fertility tests.' });
    else if (ttc1 || ttc2) ttc.push({ title: 'Time to get checked', body: 'You’ve been trying for long enough that it’s a good time for you and your partner to have your first fertility tests.' });
    if (has('T3', 'miscarriage_2plus')) ttc.push({ title: 'A miscarriage assessment', body: 'After 2 or more miscarriages, a gynaecologist can look for causes, and there is often something that can help next time. You don’t have to go through this alone.' });
    if (ttc5) ttc.push({ title: 'Your partner’s semen test', body: 'A semen test is simple and checks a big part of the picture. Ask for it now, alongside your own tests.' });
    ttc.push({ title: 'Getting ready for pregnancy', body: 'A few things help, whatever happens next.', list: ['Take folic acid every day, ideally from before you conceive', 'Ask a doctor or pharmacist to review any medicines you take', 'Make sure you and your partner both know your genotype'] });
    if (A.Q6 === 'yes_bf' || A.Q6 === 'yes_not_bf' || arrOf(A, 'T3').some(c => c !== 'none')) ttc.push({ title: 'Support after a loss', body: 'If you’ve been through a pregnancy loss, it’s okay to ask for support. Your doctor can point you to counselling or a support group.' });
    if (ttc1 || ttc2 || ttc3r) { ['T-PROG', 'T-FSH', 'T-TFT', 'T-STI', 'T-RUB', 'T-USS', 'T-GENO'].forEach(x => { if (x !== 'T-GENO' || !M.SICKLE) T[x] = true; }); }
    if ((ttc1 || ttc2 || ttc3r || ttc5) && A.T2 !== 'na') T['T-SEMEN'] = true;
  }
  const ORDER = ['T-PREG', 'T-FBC', 'T-FERR', 'T-TFT', 'T-PRL', 'T-FSH', 'T-ANDRO', 'T-METAB', 'T-PROG', 'T-USS', 'T-STI', 'T-EXAM', 'T-CERV', 'T-COAG', 'T-GENO', 'T-RUB', 'T-SEMEN'];
  const HORM = ['T-TFT', 'T-PRL', 'T-FSH', 'T-ANDRO', 'T-PROG'];
  const tests = ORDER.filter(x => T[x]).map(x => { const notes = []; if (on('F-PREG') && HORM.includes(x)) notes.push(CONTENT.testNotes.afterNegPreg); if (A.Q4 === 'hormonal' && ['T-FSH', 'T-ANDRO', 'T-PROG'].includes(x)) notes.push(CONTENT.testNotes.onHormonal); if (x === 'T-USS' && on('F-ENDO')) notes.push(CONTENT.testNotes.normalScanEndo); return { id: x, name: CONTENT.tests[x][0], timing: CONTENT.tests[x][1], note: notes.join(' ') }; });
  const maySuggest = [];
  if (on('F-ENDOMRISK') || q0.includes('s5_postmeno_bleed')) maySuggest.push('A sample of the womb lining, or a hysteroscopy');
  if (on('F-ADENO') || on('F-ENDO')) maySuggest.push('A pelvic MRI');
  if (on('F-ENDO')) maySuggest.push('A laparoscopy (keyhole surgery to look inside)');
  if (ttc1 || ttc2 || ttc3r) maySuggest.push('An HSG, a dye test that checks your tubes');
  // questions, warnings, selfcare
  const questions = [...new Set([...poss.slice(0, 2).map(f => CONTENT.flags[f].q), ...CONTENT.questionsGeneric])];
  const warnings = [...new Set([...poss.map(f => CONTENT.flags[f].warn).filter(Boolean).slice(0, CONFIG.MAX_WARNINGS), ...CONTENT.warnGeneric])];
  const selfcare = [...new Set(poss.map(f => CONTENT.flags[f].self).filter(Boolean))];
  const notes = [];
  if (M.NORMALISED) notes.push(CONTENT.notes.normalised);
  if (M.SICKLE) notes.push(CONTENT.notes.sickle);
  if (M.ROUNDS) notes.push(CONTENT.notes.rounds);
  if (on('F-POSTPARTUM')) notes.push(CONTENT.notes.postpartum);
  // doctor summary
  const cl = (q) => arrOf(A, q).filter(c => c !== 'none').map(c => optOf(q, c)?.clin).filter(Boolean).join(', ');
  const semi = (...qs) => qs.map(cl).filter(Boolean).join('; ');
  const parts = [];
  if (A.Q2) parts.push(optOf('Q2', A.Q2).clin + ' woman.');
  const pushP = (label, val) => { if (val) parts.push(label + ': ' + val + '.'); };
  pushP('Main concerns', cl('Q1')); pushP('Periods', cl('Q5')); pushP('Bleeding', semi('Q7', 'Q9')); pushP('Pain', A.Q10 && A.Q10 !== 'none' ? semi('Q10', 'Q11') : '');
  pushP('Other symptoms', semi('Q8', 'Q12', 'Q13')); pushP('Known conditions', cl('Q14')); pushP('Contraception', A.Q4 && A.Q4 !== 'none' ? cl('Q4') : ''); pushP('Previous care', cl('Q15'));
  pushP('Pregnancy plans', [cl('Q16'), A.T1 ? 'trying for ' + cl('T1') : ''].filter(Boolean).join('; '));
  const banners = q0.map(c => ({ code: c, ...CONTENT.q0[c] }));
  const urg = uKey ? CONTENT.urgency[uKey] : CONTENT.urgency[U];
  return { F, M, U, urgency: { level: U, label: urg.label, body: urg.body }, banners, pregFirst: on('F-PREG') && U !== 1, possibilities, reassure: !poss.length, notes, who, tests, bringReports: M.DONE, maySuggest, questions, warnings, selfcare, ttc, showTtc: M.TTC, summary: parts.join(' ') };
}

export { evaluate, CAT_ACTION };
