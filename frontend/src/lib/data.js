// Static copy for the landing page and the providers screen.
// The provider directory itself lives in the API folder (api/data/providers.json).

export const CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Oyo State'];

// Landing symptom cards -> the Q1 answer code they pre-fill.
export const SYM_TO_Q1 = {
  'Painful periods': 'pain',
  'Heavy periods': 'heavy',
  'Irregular periods': 'irregular',
  'Missing periods': 'irregular',
  'Trying to conceive': 'ttc',
};

export const SYMPTOMS = [
  { name: 'Painful periods', feel: 'Curled up with a hot water bottle, cancelling plans, taking painkillers that barely touch it. Month after month.' },
  { name: 'Heavy periods', feel: 'Doubling up on pads, setting alarms in the night, planning your day around the nearest toilet.' },
  { name: 'Irregular periods', feel: 'Never knowing when it will come. Weeks early, months late, and no one can tell you why.' },
  { name: 'Missing periods', feel: 'Months without a period, and a quiet worry about what it means for your body.' }
];
export const REASONS = [
  { n: '01', t: 'It gets called normal.', d: 'Many of us were told period pain is just part of being a woman, so we learn to put up with it.' },
  { n: '02', t: 'Symptoms are seen one at a time.', d: 'Pain, bleeding and tiredness are often treated separately, so the bigger picture is missed.' },
  { n: '03', t: 'It’s hard to know who to see.', d: 'GP, gynaecologist or another specialist. Without a clear path, it’s easy to give up.' },
  { n: '04', t: 'The first door isn’t clear.', d: 'It’s hard to know where to start, and seeing a specialist who understands can be costly and confusing.' }
];
export const HOW = [
  { n: '1', t: 'Answer a few questions', d: 'Short questions about your symptoms, one at a time. About five minutes.' },
  { n: '2', t: 'Get your care plan', d: 'Free and made for you, in plain language you can come back to.' },
  { n: '3', t: 'Take it to the right person', d: 'Book or contact a provider near you, with your questions ready.' }
];

// Stats on the landing page. Nigeria first. The clinical team must verify these before launch.
export const STATS = [
  { value: '45%', text: 'of Nigerian women in a community study had fibroids when scanned. Many had never been told.', source: 'ACCME cohort, central Nigeria', bg: '#E7DCE4' },
  { value: '3×', text: 'Black women are about three times more likely to have fibroids, often earlier and with worse symptoms.', source: 'Lagos fibroid study, 2021', bg: '#EFE6EB' },
  { value: '58%', text: 'of Nigerian women of reproductive age are anaemic. Heavy periods are a common, overlooked cause.', source: 'Nigeria DHS, 2023', bg: '#F0E7DD' },
  { value: '190 million', text: 'women and girls worldwide are estimated to live with endometriosis. That’s about 1 in 10.', source: 'World Health Organization', bg: '#EFE6EB' },
  { value: '7–9 years', text: 'is the average wait from first symptoms to an endometriosis diagnosis.', source: 'npj Women’s Health, 2024', bg: '#F0E7DD' },
  { value: 'Up to 70%', text: 'of women with PCOS worldwide don’t know they have it.', source: 'World Health Organization', bg: '#E4E8E1' },
];

// What the providers screen says for each plan category. Order of the keys matters to nobody.
export const PROV = {
  gp: { heading: 'GPs and general hospitals', intro: 'A GP or general hospital doctor can review your symptoms, arrange first blood tests and a scan, and refer you to a specialist.',
    guide: { title: 'What to look for in a GP', points: ['A doctor with an interest in women’s health', 'A longer appointment, so there’s time for your full story', 'A clinic that can do blood tests on the same day'] } },
  gyn: { heading: 'Gynaecologists', intro: 'A gynaecologist can examine you, arrange specialist scans and talk through treatment options with you.',
    guide: { title: 'What to look for in a gynaecologist', points: ['Experience with pelvic pain, heavy bleeding or fibroids', 'Access to a transvaginal scan', 'Someone who explains every option, including fertility-sparing ones'] } },
  lab: { heading: 'Labs and testing clinics', intro: 'A lab can run your blood and infection tests. Bring your care plan so they know which tests to do.',
    guide: { title: 'What to look for in a lab', points: ['Accreditation from the Medical Laboratory Science Council of Nigeria', 'Written results you can keep', 'Private sample collection for infection tests'] } },
  haem: { heading: 'Sickle cell and blood clinics', intro: 'A haematologist looks after blood conditions, including bleeding disorders and sickle cell disease.',
    guide: { title: 'What to look for in a blood clinic', points: ['A haematologist who works with gynaecologists', 'Clotting tests available', 'A clinic that already knows your history, if you have one'] } },
  fp: { heading: 'Family planning clinics', intro: 'A family planning clinic can review your contraception and help you find a method that suits you better.',
    guide: { title: 'What to look for', points: ['A full range of methods, including non-hormonal ones', 'Time to talk through side effects', 'Follow-up if bleeding continues'] } },
  fert: { heading: 'Fertility clinics', intro: 'A fertility clinic can check hormones, ovulation and your tubes, and arrange your partner’s semen test.',
    guide: { title: 'What to look for in a fertility clinic', points: ['Tests for both partners from the start', 'Clear pricing before you begin', 'Counselling and emotional support'] } },
};
