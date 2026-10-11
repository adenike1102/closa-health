# Closa Health

Free care plan web experience for closahealth.com: **Landing → Intake → Email → Care plan → Providers**.
Built from the design handoff in `docs/DESIGN_HANDOFF.md` (prototype rules engine ported 1:1, spec in `reference/`).
Guidance, not diagnosis.

- **Frontend:** React + Vite, plain JS and CSS (`frontend/`). The rules engine (`src/lib/evaluate.js`) runs in the browser; the plan is worked out from the answers.
- **Backend:** FastAPI + SQLite (`backend/`). Saves answers against an email, emails the plan link, serves the provider directory, records anonymous action taps.

## Run locally
```
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && uvicorn main:app --reload      # http://localhost:8000/docs

cd frontend && npm install && npm run dev                          # http://localhost:5173
```
Without `SMTP_HOST` the plan email is only logged (the link appears in the backend output).

## Tests
```
cd backend && pytest        # API, validation, privacy, mailer
cd frontend && npm test     # rules engine vs. the spec, intake flow, CSV parser
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

Privacy rules built in: pregnancy answers (Q16, T1–T3) are dropped before saving unless `ttc_consent`; analytics never store the token or email.

## Deploying to Hostinger (closahealth.com)
The API is Python, so you need Hostinger **VPS hosting** (Ubuntu). Shared/Premium web hosting cannot run FastAPI. If you only have shared hosting, you can host `frontend/dist` there (`.htaccess` is included) but the API must run elsewhere.

1. In hPanel, point the domain's DNS A record (and `www`) at the VPS IP. Create the mailbox `hello@closahealth.com` for sending plan emails.
2. On the VPS: `apt install nginx certbot python3-certbot-nginx python3-venv nodejs npm git`, create a `closa` user, clone this repo to `/opt/closa`.
3. `cp backend/.env.example /etc/closa.env`, fill in the SMTP password, `mkdir -p /var/lib/closa && chown closa /var/lib/closa`.
4. Install `deploy/closa-api.service` and `deploy/nginx.conf` (see comments inside), run `certbot --nginx -d closahealth.com -d www.closahealth.com`.
5. `./deploy/deploy.sh` for the first and every later release. Back up `/var/lib/closa/closa.db` (it holds saved plans).

## Before launch (from the handoff)
Clinical review of all plan copy; verify landing stats and the 33-entry provider directory (`backend/data/providers.json`, reloaded on API start); legal review of `frontend/public/privacy.html` (draft) and a monitored `privacy@closahealth.com`; cervical-screening age (spec 25 vs. intake band 20–34).
