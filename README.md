# Closa Health

Free care plan web experience for closahealth.com: **Landing → Intake → Email → Care plan → Providers**.
Built from the design handoff in `docs/DESIGN_HANDOFF.md` (prototype rules engine ported 1:1, spec in `reference/`).
Guidance, not diagnosis.

- **Frontend:** React + Vite, plain JS and CSS (`frontend/`). The rules engine (`src/lib/evaluate.js`) runs in the browser; the plan is worked out from the answers.
- **API:** plain PHP + SQLite (`api/`), built to run on **Hostinger Premium Web Hosting** (no VPS, no Node, no Python on the server). Saves answers against an email, emails the plan link, serves the provider directory, records anonymous action taps.

## Run locally
Needs PHP 8.1+ (with `pdo_sqlite`) and Node 18+.
```
# API (http://127.0.0.1:8000/api/health). Emails are written to a file instead of being sent.
CLOSA_DB=/tmp/closa.db CLOSA_MAIL_TRANSPORT=file CLOSA_MAIL_FILE=/tmp/closa-mail.jsonl \
  php -S 127.0.0.1:8000 -t api api/index.php

# Frontend (http://localhost:5173, proxies /api to the API above)
cd frontend && npm install && npm run dev
```

## Tests
```
cd frontend && npm test                                              # rules engine vs. the spec, intake flow, CSV parser
python3 -m venv api/tests/.venv && . api/tests/.venv/bin/activate
pip install -r api/tests/requirements.txt && pytest api/tests        # starts the real PHP API and calls it over HTTP
```
If you change `frontend/src/lib/questions.js`, run `node scripts/export_schema.mjs` so the server accepts the new answer codes (a test checks they match).

## API
| Route | What |
|---|---|
| `POST /api/plans` | `{email, consent, ttc_consent, answers}` → `201 {token}`; emails `https://closahealth.com/plan/<token>`. 422 on bad input, 429 after 10/hour per IP |
| `GET /api/plans/{token}` | `{email, answers, created_at}` or 404 |
| `DELETE /api/plans/{token}` | 204 or 404 |
| `GET /api/providers?city=&cat=` | `{providers, fallback}` (city: Lagos, Abuja, Port Harcourt, Oyo State; cat: gp, gyn, lab, haem, fp, fert) |
| `POST /api/events` | 204. `plan_action` / `directions_tap`, no personal data stored |
| `GET /api/health` | `{status: "ok"}`; also checks the database opens |

Privacy rules built in: pregnancy answers (Q16, T1–T3) are dropped before saving unless `ttc_consent`; analytics never store the token or email; the emailed link always uses the configured `base_url`, never the request's Host header.

## Deploying to Hostinger Premium Web Hosting (closahealth.com)

**1. Build the upload** (on your computer, or ask Claude to):
```
./scripts/build-shared.sh        # -> dist-shared/closa-public_html.zip
```

**2. Prepare hPanel**
- *Domains / SSL*: make sure the free SSL for closahealth.com is installed and active.
- *Advanced → PHP Configuration*: choose PHP **8.2 or 8.3** (8.1 is the minimum) and check that the extensions `pdo_sqlite` and `sqlite3` are ticked (they normally are).
- *Emails*: create the mailbox `hello@closahealth.com`. Plan emails are sent through it, which is what keeps them out of spam folders.

**3. Upload**
- *Files → File Manager → `public_html`*: upload `closa-public_html.zip` and **Extract** it there. (If there is a default placeholder `index.php`/`default.php`, delete it.)
- Open `public_html/api/`, copy `config.example.php` to `config.php`, edit it, and put the mailbox password in `smtp_password`.

**4. Check**
- Open `https://closahealth.com/api/health`: you should see `{"status":"ok"}`. A 503 message tells you which PHP extension is missing.
- Open `https://closahealth.com`, make a plan with your own email, and open the link in the email.

Where things live: the website and the `api/` folder go in `public_html`. The database is created automatically in a `closa-data` folder **next to** `public_html` (not inside it, so it can't be downloaded). It holds the saved plans, so include it in your backups (hPanel → Backups, or download it from File Manager now and then).

**Updating later:** run the build again, upload the zip over `public_html` and extract with overwrite. Your `api/config.php` and the database are not in the zip, so they are kept.

Notes: Hostinger limits how many emails a mailbox can send per hour/day, which is plenty for early use. Shared hosting can't run background workers, so the plan email is sent right after the response is returned.

## Before launch (from the handoff)
Clinical review of all plan copy; verify landing stats and the 33-entry provider directory (`api/data/providers.json`, read on every request: edit and re-upload that one file to update it); legal review of `frontend/public/privacy.html` (draft) and a monitored `privacy@closahealth.com`; cervical-screening age (spec 25 vs. intake band 20–34).
