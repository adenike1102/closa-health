// Static copy for the landing page and the providers screen (final copy from the v2 handoff).
// The provider directory itself lives in the API folder (api/data/providers.json).

export const CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Oyo State'];

// The hero photo, shown inside the arch on the landing page. To change it, replace
// frontend/public/brand/hero-photo.jpg (about 900px wide is plenty) and update the description below.
// Only use a photo you have written permission to use.
export const HERO_PHOTO = {
  src: '/brand/hero-photo.jpg',
  alt: 'A smiling woman relaxing in a wicker armchair by a window, reading a book with a small dog resting on her lap',
  width: 900,
  height: 1350,
};

// Goal cards on the landing page. `codes` are the answers they pre-fill in the first question (max 3 are used).
// `key` is the anonymous tag sent to the dashboard when a card is picked.
export const GOALS = [
  { key: 'less_pain', name: 'I want my life back from period pain', feel: 'No more curling up with a hot water bottle, cancelling plans, or taking painkillers that barely touch it.', codes: ['less_pain'] },
  { key: 'regular_periods', name: 'I want my cycle to make sense', feel: 'Weeks early, months late, or not at all, and no one can tell you why.', codes: ['regular_periods'] },
  { key: 'get_pregnant', name: 'I want to get pregnant', feel: 'Months of trying and hoping, and questions you’re tired of answering.', codes: ['get_pregnant'] },
  { key: 'more_energy', name: 'I want my energy and mood back', feel: 'Tired all the time, and a week every month when you don’t feel like yourself.', codes: ['more_energy', 'steady_mood'] },
  { key: 'weight_skin_hair', name: 'I want to feel at home in my body', feel: 'Weight that won’t shift, skin or hair changes, and a sense your hormones are working against you.', codes: ['weight_skin_hair'] },
  { key: 'reassurance', name: 'I want to stop worrying', feel: 'A quiet fear that something more serious is going on, and no one to ask.', codes: ['reassurance'] },
];

export const REASONS = [
  { n: '01', t: 'You were told it’s normal.', d: 'So you learned to push through, month after month.' },
  { n: '02', t: 'Your symptoms were seen one at a time.', d: 'Pain here, heavy bleeding there, tiredness somewhere else. No one joined the dots.' },
  { n: '03', t: 'You didn’t know who to see.', d: 'GP, gynaecologist, or someone else? Without a clear path, it’s easy to give up.' },
  { n: '04', t: 'Every visit cost time and money.', d: 'And sometimes you still left without answers.' },
];

export const HOW = [
  { n: '1', t: 'Answer a few questions', d: 'One at a time, in plain words, about 2 minutes. Questions that don’t apply to you are skipped.' },
  { n: '2', t: 'Get your plan straight away', d: 'Free, made from your answers, and sent to your email so you can come back to it.' },
  { n: '3', t: 'Walk in prepared', d: 'Take your plan and doctor summary to a GP or gynaecologist you choose, with your questions ready.' },
];

// Three statistics, each linked to its source. The sources were supplied with the handoff; they have not been
// re-checked here, so the clinical team should confirm each figure and link before launch.
export const STATS = [
  { value: '5–12 years', text: 'is how long women wait from first symptoms to an endometriosis diagnosis, across studies worldwide.', source: 'Source: BJOG systematic review, 2025', href: 'https://doi.org/10.1111/1471-0528.17973', bg: '#E7DCE4' },
  { value: '47%', text: 'of Nigerian women of reproductive age are anaemic. Heavy periods are a common, overlooked cause.', source: 'Source: Nigeria DHS, 2024', href: 'https://dhsprogram.com/pubs/pdf/SR294/SR294.pdf', bg: '#F0E7DD' },
  { value: 'Up to 70%', text: 'of women with PMOS (previously PCOS) don’t know they have it.', source: 'Source: World Health Organization', href: 'https://www.who.int/news-room/fact-sheets/detail/polycystic-ovary-syndrome', bg: '#E4E8E1' },
];

export const FAQS = [
  ['Is it really free?', 'Yes. Your care plan is free, and you don’t need a card.'],
  ['Is this a diagnosis?', 'No. Your plan shows what your symptoms may point to and how to get properly checked. Only a doctor who examines and tests you can diagnose you.'],
  ['Who wrote the questions?', 'They are based on established clinical guidance.'],
  ['What happens to my answers?', 'They are used to build your plan and kept securely. We never sell them. We’ll only email you about new features if you tick the box to say yes.'],
  ['I’ve already seen a doctor. Will this still help?', 'Yes. Tell us what’s been done, and your plan suggests what to ask for next, rather than starting again.'],
  ['What if my symptoms are serious?', 'The first questions check for warning signs. If anything needs urgent care, your plan tells you straight away. If you feel very unwell now, call 112 or go to the nearest hospital emergency unit.'],
  ['Do I need to know medical words?', 'No. Everything is in plain language, and your plan includes a summary in doctors’ words for you to show them.'],
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
