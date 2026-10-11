import json
import os
import sqlite3

import pytest
from fastapi.testclient import TestClient

import main
import mailer

VALID_ANSWERS = {"Q0": ["none"], "Q1": ["pain", "heavy"], "Q2": "20_34", "Q3": "no", "Q16": "trying_now", "T1": "lt6m"}


def make_body(**over):
    body = {"email": "Ada@Example.com", "consent": True, "ttc_consent": False, "answers": dict(VALID_ANSWERS)}
    body.update(over)
    return body


@pytest.fixture()
def client(tmp_path, monkeypatch):
    # A fresh database, a quiet mailer and a clean rate limit for every test.
    monkeypatch.setenv("CLOSA_DB", str(tmp_path / "t.db"))
    monkeypatch.delenv("SMTP_HOST", raising=False)
    main._hits.clear()
    with TestClient(main.app) as c:
        yield c


def test_tests_do_not_use_the_real_database():
    assert "closa.db" not in main.db_path()
    assert not main.db_path().startswith(str(main.BASE_DIR))


# ---------- health ----------
def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


# ---------- POST /api/plans ----------
def test_create_plan_returns_token(client):
    r = client.post("/api/plans", json=make_body())
    assert r.status_code == 201
    assert len(r.json()["token"]) >= 20


def test_create_plan_lowercases_email_and_sends_link(client, monkeypatch):
    sent = []
    monkeypatch.setattr(main, "send_plan_email", lambda to, link: sent.append((to, link)))
    monkeypatch.setenv("CLOSA_BASE_URL", "https://closahealth.com/")
    r = client.post("/api/plans", json=make_body())
    token = r.json()["token"]
    assert sent == [("ada@example.com", f"https://closahealth.com/plan/{token}")]
    assert client.get(f"/api/plans/{token}").json()["email"] == "ada@example.com"


@pytest.mark.parametrize("email", ["", "nope", "a@b", "a b@c.com", "x" * 250 + "@a.com"])
def test_create_plan_rejects_bad_email(client, email):
    assert client.post("/api/plans", json=make_body(email=email)).status_code == 422


def test_create_plan_requires_consent(client):
    assert client.post("/api/plans", json=make_body(consent=False)).status_code == 422
    body = make_body()
    del body["consent"]
    assert client.post("/api/plans", json=body).status_code == 422


@pytest.mark.parametrize(
    "answers",
    [
        {},  # nothing answered
        {"Q2": "20_34"},  # no Q1 concerns
        {"Q1": []},  # empty Q1
        {"Q1": ["pain"], "Q99": "x"},  # unknown question
        {"Q1": ["made_up"]},  # unknown option
        {"Q1": "pain"},  # multi question given a string
        {"Q1": ["pain"], "Q2": ["20_34"]},  # single question given a list
        {"Q1": ["pain"], "Q2": "not_an_age"},
    ],
)
def test_create_plan_rejects_bad_answers(client, answers):
    assert client.post("/api/plans", json=make_body(answers=answers)).status_code == 422


def test_create_plan_removes_duplicate_options(client):
    r = client.post("/api/plans", json=make_body(answers={"Q1": ["pain", "pain", "heavy"]}))
    got = client.get(f"/api/plans/{r.json()['token']}").json()
    assert got["answers"]["Q1"] == ["pain", "heavy"]


def test_pregnancy_plans_not_stored_without_extra_consent(client):
    token = client.post("/api/plans", json=make_body(ttc_consent=False)).json()["token"]
    answers = client.get(f"/api/plans/{token}").json()["answers"]
    assert "Q16" not in answers and "T1" not in answers
    assert answers["Q1"] == ["pain", "heavy"]  # everything else is kept
    # and they are really gone from the database, not just hidden
    row = sqlite3.connect(main.db_path()).execute("SELECT answers, ttc_saved FROM plans").fetchone()
    assert "trying_now" not in row[0] and row[1] == 0


def test_pregnancy_plans_stored_with_extra_consent(client):
    token = client.post("/api/plans", json=make_body(ttc_consent=True)).json()["token"]
    answers = client.get(f"/api/plans/{token}").json()["answers"]
    assert answers["Q16"] == "trying_now" and answers["T1"] == "lt6m"


def test_create_plan_rate_limited(client):
    for _ in range(main.RATE_LIMIT):
        assert client.post("/api/plans", json=make_body()).status_code == 201
    assert client.post("/api/plans", json=make_body()).status_code == 429


def test_invalid_requests_do_not_use_up_rate_limit(client):
    for _ in range(main.RATE_LIMIT + 2):
        assert client.post("/api/plans", json=make_body(email="bad")).status_code == 422
    assert client.post("/api/plans", json=make_body()).status_code == 201


# ---------- GET /api/plans/{token} ----------
def test_get_plan_returns_answers(client):
    token = client.post("/api/plans", json=make_body()).json()["token"]
    r = client.get(f"/api/plans/{token}")
    assert r.status_code == 200
    assert r.json()["answers"]["Q2"] == "20_34"
    assert "created_at" in r.json()


def test_get_plan_unknown_token_404(client):
    assert client.get("/api/plans/does-not-exist-123456789").status_code == 404


def test_plans_are_private_to_their_token(client):
    t1 = client.post("/api/plans", json=make_body(email="one@example.com", answers={"Q1": ["pain"]})).json()["token"]
    t2 = client.post("/api/plans", json=make_body(email="two@example.com", answers={"Q1": ["heavy"]})).json()["token"]
    assert t1 != t2
    a, b = client.get(f"/api/plans/{t1}").json(), client.get(f"/api/plans/{t2}").json()
    assert (a["email"], a["answers"]["Q1"]) == ("one@example.com", ["pain"])
    assert (b["email"], b["answers"]["Q1"]) == ("two@example.com", ["heavy"])
    # an email address or a numeric id can't be used to open a plan
    assert client.get("/api/plans/one@example.com").status_code == 404
    assert client.get("/api/plans/1").status_code == 404


# ---------- DELETE /api/plans/{token} ----------
def test_delete_plan(client):
    token = client.post("/api/plans", json=make_body()).json()["token"]
    assert client.delete(f"/api/plans/{token}").status_code == 204
    assert client.get(f"/api/plans/{token}").status_code == 404


def test_delete_plan_leaves_other_plans(client):
    t1 = client.post("/api/plans", json=make_body()).json()["token"]
    t2 = client.post("/api/plans", json=make_body()).json()["token"]
    client.delete(f"/api/plans/{t1}")
    assert client.get(f"/api/plans/{t2}").status_code == 200


def test_delete_plan_unknown_404(client):
    assert client.delete("/api/plans/does-not-exist-123456789").status_code == 404


def test_delete_twice_404(client):
    token = client.post("/api/plans", json=make_body()).json()["token"]
    client.delete(f"/api/plans/{token}")
    assert client.delete(f"/api/plans/{token}").status_code == 404


# ---------- GET /api/providers ----------
def test_providers_by_city_and_category(client):
    r = client.get("/api/providers", params={"city": "Lagos", "cat": "lab"})
    body = r.json()
    assert r.status_code == 200 and body["fallback"] is False
    names = [p["name"] for p in body["providers"]]
    assert "Synlab Nigeria" in names
    assert "Bridge Clinic" not in names  # fertility only
    assert {"id", "name", "kind", "area", "address", "note"} <= set(body["providers"][0])
    assert "cats" not in body["providers"][0]


def test_providers_only_from_chosen_city(client):
    body = client.get("/api/providers", params={"city": "Abuja", "cat": "gyn"}).json()
    assert body["providers"] and "Lagos" not in json.dumps(body)


def test_providers_fall_back_to_general_hospitals(client):
    # Take away every Oyo State fertility listing, so that city has nothing dedicated for "fert".
    with sqlite3.connect(main.db_path()) as conn:
        conn.execute("UPDATE providers SET cats = REPLACE(cats, '\"fert\"', '\"gp\"') WHERE city = 'Oyo State'")
    body = client.get("/api/providers", params={"city": "Oyo State", "cat": "fert"}).json()
    assert body["fallback"] is True
    assert body["providers"] and all(p["city"] == "Oyo State" for p in body["providers"])


def test_every_city_and_category_returns_something(client):
    for city in main.CITIES:
        for cat in main.CATEGORIES:
            body = client.get("/api/providers", params={"city": city, "cat": cat}).json()
            assert body["providers"], (city, cat)


@pytest.mark.parametrize("params", [{"city": "Paris", "cat": "gp"}, {"city": "Lagos", "cat": "dentist"}])
def test_providers_unknown_values_422(client, params):
    assert client.get("/api/providers", params=params).status_code == 422


@pytest.mark.parametrize("params", [{}, {"city": "Lagos"}, {"cat": "gp"}])
def test_providers_missing_params_422(client, params):
    assert client.get("/api/providers", params=params).status_code == 422


def test_providers_data_file_is_valid():
    entries = json.loads((main.DATA_DIR / "providers.json").read_text())
    assert len(entries) == 33
    for e in entries:
        assert e["city"] in main.CITIES
        assert e["cats"] and set(e["cats"]) <= set(main.CATEGORIES)
        assert e["name"] and e["address"]


# ---------- POST /api/events ----------
def test_record_event(client):
    r = client.post("/api/events", json={"name": "plan_action", "category": "gyn", "source": "who", "token": "abc"})
    assert r.status_code == 204
    row = sqlite3.connect(main.db_path()).execute("SELECT name, category, source, has_plan FROM events").fetchone()
    assert row == ("plan_action", "gyn", "who", 1)


def test_event_does_not_store_the_token(client):
    client.post("/api/events", json={"name": "plan_action", "token": "secret-token-value"})
    dump = "".join(sqlite3.connect(main.db_path()).iterdump())
    assert "secret-token-value" not in dump


@pytest.mark.parametrize(
    "body",
    [{}, {"name": "hack"}, {"name": "plan_action", "category": "nope"}, {"name": "directions_tap", "city": "Mars"}],
)
def test_event_validation_422(client, body):
    assert client.post("/api/events", json=body).status_code == 422


# ---------- startup / upgrades ----------
def test_init_db_keeps_existing_plans(client):
    token = client.post("/api/plans", json=make_body()).json()["token"]
    main.init_db()  # runs on every start; must not lose saved plans
    assert client.get(f"/api/plans/{token}").status_code == 200


def test_init_db_does_not_duplicate_providers(client):
    main.init_db()
    main.init_db()
    count = sqlite3.connect(main.db_path()).execute("SELECT COUNT(*) FROM providers").fetchone()[0]
    assert count == 33


# ---------- the answer list stays in step with the frontend ----------
def test_schema_matches_frontend_questions():
    import subprocess

    repo = main.BASE_DIR.parent
    out = subprocess.run(
        ["node", "-e", "import('./scripts/export_schema.mjs').then(m => console.log(JSON.stringify(m.buildSchema())))"],
        cwd=repo, capture_output=True, text=True,
    )
    if out.returncode != 0:
        pytest.skip("node is not available")
    assert json.loads(out.stdout) == main.SCHEMA


# ---------- email ----------
def test_mailer_only_logs_without_smtp(monkeypatch):
    monkeypatch.delenv("SMTP_HOST", raising=False)
    assert mailer.send_plan_email("a@b.com", "https://x/plan/t") is False


def test_mailer_message_contains_link_and_disclaimer():
    msg = mailer.build_message("a@b.com", "https://closahealth.com/plan/abc")
    text = msg.get_body(("plain",)).get_content()
    assert "https://closahealth.com/plan/abc" in text and "not a diagnosis" in text
    assert msg["To"] == "a@b.com"


def test_mailer_sends_over_smtp(monkeypatch):
    calls = []

    class FakeSMTP:
        def __init__(self, host, port, timeout=None): calls.append(("connect", host, port))
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def login(self, u, p): calls.append(("login", u))
        def send_message(self, m): calls.append(("send", m["To"]))

    monkeypatch.setattr(mailer.smtplib, "SMTP_SSL", FakeSMTP)
    monkeypatch.setenv("SMTP_HOST", "smtp.hostinger.com")
    monkeypatch.setenv("SMTP_PORT", "465")
    monkeypatch.setenv("SMTP_USER", "hello@closahealth.com")
    monkeypatch.setenv("SMTP_PASSWORD", "pw")
    assert mailer.send_plan_email("a@b.com", "https://x") is True
    assert calls == [("connect", "smtp.hostinger.com", 465), ("login", "hello@closahealth.com"), ("send", "a@b.com")]


def test_mailer_failure_does_not_raise(monkeypatch):
    def boom(*a, **k): raise OSError("down")
    monkeypatch.setattr(mailer.smtplib, "SMTP_SSL", boom)
    monkeypatch.setenv("SMTP_HOST", "smtp.hostinger.com")
    assert mailer.send_plan_email("a@b.com", "https://x") is False


def test_saving_a_plan_still_works_if_email_fails(client, monkeypatch):
    def boom(*a, **k): raise OSError("down")
    monkeypatch.setattr(mailer.smtplib, "SMTP_SSL", boom)
    monkeypatch.setenv("SMTP_HOST", "smtp.hostinger.com")
    assert client.post("/api/plans", json=make_body()).status_code == 201


# ---------- serving the built frontend (optional) ----------
def test_serves_frontend_when_configured(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<h1>app</h1>")
    (dist / "privacy.html").write_text("<h1>privacy</h1>")
    (dist / "secret.txt").write_text("nope")
    monkeypatch.setenv("CLOSA_STATIC_DIR", str(dist))
    import importlib
    monkeypatch.setenv("CLOSA_DB", str(tmp_path / "s.db"))
    fresh = importlib.reload(main)
    try:
        with TestClient(fresh.app) as c:
            assert "app" in c.get("/").text
            assert "app" in c.get("/plan/abcdefghijklmnop").text  # SPA fallback
            assert "privacy" in c.get("/privacy").text
            assert c.get("/api/health").json() == {"status": "ok"}
            assert c.get("/api/nope").status_code == 404
            # files outside the dist folder are never served
            assert "nope" not in c.get("/%2e%2e/secret.txt").text
            assert "nope" not in c.get("/..%2fsecret.txt").text
    finally:
        monkeypatch.delenv("CLOSA_STATIC_DIR")
        importlib.reload(main)
