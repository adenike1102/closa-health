// Every intake question: option codes, labels, 'you' phrasing and clinical phrasing.
import { ageAtLeast, ageBelow } from './config.js';
const o = (code, label, you, clin) => ({ code, label, you: you ?? label.toLowerCase(), clin: clin ?? label.toLowerCase() });
const NONE = (label) => o('none', label || 'None of these', '', '');
const arrOf = (A, q) => Array.isArray(A[q]) ? A[q] : (A[q] ? [A[q]] : []);
const QUESTIONS = [
  { id: 'Q0', type: 'multi', title: 'Do any of these apply to you right now?', help: 'We ask this first to keep you safe.', options: [
    o('s1_heavy_faint', 'I’m soaking a pad every hour for 2 hours or more, or I feel faint or very short of breath'),
    o('s2_sudden_pain', 'Sudden, severe pain low in my belly or on one side'),
    o('s3_preg_symptoms', 'I might be pregnant and have pain, bleeding, dizziness or pain at the tip of my shoulder'),
    o('s4_post_pregnancy', 'I gave birth, miscarried or ended a pregnancy in the last 6 weeks, and have a fever, smelly discharge or worsening pain'),
    o('s5_postmeno_bleed', 'I’ve had bleeding after my periods stopped for good (12 months or more)'), NONE()] },
  { id: 'Q1', type: 'multi', title: 'What’s bothering you most?', help: 'Select all that apply.', options: [
    o('pain', 'Painful periods', 'your periods are painful', 'painful periods'), o('heavy', 'Heavy periods', 'your periods are heavy', 'heavy periods'),
    o('irregular', 'Irregular or missed periods', 'your periods are irregular or missed', 'irregular/missed periods'),
    o('other_bleeding', 'Bleeding between periods or after sex', 'you bleed between periods or after sex', 'bleeding between periods or after sex'),
    o('ttc', 'Trying to get pregnant', 'you’re trying to get pregnant', 'trying to conceive')] },
  { id: 'Q2', type: 'single', title: 'How old are you?', options: [
    o('lt16', 'Under 16', 'you’re under 16', 'Age under 16'), o('16_19', '16–19', 'you’re aged 16–19', 'Age 16–19'), o('20_34', '20–34', 'you’re aged 20–34', 'Age 20–34'),
    o('35_39', '35–39', 'you’re aged 35–39', 'Age 35–39'), o('40_44', '40–44', 'you’re aged 40–44', 'Age 40–44'), o('45_54', '45–54', 'you’re aged 45–54', 'Age 45–54'), o('55p', '55 or over', 'you’re 55 or over', 'Age 55+')] },
  { id: 'Q3', type: 'single', title: 'Could you be pregnant?', options: [
    o('yes', 'Yes', 'you could be pregnant'), o('no', 'No', ''), o('unsure', 'Not sure', 'you’re not sure if you could be pregnant'), o('not_active', 'I’m not having sex', '')] },
  { id: 'Q4', type: 'single', title: 'What contraception do you use?', options: [
    o('none', 'None', '', 'none'), o('hormonal', 'Pill, injection, implant or hormonal coil', 'you use hormonal contraception', 'hormonal'),
    o('copper_iud', 'Copper coil', 'you use a copper coil', 'copper IUD'), o('non_hormonal', 'Condoms or other', '', 'barrier/other')] },
  { id: 'UP', type: 'upload', optional: true, title: 'Do you track your periods in an app?', help: 'Upload a CSV export from your period app and we’ll suggest an answer for the next question. This is optional.' },
  { id: 'Q5', type: 'single', title: 'How often do your periods come?', options: [
    o('regular', 'Every 24–38 days', 'your periods come every 24–38 days', 'regular (24–38 days)'), o('frequent', 'More often than every 24 days', 'your periods come more often than every 24 days', 'frequent (<24 days)'),
    o('infrequent', 'Less often than every 38 days', 'your periods come less often than every 38 days', 'infrequent (>38 days)'), o('unpredictable', 'It changes a lot', 'your periods change a lot', 'unpredictable'),
    o('none_3m', 'No period for 3 months or more', 'you haven’t had a period for 3 months or more', 'none for ≥3 months'), o('never', 'I’ve never had a period', 'you’ve never had a period', 'never had a period'),
    o('menopause', 'They’ve stopped for good', 'your periods have stopped for good', 'postmenopausal')] },
  { id: 'Q6', type: 'single', title: 'In the past 12 months, have you given birth, miscarried or ended a pregnancy?', show: A => ['infrequent', 'unpredictable', 'none_3m'].includes(A.Q5), options: [
    o('no', 'No', ''), o('yes_bf', 'Yes, and I’m breastfeeding', 'you’ve had a pregnancy in the past year and are breastfeeding'), o('yes_not_bf', 'Yes, and I’m not breastfeeding', 'you’ve had a pregnancy in the past year'), o('prefer_not', 'I’d rather not say', '')] },
  { id: 'Q7', type: 'multi', title: 'Which of these happen with your periods?', help: 'Select all that apply.', options: [
    o('change_1_2h', 'I change my pad every 1–2 hours on heavy days', 'you change your pad every 1–2 hours on heavy days', 'pad change every 1–2 h'),
    o('clots', 'Clots bigger than a bottle cap', 'you pass clots bigger than a bottle cap', 'clots >2.5 cm'),
    o('gt8_days', 'Bleeding lasts more than 8 days', 'your bleeding lasts more than 8 days', 'bleeding >8 days'),
    o('flooding', 'I leak onto clothes or bedding, or change at night', 'you leak onto clothes or bedding, or change at night', 'flooding/night-time changes'), NONE()] },
  { id: 'Q8', type: 'multi', title: 'Do you have any of these?', help: 'Select all that apply.', show: A => { const q7 = arrOf(A, 'Q7'); return (q7.length && !(q7.length === 1 && q7[0] === 'none')) || arrOf(A, 'Q1').includes('heavy'); }, options: [
    o('fatigue', 'Very tired, or breathless on stairs', 'you feel very tired or breathless on stairs', 'fatigue/breathlessness'),
    o('dizzy', 'Dizzy, or heart racing', 'you feel dizzy or your heart races', 'dizziness/palpitations'),
    o('pica', 'Craving ice, chalk or clay', 'you crave ice, chalk or clay', 'pica'),
    o('since_first_period', 'Heavy since my very first period', 'your periods have been heavy since your very first one', 'heavy since menarche'),
    o('bruising', 'I bruise easily, get nosebleeds, or bled heavily after a tooth removal or birth', 'you bruise or bleed easily', 'easy bruising/bleeding'), NONE()] },
  { id: 'Q9', type: 'multi', title: 'Do you bleed at other times?', options: [
    o('between', 'Between periods', 'you bleed between periods', 'intermenstrual bleeding'), o('after_sex', 'After sex', 'you bleed after sex', 'postcoital bleeding'), NONE('Neither')] },
  { id: 'Q10', type: 'single', title: 'How bad is your period or pelvic pain at its worst?', options: [
    o('none', 'No pain', '', 'none'), o('mild', 'Mild: I can carry on as normal', 'your pain is mild', 'mild'), o('moderate', 'Moderate: it slows me down', 'your pain is moderate', 'moderate'), o('severe', 'Severe: I can’t do my usual things', 'your pain is severe at its worst', 'severe')] },
  { id: 'Q11', type: 'multi', title: 'Which of these describe your pain?', help: 'Select all that apply.', show: A => !!A.Q10 && A.Q10 !== 'none', options: [
    o('worsening', 'It’s got worse over the years', 'your pain has got worse over the years', 'worsening over years'),
    o('painkillers_fail', 'Painkillers don’t help much', 'painkillers don’t help much', 'poor response to painkillers'),
    o('disabling', 'It makes me miss work or school, vomit or faint', 'your pain makes you miss work or school, vomit or faint', 'disabling'),
    o('non_cyclic', 'It’s there most of the month', 'your pain is there most of the month', 'non-cyclical'),
    o('deep_sex_pain', 'Deep pain during sex', 'you have deep pain during sex', 'deep dyspareunia'),
    o('bowel_bladder', 'Pain opening my bowels or passing urine during my period', 'you have pain opening your bowels or passing urine during your period', 'dyschezia/dysuria with menses'), NONE()] },
  { id: 'Q12', type: 'multi', title: 'Have you noticed any of these?', help: 'Select all that apply.', options: [
    o('hair_acne', 'Extra hair on face, chest or belly, or hard-to-treat acne', 'you have extra hair or hard-to-treat acne', 'hirsutism/acne'),
    o('dark_skin', 'Dark, velvety skin on neck or armpits', 'you have dark, velvety skin on your neck or armpits', 'acanthosis nigricans'),
    o('weight_change', 'Big weight change without trying', 'your weight has changed a lot without trying', 'unexplained weight change'),
    o('bulk', 'Swollen belly, a lump, or passing urine very often', 'you have a swollen belly, a lump or pass urine very often', 'abdominal swelling/mass or urinary frequency'),
    o('hot_flushes', 'Hot flushes or night sweats', 'you have hot flushes or night sweats', 'hot flushes/night sweats'),
    o('thyroid_sx', 'Too hot or cold, racing heart or shaky hands', 'you feel too hot or cold, or have a racing heart or shaky hands', 'heat/cold intolerance, palpitations or tremor'),
    o('nipple_milk', 'Milky fluid from nipples (not breastfeeding)', 'you have milky fluid from your nipples', 'galactorrhoea'),
    o('discharge', 'Unusual discharge or burning when passing urine', 'you have unusual discharge or burning when passing urine', 'abnormal discharge/dysuria'),
    o('fever_pain', 'Fever with pelvic pain', 'you have a fever with pelvic pain', 'fever with pelvic pain'), NONE()] },
  { id: 'Q13', type: 'multi', title: 'Do any of these apply?', help: 'Select all that apply.', show: A => ['infrequent', 'unpredictable', 'none_3m', 'never'].includes(A.Q5), options: [
    o('diet_weight_loss', 'Lost a lot of weight through dieting or exercise', 'you’ve lost a lot of weight through dieting or exercise', 'significant weight loss'),
    o('hard_training', 'I train hard most days', 'you train hard most days', 'intense exercise'),
    o('stress', 'Major stress', 'you’re under major stress', 'major stress'),
    o('headache_vision', 'Frequent headaches or changes in vision', 'you have frequent headaches or changes in your vision', 'headaches/visual change'),
    o('mental_health_meds', 'I take medicine for mental health', 'you take medicine for mental health', 'on mental health medication'), NONE()] },
  { id: 'Q14', type: 'multi', title: 'Has a doctor ever told you that you have any of these?', help: 'Select all that apply.', options: [
    o('fibroids', 'Fibroids', 'a doctor has told you that you have fibroids', 'fibroids'), o('endometriosis', 'Endometriosis', 'a doctor has told you that you have endometriosis', 'endometriosis'),
    o('pcos', 'PCOS', 'a doctor has told you that you have PCOS', 'PCOS'), o('thyroid', 'A thyroid problem', 'a doctor has told you that you have a thyroid problem', 'thyroid disease'),
    o('sickle_cell', 'Sickle cell disease', 'you have sickle cell disease', 'sickle cell disease'), o('pid_sti', 'Pelvic infection or STI', 'you’ve had a pelvic infection or STI', 'previous PID/STI'), NONE()] },
  { id: 'Q15', type: 'multi', title: 'Have you already…', help: 'Select all that apply.', options: [
    o('had_scan', 'Had a scan for this', 'you’ve had a scan', 'previous scan'), o('had_bloods', 'Had blood tests for this', 'you’ve had blood tests', 'previous blood tests'),
    o('told_normal', 'Been told it’s normal', 'you’ve been told it’s normal', 'told symptoms normal'), o('treatment_failed', 'Tried treatment that didn’t help', 'treatment hasn’t helped', 'failed treatment'),
    o('many_visits', 'Seen doctors several times without a clear answer', 'you’ve seen doctors several times without a clear answer', 'several consultations without diagnosis'), NONE()] },
  { id: 'Q16', type: 'single', title: 'Are you trying to get pregnant, or planning to?', options: [
    o('trying_now', 'Yes, I’m trying now', 'you’re trying to get pregnant', 'trying now'), o('within_12m', 'In the next 12 months', 'you’d like to get pregnant in the next 12 months', 'within 12 months'),
    o('later', 'Later in life', 'you’d like children later', 'later'), o('not_planning', 'Not planning, or not sure', '', 'not planning/unsure')] },
  { id: 'T1', type: 'single', title: 'How long have you been trying?', show: A => A.Q16 === 'trying_now', options: [
    o('lt6m', 'Under 6 months', 'you’ve been trying for under 6 months', 'under 6 months'), o('6_11m', '6–11 months', 'you’ve been trying for 6–11 months', '6–11 months'), o('gte12m', '12 months or more', 'you’ve been trying for 12 months or more', '12+ months')] },
  { id: 'T2', type: 'single', title: 'Has your partner had a semen test?', show: A => A.Q16 === 'trying_now', options: [
    o('normal', 'Yes, it was normal', ''), o('abnormal', 'Yes, something was found', 'your partner’s semen test found something'), o('not_done', 'No', ''), o('na', 'Doesn’t apply to me', '')] },
  { id: 'T3', type: 'multi', title: 'Have you had either of these?', show: A => A.Q16 === 'trying_now', options: [
    o('miscarriage_2plus', '2 or more miscarriages', 'you’ve had 2 or more miscarriages'), o('ectopic', 'An ectopic pregnancy', 'you’ve had an ectopic pregnancy'), NONE('Neither')] }
];
const QMAP = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
const optOf = (qid, code) => (QMAP[qid]?.options || []).find(x => x.code === code);
const youOf = (ev) => { const [q, c] = ev.split('.'); return optOf(q, c)?.you || ''; };
const joinAnd = (xs) => xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
export { o, NONE, arrOf, QUESTIONS, QMAP, optOf, youOf, joinAnd };
