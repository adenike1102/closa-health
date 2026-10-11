"""Closa Health API (FastAPI + SQLite).

Routes (all under /api):
  POST   /api/plans            save answers against an email, email the plan link
  GET    /api/plans/{token}    open a saved plan (the token in the emailed link is the key)
  DELETE /api/plans/{token}    delete a saved plan
  GET    /api/providers        provider directory, filtered by city and category
  POST   /api/events           anonymous analytics on action taps
  GET    /api/health           uptime check

There are no accounts: the email is the identity, and the long random token in the link
is what lets someone open a plan. The care plan itself is worked out in the browser from
the saved answers (see frontend/src/lib/evaluate.js).
"""
import json
import logging
import os
import re
import secrets
import sqlite3
import time
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator

from mailer import send_plan_email

log = logging.getLogger("closa")

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
SCHEMA = json.loads((DATA_DIR / "questions_schema.json").read_text())

CITIES = ["Lagos", "Abuja", "Port Harcourt", "Oyo State"]
CATEGORIES = ["gp", "gyn", "lab", "haem", "fp", "fert"]
# Pregnancy plans are only stored when she ticks the optional consent box.
TTC_QUESTIONS = ["Q16", "T1", "T2", "T3"]
EVENT_NAMES = ["plan_action", "directions_tap"]
EMAIL_RE = re.compile(r"^\S+@\S+\.\S+$")


# ---------- settings (read each time so tests can change them) ----------
def db_path() -> str:
    return os.environ.get("CLOSA_DB", str(BASE_DIR / "closa.db"))


def base_url() -> str:
    return os.environ.get("CLOSA_BASE_URL", "http://localhost:5173").rstrip("/")


# ---------- database ----------
@contextmanager
def db():
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    """Creates tables if missing. Add new columns with ALTER TABLE here so old databases keep working."""
    with db() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS plans (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   token TEXT NOT NULL UNIQUE,
                   email TEXT NOT NULL,
                   answers TEXT NOT NULL,
                   ttc_saved INTEGER NOT NULL DEFAULT 0,
                   created_at TEXT NOT NULL
               )"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_plans_email ON plans(email)")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS providers (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   city TEXT NOT NULL,
                   name TEXT NOT NULL,
                   kind TEXT NOT NULL,
                   area TEXT NOT NULL,
                   address TEXT NOT NULL,
                   cats TEXT NOT NULL,
                   note TEXT NOT NULL DEFAULT ''
               )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS events (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   name TEXT NOT NULL,
                   category TEXT,
                   source TEXT,
                   city TEXT,
                   has_plan INTEGER NOT NULL DEFAULT 0,
                   created_at TEXT NOT NULL
               )"""
        )
        # The directory is plain data kept in data/providers.json, so reload it on every start.
        # Edit the file and restart to update the list.
        entries = json.loads((DATA_DIR / "providers.json").read_text())
        conn.execute("DELETE FROM providers")
        conn.executemany(
            "INSERT INTO providers (city, name, kind, area, address, cats, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [(e["city"], e["name"], e["kind"], e["area"], e["address"], json.dumps(e["cats"]), e.get("note", "")) for e in entries],
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Closa Health API", lifespan=lifespan)


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------- input checking ----------
def clean_answers(answers: dict) -> dict:
    """Checks every answer against the question list and returns a tidy copy. Raises ValueError."""
    clean = {}
    for qid, value in answers.items():
        spec = SCHEMA.get(qid)
        if spec is None:
            raise ValueError(f"Unknown question {qid}")
        codes = spec["codes"]
        if spec["type"] == "single":
            if not isinstance(value, str) or value not in codes:
                raise ValueError(f"Invalid answer for {qid}")
            clean[qid] = value
        else:
            if not isinstance(value, list) or not all(isinstance(v, str) and v in codes for v in value):
                raise ValueError(f"Invalid answer for {qid}")
            unique = list(dict.fromkeys(value))
            if unique:
                clean[qid] = unique
    if not clean.get("Q1"):
        raise ValueError("Q1 is required")
    return clean


class PlanIn(BaseModel):
    email: str
    consent: bool
    ttc_consent: bool = False
    answers: dict

    @field_validator("email")
    @classmethod
    def email_ok(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) > 254 or not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("consent")
    @classmethod
    def consent_required(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Consent is required")
        return v

    @field_validator("answers")
    @classmethod
    def answers_ok(cls, v: dict) -> dict:
        return clean_answers(v)


class EventIn(BaseModel):
    name: str
    category: str | None = None
    # "from" is a Python keyword, so the JSON field is read as `source` via an alias below.
    source: str | None = None
    city: str | None = None
    token: str | None = None

    @field_validator("name")
    @classmethod
    def name_ok(cls, v: str) -> str:
        if v not in EVENT_NAMES:
            raise ValueError("Unknown event")
        return v

    @field_validator("category")
    @classmethod
    def category_ok(cls, v):
        if v is not None and v not in CATEGORIES:
            raise ValueError("Unknown category")
        return v

    @field_validator("city")
    @classmethod
    def city_ok(cls, v):
        if v is not None and v not in CITIES:
            raise ValueError("Unknown city")
        return v

    @field_validator("source")
    @classmethod
    def source_ok(cls, v):
        return v[:60] if v else v


# ---------- very small rate limit for saving plans (stops the email form being used to spam people) ----------
RATE_LIMIT = 10  # plans per IP per hour
RATE_WINDOW = 3600
_hits: dict[str, list[float]] = {}


def check_rate_limit(ip: str):
    t = time.time()
    recent = [h for h in _hits.get(ip, []) if t - h < RATE_WINDOW]
    if len(recent) >= RATE_LIMIT:
        _hits[ip] = recent
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
    recent.append(t)
    _hits[ip] = recent


# ---------- routes ----------
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/plans", status_code=201)
def create_plan(body: PlanIn, request: Request, background: BackgroundTasks):
    check_rate_limit(request.client.host if request.client else "unknown")
    answers = dict(body.answers)
    if not body.ttc_consent:
        for q in TTC_QUESTIONS:
            answers.pop(q, None)
    token = secrets.token_urlsafe(24)
    with db() as conn:
        conn.execute(
            "INSERT INTO plans (token, email, answers, ttc_saved, created_at) VALUES (?, ?, ?, ?, ?)",
            (token, body.email, json.dumps(answers), int(body.ttc_consent), now()),
        )
    background.add_task(send_plan_email, body.email, f"{base_url()}/plan/{token}")
    return {"token": token}


@app.get("/api/plans/{token}")
def get_plan(token: str):
    with db() as conn:
        row = conn.execute("SELECT email, answers, created_at FROM plans WHERE token = ?", (token,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"email": row["email"], "answers": json.loads(row["answers"]), "created_at": row["created_at"]}


@app.delete("/api/plans/{token}", status_code=204)
def delete_plan(token: str):
    with db() as conn:
        cur = conn.execute("DELETE FROM plans WHERE token = ?", (token,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return Response(status_code=204)


@app.get("/api/providers")
def list_providers(city: str = Query(...), cat: str = Query(...)):
    if city not in CITIES:
        raise HTTPException(status_code=422, detail="Unknown city")
    if cat not in CATEGORIES:
        raise HTTPException(status_code=422, detail="Unknown category")
    with db() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM providers WHERE city = ? ORDER BY id", (city,))]
    for r in rows:
        r["cats"] = json.loads(r["cats"])
    matches = [r for r in rows if cat in r["cats"]]
    fallback = not matches
    if fallback:  # no dedicated listing: show the city's general hospitals that can refer her on
        matches = [r for r in rows if "gp" in r["cats"]]
    for r in matches:
        r.pop("cats")
    return {"providers": matches, "fallback": fallback}


@app.post("/api/events", status_code=204)
def record_event(body: EventIn):
    with db() as conn:
        conn.execute(
            "INSERT INTO events (name, category, source, city, has_plan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (body.name, body.category, body.source, body.city, int(bool(body.token)), now()),
        )
    return Response(status_code=204)


# ---------- optional: serve the built frontend from this same process ----------
# Set CLOSA_STATIC_DIR=/path/to/frontend/dist. Handy for a one-process setup; nginx can do this job too.
STATIC_DIR = os.environ.get("CLOSA_STATIC_DIR")
if STATIC_DIR:
    static_root = Path(STATIC_DIR).resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        target = (static_root / path).resolve()
        if path and target.is_file() and static_root in target.parents:
            return FileResponse(target)
        page = (static_root / (path + ".html")).resolve()  # /privacy -> privacy.html
        if path and page.is_file() and static_root in page.parents:
            return FileResponse(page)
        return FileResponse(static_root / "index.html")
