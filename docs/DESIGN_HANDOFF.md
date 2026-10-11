# Handoff: Closa Health — free care plan web experience

## Overview
A mobile-first web experience for closahealth.com, for women in Nigeria with painful, heavy, irregular or missing periods (and, inside the intake, those trying to conceive) who don't know what's wrong or who to see. She reads a scrolling landing page, answers a short adaptive intake, gives her email, and receives a personalised **care plan**. Each recommendation links to a filtered **providers** list by city.

Flow: **Landing → Intake → Email → Care plan → Providers**. No account creation (email is the identity). No app download.

Tone: calm, warm, clear. **Never promise a diagnosis or cure.** Every plan carries "guidance, not diagnosis".

## About the design files
`Closa Health.dc.html` is a **design reference built in HTML** — a working prototype showing intended look, copy and behaviour. It is not production code. Recreate it in the target codebase's stack (or, if none exists, a sensible choice such as Next.js + TypeScript + Tailwind). Open the file in a browser to use it; `support.js` is the prototype runtime and must sit next to it.

The prototype has a dev-only bar at the top: screen jumper (1–5) and a device switch (Auto / Mobile 390 / Tablet 820 / Desktop 1280). Do not ship it.

## Fidelity
**High-fidelity.** Final colours, type, copy, spacing and interactions. Recreate pixel-accurately. The **care plan rules engine is functional** and is the source of truth for logic alongside `reference/Closa Intake and Care Plan Rules.docx`.

## Where things live in the prototype file
- Template (markup, inline styles): top of the file, sections marked `<!-- 1 LANDING -->` … `<!-- 6 PROVIDERS -->`.
- Logic, in the `<script data-dc-script>` block:
  - `QUESTIONS` — every intake question, option code, user-facing label, the "you" phrasing used in evidence lines, and the clinical phrasing used in the doctor summary. `show:` functions are the skip logic.
  - `CONTENT` — all care plan copy (urgency, flags, notes, tests, warnings, disclaimers).
  - `evaluate(answers)` — the rules engine (flags → urgency → possibilities → who to see → tests → TTC → questions → warnings → doctor summary).
  - `parseCycleCsv(text)` — cycle-app CSV parser.
  - `DIRECTORY`, `CITIES`, `PROV` — provider data and per-category copy.
  - `CONFIG` — tunable thresholds (max items, emergency number, age bands).
  - `layout()` — responsive breakpoint values (see Responsive).

Port `QUESTIONS`, `CONTENT`, `evaluate`, `parseCycleCsv` and `CONFIG` to typed modules almost 1:1; unit-test `evaluate` against the rules doc.

## Design tokens
**Font:** Jost (Google Fonts), weights 300, 400, 500, 600. No other family.

**Colours**
| Token | Hex | Use |
|---|---|---|
| ink | `#1A1A1A` | body text, urgent panels, hover for primary buttons |
| bone | `#F7F6F2` | page background, text on dark |
| aubergine (accent) | `#4A2545` | primary buttons, headings accents, progress, selected states |
| mauve | `#D8C6D1` | borders, dividers, inactive chips |
| blush | `#EFE6EB` | soft panels, selected option fill |
| plan tint — rose | `#E7DCE4` | care plan section bg |
| plan tint — sand | `#F0E7DD` | care plan section bg |
| plan tint — sage | `#E4E8E1` | care plan section bg, "suggested" notes |
| muted text | `#4a4a4a`, `#333` | secondary copy |
| aubergine-light | `#6b4566`, `#5c3557` | decorative marks / chips on aubergine |
| frame bg (dev only) | `#E3DED8` | |

**Type scale** (mobile / tablet / desktop)
- H1 hero: 38 / 52 / 60px, weight 300, line-height 1.08, letter-spacing −0.015em. Second line in aubergine.
- H2 section (landing): 34 / 44 / 54px, weight 300.
- H2 screen title (intake/email): 30 / 36 / 36px, weight 400, lh 1.2.
- H2 providers: 30 / 40 / 48px, weight 400.
- Care plan section title: 22px / 500. Card title: 19px / 500.
- Body: 16–18px / 300–400. Small: 13–15px.
- Eyebrows: 13–14px, weight 500, uppercase, letter-spacing .08em, aubergine.
- Stat numerals: 40 / 44 / 34px, weight 300, nowrap.

**Radius:** 999px (buttons, chips, pills), 28px (care plan sections), 24px (cards, panels), 20px (inner cards, upload), 16px (intake options), 12–14px (inline notes), 6px (checkbox).

**Spacing:** page side padding 24 / 40 / 56px (16 / 32 / 56 in plan & providers). Landing section vertical 64 / 88 / 112px. Gaps typically 8, 10, 12, 14, 16, 20, 24px.

**Shadow:** only the hero plan card: `0 24px 50px rgba(74,37,69,.18)`.

**Buttons**
- Primary: height 56–60px, pill, bg `#4A2545`, text `#F7F6F2` 18px/500; hover bg `#1A1A1A`.
- Disabled primary: bg `#D8C6D1`.
- Secondary: 1.5px `#4A2545` border, transparent, aubergine text; hover bg `#EFE6EB`.
- Care plan action: min-height 50px, pill, aubergine, label + right arrow; full width on mobile, auto on wider.
- Minimum touch target 44px everywhere.

## Responsive
Breakpoints: **mobile < 700px**, **tablet 700–1023px**, **desktop ≥ 1024px**. Content max-widths: landing 560 / 880 / 1240; intake/email form 480 / 600 / 600; plan 480 / 800 / 1240; providers 480 / 900 / 1240. All values are in `layout()`.

## Screens

### 1. Landing (long scroll)
Sticky top bar: logo lockup (`lockup-aubergine.png`, 22/26px high) left; floating **"Get my free care plan"** pill top-right (44/48px high), always visible.

Sections in order:
1. **Hero** — two columns on desktop (text 1.1fr / visual 1fr), stacked otherwise.
   - H1: "Years of painful symptoms." + aubergine "One step to the right care."
   - Sub (18px, 300, `#4a4a4a`, max 500px): "A free, personalised care plan that shows you who to see, what to ask for and how soon."
   - Primary CTA "Get my free care plan" + "About 5 minutes".
   - Animated visual (440/480px tall): blush circle, mauve Closa mark, a floating care plan card (gently bobbing, 6s ease-in-out loop) listing *What it may point to / Who to see / What to ask / What to watch for*, and floating symptom chips (Painful, Heavy, Irregular, Missing periods) drifting on 5.5–7s loops.
2. **"You know this feeling"** — H2 "Does any of this sound like you?" + "Tap the ones you know too well. We'll start your plan from there." Four selectable symptom cards (`SYMPTOMS`), each with an empathetic line and a "That's me" toggle. When any are selected, a CTA "Start my plan with these N" appears; selections pre-fill intake Q1. Closing line "You're not alone in this."
3. **"Why it takes so long"** — H2 "You're not imagining it. Help is often missed or delayed." Four numbered reasons (`REASONS`) left; on desktop a sticky 2-column grid of six stat cards right (1 column on mobile). Stats (Nigeria first): 45% fibroids (ACCME cohort, central Nigeria); 3× Black women fibroids (Lagos study 2021); 58% anaemia (Nigeria DHS 2023); 190 million endometriosis (WHO); 7–9 years diagnosis delay (npj Women's Health 2024); up to 70% PCOS undiagnosed (WHO). Card bgs cycle rose/blush/sand/sage. **Have the clinical team verify stats and captions before launch.**
4. **"There is help"** — H2 "You don't have to keep putting up with it." + paragraph. Four "what your plan shows" cards, each with a small looping animation: 01 What it may point to (pulsing rings), 02 Who to see (bobbing map pin), 03 What to ask (chat bubble + typing dots), 04 What to watch for (calendar grid cells filling).
5. **"How it works"** — H2 "One simple step toward the right care." Three steps (`HOW`). Two trust notes: *Private by design…* and *Guidance, not diagnosis…*
6. **Closing CTA** on aubergine — "You've waited long enough." / "Take a few minutes for yourself today, and leave with a clear next step." / CTA.
7. **Footer** — "Closa Health offers guidance, not diagnosis. If you need urgent help, call 112 or go to the nearest hospital emergency unit." / © 2026 Closa Health.

The landing page does **not** mention trying to conceive.

### 2. Intake (one question per screen)
- Desktop: two columns (5fr aubergine side panel with "A few short questions." + privacy note / 7fr form). Tablet/mobile: single column.
- Header: back button (44px circle), "Question X of Y", 4px progress bar (blush track, aubergine fill, width transition .3s).
- Option buttons: min-height 58px, radius 16px, 1.5px `#D8C6D1` border; selected = aubergine border + blush fill + filled marker (circle for single, rounded square for multi). Hover border aubergine.
- **Single-choice auto-advances** after 220ms. Multi-choice needs "Continue" (disabled until something is chosen). "None of these" is exclusive.
- Sticky bottom bar with Continue (and "Skip for now" on optional steps).
- Questions: `Q0` safety screen first, then Q1–Q16, conditional follow-ups (Q6, Q8, Q11, Q13) and TTC follow-ups T1–T3 (only if Q16 = trying now). Total count updates as skip logic changes.
- **Safety (Q0):** any option other than "None" shows an emergency screen before continuing — ink card, warning icon, specific copy per option, **Call 112** (`tel:112`) for life-threatening items; aubergine-outlined "Book within 2 weeks" card for post-menopausal bleeding. Button "I understand, continue". These banners are also pinned to the top of the plan.
- **Upload step (`UP`, optional, before Q5):** dashed drop area "Add a CSV export — From Flo, Clue or another period app". `parseCycleCsv` reads period start dates from the last 6 months and suggests a Q5 answer (regular / frequent / infrequent / unpredictable / none 3m); logged spotting pre-ticks "Between periods" in Q9. Under 3 cycles → no suggestion. On Q5 a sage note says "We suggested this from your period app…". The file is discarded; only the suggestion is kept.

### 3. Email capture (required)
Back button; heading "Your plan is ready. Where should we send it?"; reason paragraph; email field (validate `\S+@\S+\.\S+`); required consent checkbox with privacy policy link; **optional** second checkbox to store pregnancy plans (only shown if she answered a TTC intent); "See my plan" enabled only when email valid + consent; "No spam. Unsubscribe any time." Desktop shows an aubergine side panel summarising what the plan includes.

### 4. Care plan
Desktop: 360px sticky left aside + content column. Tablet/mobile: aside on top, then a horizontally scrolling chip row of step shortcuts.

**Aside** (aubergine card with decorative mark): "Your care plan · {date}", greeting, chips of her main concerns, "How soon" box (bone bg) with the urgency label, and on desktop a numbered step index (smooth-scrolls to sections). Below: "guidance, not diagnosis" note.

**Sections** (numbered "Step 01…", only those that apply), each a 28px-radius tinted block with a 52px icon circle:
1. Pinned safety banners (if any).
2. **How soon to be seen** (blush) — label + 5-segment scale (Emergency, 1–2 days, 2 weeks, 4–6 weeks, Routine) + body.
3. **Take a pregnancy test first** (sand) — when Q3 is yes/unsure.
4. **What your answers may point to** (rose) — up to 4 possibilities; each card: title, body (fertility-aware variant if she has pregnancy goals), "Why we suggest this: …" built from her answers, and an action button (e.g. "Find a gynaecologist"). Reassurance card if nothing flags. Notes (told it's normal, sickle cell, many visits, breastfeeding).
5. **Who to see** (blush) — up to 3 stops, "For: …", "Then ask for: …", action button (or Call 112 for emergencies).
6. **Tests to ask for** (sand) — numbered list with timing and notes; "Bring the results of any scans or blood tests" when relevant; "Your specialist may suggest" list; "Find a lab".
7. **Questions to ask your doctor** (sage) — tappable checklist, strike-through when ticked, "N of M asked".
8. **Warning signs** (ink panel) — specific + generic signs, "Call 112 or go to the nearest hospital emergency unit" + Call 112.
9. **What you can do now** (sage) — self-care bullets.
10. **Trying to conceive** (sand) — only if she's trying now or within 12 months; cards + "Find a fertility clinic".
11. **Summary for your doctor** (outlined) — clinical paragraph generated from answers; **Copy summary** (shows "Copied" 2s) and **Print** (opens a clean printable page).
12. Disclaimer: "This care plan is guidance based on your answers. It is not a diagnosis. Only a clinician who examines you can diagnose you."

Every action button goes straight to Providers filtered by that category. If the plan is opened without intake answers the prototype shows a demo plan (`DEMO`) — remove in production.

### 5. Providers (listing only — no booking, no calling)
- Back "My plan"; logo on wider screens.
- **Your location** chips: Lagos, Abuja, Port Harcourt, Oyo State (44px pills, nowrap; selected = aubergine fill).
- Heading + intro per category (`PROV[cat].heading/intro`): GPs and general hospitals, Gynaecologists, Labs and testing clinics, Sickle cell and blood clinics, Family planning clinics, Fertility clinics.
- Grid of cards (auto-fit, min 320px): name, type, area pill (blush), optional note, address, **Get directions** (opens Google Maps search for name + address). No phone, no Call button.
- Filter: `DIRECTORY` where `city === selected` and `cats` includes the category. If none, fall back to that city's general hospitals with the note "We don't have a dedicated listing for this in {city} yet, so here are hospitals that can see you and refer you on."
- Guidance card "What to look for in a …" with 3 points.
- **The 33 directory entries are a starting sample compiled without verification** — replace with a vetted provider database (with categories, coordinates, and ideally distance sorting).

## Rules engine summary
Full spec: `reference/Closa Intake and Care Plan Rules.docx`. Implemented in `evaluate()`:
- **Flags** (`F-HMB`, `F-FIBROID`, `F-ENDO`, `F-ADENO`, `F-SECDYSM`, `F-PCOS`, `F-THY`, `F-PRL`, `F-POI`, `F-PERI`, `F-HYPO`, `F-AMEN`, `F-PRIMAMEN`, `F-ASHERMAN`, `F-OLIGO`, `F-FREQ`, `F-IMB`, `F-PCB`, `F-BULK`, `F-ENDOMRISK`, `F-INFECT`, `F-ANAEMIA`, `F-BLEEDDIS`, `F-CONTRA`, `F-PRIMDYSM`, `F-PREG`, `F-POSTPARTUM`), each storing the answer codes that triggered it (used for "Why we suggest this").
- **Urgency** 1–5 (most urgent wins); severe impact bumps routine to 4–6 weeks; reassurance/postpartum variants.
- **Possibilities**: priority order `CLIN`, max 4; HMB hidden under fibroids/adenomyosis, SECDYSM hidden under endo/adeno.
- **Who to see**: merged by stop, sorted by urgency then priority, max 3; "seen several times" upgrades GP to consultant gynaecologist.
- **Tests**: ordered list with timing; hormonal-contraception and pregnancy notes.
- **TTC**: wait thresholds by age (`CONFIG`), red-flag "don't wait", miscarriage, semen test, preconception, loss support.
- Emergency number: **112** throughout.

## State
`screen`, `qid`, `hist` (back stack), `emergency`, `answers` (map of question id → code or code[]), `upload` (parse result), `email`, `consent`, `ttcConsent`, `pre` (landing symptom picks), `activeCat`, `activeAction`, `city`, `asked` (question checklist), `copied`. Scroll to top on screen/question change.

Backend needs (not in prototype): save answers + plan against email, send plan email with link back, privacy/consent storage (TTC data only if `ttcConsent`), provider directory API, analytics on action taps.

## Accessibility
44px+ targets, visible focus states, text contrast ≥ 4.5:1 (no muted text on tinted grounds below that), `aria-label` on icon buttons, respect `prefers-reduced-motion` for all landing animations.

## Assets
- `uploads/lockup-aubergine.png` — header logo.
- `uploads/app-icon-bone.png`, `uploads/app-icon-aubergine.png` — Closa mark used in side panels / hero card.
- Icons are simple inline line SVGs (1.6–1.8 stroke, aubergine) — replace with your icon set if preferred.
- `reference/Closa Health brand identity.pdf` — brand guidelines.

## Files
- `Closa Health.dc.html` — the full prototype (open in a browser).
- `support.js` — prototype runtime (reference only).
- `reference/Closa Intake and Care Plan Rules.docx` — clinical rules spec.
- `reference/Closa Health brand identity.pdf` — brand.

## Open items for the team
- Clinical review of all plan copy (written from the rules doc's content IDs).
- Verify landing stats and provider directory.
- Cervical screening age: spec says 25, intake age band is 20–34; prototype shows it for the whole band.
- CSV parser is generic; add per-app parsers (Flo, Clue) if needed.
