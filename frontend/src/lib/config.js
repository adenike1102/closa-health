// Tunable thresholds for the rules engine and age-band helpers.
const CONFIG = { MAX_POSSIBILITIES: 4, MAX_SPECIALISTS: 3, MAX_WARNINGS: 5, EMERGENCY_NUMBER: '112', CERV_MIN_AGE_BAND: '20_34', ADENO_MIN_AGE_BAND: '35_39', PERI_MIN_AGE_BAND: '40_44', ENDOMRISK_MIN_AGE_BAND: '45_54', POI_BELOW_AGE_BAND: '40_44', TTC_WAIT_UNDER_35: 'gte12m', TTC_WAIT_35_39: ['6_11m', 'gte12m'], TTC_NO_WAIT_AGE_BAND: '40_44' };
const AGES = ['lt16', '16_19', '20_34', '35_39', '40_44', '45_54', '55p'];
const ageAtLeast = (a, b) => !!a && AGES.indexOf(a) >= AGES.indexOf(b);
const ageBelow = (a, b) => !!a && AGES.indexOf(a) < AGES.indexOf(b);
export { CONFIG, AGES, ageAtLeast, ageBelow };
