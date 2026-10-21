import json
import socketserver
import sqlite3
import subprocess
import threading
from pathlib import Path

import pytest

API_DIR = Path(__file__).resolve().parent.parent
REPO = API_DIR.parent
VALID_ANSWERS = {"Q0": ["none"], "Q1": ["less_pain", "lighter_periods"], "Q2": "20_34", "Q3": "no", "Q16": "trying_now", "T1": "lt6m"}


def make_body(**over):
    body = {"email": "Ada@Example.com", "consent": True, "ttc_consent": False, "answers": dict(VALID_ANSWERS)}
    body.update(over)
    return body


def rows(server, sql):
    with sqlite3.connect(server.db) as conn:
        return conn.execute(sql).fetchall()


# ---------- health ----------
def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_unknown_route_404(client):
    assert client.get("/api/nope").status_code == 404
    assert client.get("/api/plans").status_code == 404  # listing plans is not a thing


def test_wrong_method_on_plan_405(client):
    token = client.post("/api/plans", json=make_body()).json()["token"]
    assert client.put(f"/api/plans/{token}").status_code == 405


# ---------- POST /api/plans ----------
def test_create_plan_returns_token(client):
    r = client.post("/api/plans", json=make_body())
    assert r.status_code == 201
    assert len(r.json()["token"]) >= 20


def test_tokens_are_unique_and_url_safe(client):
    tokens = {client.post("/api/plans", json=make_body()).json()["token"] for _ in range(5)}
    assert len(tokens) == 5
    assert all(t.replace("-", "").replace("_", "").isalnum() for t in tokens)


def test_create_plan_lowercases_email_and_emails_the_link(client, server):
    token = client.post("/api/plans", json=make_body()).json()["token"]
    mail = server.emails()
    assert len(mail) == 1
    assert mail[0]["to"] == "ada@example.com"
    assert mail[0]["link"] == f"https://closahealth.com/plan/{token}"
    assert "not a diagnosis" in mail[0]["body"]
    assert client.get(f"/api/plans/{token}").json()["email"] == "ada@example.com"


def test_email_link_ignores_the_host_header(client, server):
    # A forged Host header must not be able to point the emailed link somewhere else.
    client.post("/api/plans", json=make_body(), headers={"Host": "evil.example"})
    assert server.emails()[0]["link"].startswith("https://closahealth.com/plan/")


@pytest.mark.parametrize("email", ["", "nope", "a@b", "a b@c.com", "x" * 250 + "@a.com", "a@b.com\r\nBcc: x@y.com", None, 5, ["a@b.com"]])
def test_create_plan_rejects_bad_email(client, email):
    assert client.post("/api/plans", json=make_body(email=email)).status_code == 422


def test_create_plan_requires_consent(client):
    assert client.post("/api/plans", json=make_body(consent=False)).status_code == 422
    assert client.post("/api/plans", json=make_body(consent="true")).status_code == 422
    body = make_body()
    del body["consent"]
    assert client.post("/api/plans", json=body).status_code == 422


@pytest.mark.parametrize(
    "answers",
    [
        {},
        {"Q2": "20_34"},  # no Q1 concerns
        {"Q1": []},
        {"Q1": ["less_pain"], "Q99": "x"},  # unknown question
        {"Q1": ["made_up"]},  # unknown option
        {"Q1": "less_pain"},  # multi question given a string
        {"Q1": ["less_pain"], "Q2": ["20_34"]},  # single question given a list
        {"Q1": ["less_pain"], "Q2": "not_an_age"},
        {"Q1": [["less_pain"]]},
        {"Q1": ["less_pain"], "Q2": 5},
        "less_pain",
        None,
    ],
)
def test_create_plan_rejects_bad_answers(client, answers):
    assert client.post("/api/plans", json=make_body(answers=answers)).status_code == 422


def test_create_plan_rejects_non_json(client):
    assert client.post("/api/plans", content="not json", headers={"Content-Type": "application/json"}).status_code == 422
    assert client.post("/api/plans", content="[1,2]", headers={"Content-Type": "application/json"}).status_code == 422


def test_create_plan_removes_duplicate_options(client):
    token = client.post("/api/plans", json=make_body(answers={"Q1": ["less_pain", "less_pain", "lighter_periods"]})).json()["token"]
    assert client.get(f"/api/plans/{token}").json()["answers"]["Q1"] == ["less_pain", "lighter_periods"]


def test_pregnancy_plans_not_stored_without_extra_consent(client, server):
    token = client.post("/api/plans", json=make_body(ttc_consent=False)).json()["token"]
    answers = client.get(f"/api/plans/{token}").json()["answers"]
    assert "Q16" not in answers and "T1" not in answers
    assert answers["Q1"] == ["less_pain", "lighter_periods"]  # everything else is kept
    # really gone from the database, not just hidden
    stored, saved = rows(server, "SELECT answers, ttc_saved FROM plans")[0]
    assert "trying_now" not in stored and saved == 0


def test_pregnancy_plans_stored_with_extra_consent(client):
    token = client.post("/api/plans", json=make_body(ttc_consent=True)).json()["token"]
    answers = client.get(f"/api/plans/{token}").json()["answers"]
    assert answers["Q16"] == "trying_now" and answers["T1"] == "lt6m"


def test_ttc_consent_must_be_a_boolean(client):
    assert client.post("/api/plans", json=make_body(ttc_consent="yes")).status_code == 422


def test_create_plan_rate_limited(client):
    for _ in range(10):
        assert client.post("/api/plans", json=make_body()).status_code == 201
    assert client.post("/api/plans", json=make_body()).status_code == 429


def test_invalid_requests_do_not_use_up_rate_limit(client):
    for _ in range(12):
        assert client.post("/api/plans", json=make_body(email="bad")).status_code == 422
    assert client.post("/api/plans", json=make_body()).status_code == 201


def test_rate_limit_forgets_old_hits(client, server):
    for _ in range(10):
        client.post("/api/plans", json=make_body())
    assert client.post("/api/plans", json=make_body()).status_code == 429
    with sqlite3.connect(server.db) as conn:
        conn.execute("UPDATE rate_hits SET at = at - 4000")
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
    t1 = client.post("/api/plans", json=make_body(email="one@example.com", answers={"Q1": ["less_pain"]})).json()["token"]
    t2 = client.post("/api/plans", json=make_body(email="two@example.com", answers={"Q1": ["lighter_periods"]})).json()["token"]
    assert t1 != t2
    a, b = client.get(f"/api/plans/{t1}").json(), client.get(f"/api/plans/{t2}").json()
    assert (a["email"], a["answers"]["Q1"]) == ("one@example.com", ["less_pain"])
    assert (b["email"], b["answers"]["Q1"]) == ("two@example.com", ["lighter_periods"])
    # neither an email address nor a numeric id opens a plan
    assert client.get("/api/plans/one@example.com").status_code == 404
    assert client.get("/api/plans/1").status_code == 404


def test_sql_injection_in_token_is_harmless(client):
    client.post("/api/plans", json=make_body())
    assert client.get("/api/plans/x' OR '1'='1").status_code == 404
    assert client.get("/api/plans/%27%20OR%20%271%27=%271").status_code == 404


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


def test_providers_fall_back_to_general_hospitals(make_server, tmp_path):
    # A tiny directory: Abuja has a general hospital but nothing dedicated to fertility.
    small = tmp_path / "small.json"
    small.write_text(json.dumps([
        {"city": "Abuja", "name": "Garki Hospital", "kind": "Hospital", "area": "Garki", "address": "Area 3", "cats": ["gp", "lab"], "note": ""},
        {"city": "Abuja", "name": "Some Fertility Place", "kind": "Clinic", "area": "Jabi", "address": "Jabi", "cats": ["fert"], "note": ""},
        {"city": "Lagos", "name": "Lagos Fertility", "kind": "Clinic", "area": "Ikoyi", "address": "Ikoyi", "cats": ["fert"], "note": ""},
    ]))
    s = make_server({"CLOSA_PROVIDERS_FILE": str(small)})
    # a category with a listing: no fallback
    body = s.client.get("/api/providers", params={"city": "Abuja", "cat": "fert"}).json()
    assert body["fallback"] is False and [p["name"] for p in body["providers"]] == ["Some Fertility Place"]
    # a category with none: the city's general hospitals, never another city's
    body = s.client.get("/api/providers", params={"city": "Abuja", "cat": "haem"}).json()
    assert body["fallback"] is True
    assert [p["name"] for p in body["providers"]] == ["Garki Hospital"]
    # a city with no general hospital at all: empty, but still a valid answer
    body = s.client.get("/api/providers", params={"city": "Lagos", "cat": "gp"}).json()
    assert body == {"providers": [], "fallback": True}


def test_every_city_and_category_returns_something(client):
    for city in ["Lagos", "Abuja", "Port Harcourt", "Oyo State"]:
        for cat in ["gp", "gyn", "lab", "haem", "fp", "fert"]:
            assert client.get("/api/providers", params={"city": city, "cat": cat}).json()["providers"], (city, cat)


@pytest.mark.parametrize("params", [{"city": "Paris", "cat": "gp"}, {"city": "Lagos", "cat": "dentist"}])
def test_providers_unknown_values_422(client, params):
    assert client.get("/api/providers", params=params).status_code == 422


@pytest.mark.parametrize("params", [{}, {"city": "Lagos"}, {"cat": "gp"}])
def test_providers_missing_params_422(client, params):
    assert client.get("/api/providers", params=params).status_code == 422


def test_providers_data_file_is_valid():
    entries = json.loads((API_DIR / "data" / "providers.json").read_text())
    assert len(entries) == 33
    for e in entries:
        assert e["city"] in ["Lagos", "Abuja", "Port Harcourt", "Oyo State"]
        assert e["cats"] and set(e["cats"]) <= {"gp", "gyn", "lab", "haem", "fp", "fert"}
        assert e["name"] and e["address"]


# ---------- POST /api/events ----------
def test_record_event(client, server):
    r = client.post("/api/events", json={"name": "plan_action", "category": "gyn", "source": "who", "token": "abc"})
    assert r.status_code == 204
    assert rows(server, "SELECT name, category, source, has_plan FROM events") == [("plan_action", "gyn", "who", 1)]


def test_event_without_optional_fields(client, server):
    assert client.post("/api/events", json={"name": "directions_tap", "city": "Lagos", "category": "lab"}).status_code == 204
    assert rows(server, "SELECT has_plan FROM events") == [(0,)]


def test_event_does_not_store_the_token(client, server):
    client.post("/api/events", json={"name": "plan_action", "token": "secret-token-value"})
    with sqlite3.connect(server.db) as conn:
        dump = "".join(conn.iterdump())
    assert "secret-token-value" not in dump


@pytest.mark.parametrize(
    "body",
    [{}, {"name": "hack"}, {"name": "plan_action", "category": "nope"}, {"name": "directions_tap", "city": "Mars"}, {"name": 5}, {"name": "plan_action", "source": 7}],
)
def test_event_validation_422(client, body):
    assert client.post("/api/events", json=body).status_code == 422


def test_event_source_is_truncated(client, server):
    client.post("/api/events", json={"name": "plan_action", "source": "x" * 500})
    assert len(rows(server, "SELECT source FROM events")[0][0]) == 60


# ---------- database ----------
def test_database_is_created_automatically(server, client):
    client.get("/api/providers", params={"city": "Lagos", "cat": "gp"})  # providers don't need the database
    client.post("/api/plans", json=make_body())
    tables = {r[0] for r in rows(server, "SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"plans", "events", "rate_hits"} <= tables


def test_existing_database_keeps_its_plans_across_restarts(make_server):
    import httpx

    s1 = make_server({})
    token = s1.client.post("/api/plans", json=make_body()).json()["token"]
    s1.stop()
    s1.proc.wait()
    # a second server on the same database file (what happens on every deploy)
    s2 = make_server({"CLOSA_DB": str(s1.db)})
    assert s2.client.get(f"/api/plans/{token}").status_code == 200


# ---------- the answer list stays in step with the frontend ----------
def test_schema_matches_frontend_questions():
    out = subprocess.run(
        ["node", "-e", "import('./scripts/export_schema.mjs').then(m => console.log(JSON.stringify(m.buildSchema())))"],
        cwd=REPO, capture_output=True, text=True,
    )
    if out.returncode != 0:
        pytest.skip("node is not available")
    assert json.loads(out.stdout) == json.loads((API_DIR / "data" / "questions_schema.json").read_text())


# ---------- email over SMTP ----------
class FakeSMTP:
    """Speaks just enough SMTP to check what our client sends."""

    def __init__(self, fail_auth=False):
        self.log = []
        outer = self

        class Handler(socketserver.StreamRequestHandler):
            def handle(self):
                w = lambda s: (self.wfile.write((s + "\r\n").encode()), self.wfile.flush())
                w("220 fake ready")
                data_mode = False
                body = []
                state = {}
                while True:
                    line = self.rfile.readline()
                    if not line:
                        return
                    text = line.decode().rstrip("\r\n")
                    if data_mode:
                        if text == ".":
                            outer.log.append(("DATA", "\n".join(body)))
                            data_mode = False
                            w("250 queued")
                        else:
                            body.append(text)
                        continue
                    outer.log.append(("CMD", text))
                    cmd = text.upper()
                    if cmd.startswith("EHLO"):
                        w("250-fake")
                        w("250 AUTH LOGIN")
                    elif cmd == "AUTH LOGIN":
                        w("334 VXNlcm5hbWU6")
                    elif state.get("user") is None and not cmd.startswith(("MAIL", "RCPT", "DATA", "QUIT")) and "AUTH LOGIN" in [c[1].upper() for c in outer.log]:
                        state["user"] = text
                        w("334 UGFzc3dvcmQ6")
                    elif state.get("user") is not None and "pw" not in state and not cmd.startswith(("MAIL", "RCPT", "DATA", "QUIT")):
                        state["pw"] = text
                        w("535 bad login" if fail_auth else "235 ok")
                    elif cmd.startswith("MAIL FROM") or cmd.startswith("RCPT TO"):
                        w("250 ok")
                    elif cmd == "DATA":
                        data_mode = True
                        w("354 go")
                    elif cmd == "QUIT":
                        w("221 bye")
                        return

        self.server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()


def test_email_is_sent_over_smtp(make_server):
    fake = FakeSMTP()
    try:
        s = make_server({"CLOSA_MAIL_TRANSPORT": "smtp", "CLOSA_SMTP_HOST": "127.0.0.1", "CLOSA_SMTP_PORT": str(fake.port),
                         "CLOSA_SMTP_SECURE": "none", "CLOSA_SMTP_USER": "hello@closahealth.com", "CLOSA_SMTP_PASSWORD": "pw"})
        token = s.client.post("/api/plans", json=make_body()).json()["token"]
    finally:
        fake.close()
    cmds = [c[1] for c in fake.log if c[0] == "CMD"]
    assert "MAIL FROM:<hello@closahealth.com>" in cmds
    assert "RCPT TO:<ada@example.com>" in cmds
    data = [c[1] for c in fake.log if c[0] == "DATA"][0]
    assert "Subject: Your Closa Health care plan" in data
    assert f"https://closahealth.com/plan/{token}" in data
    assert "To: ada@example.com" in data


def test_saving_a_plan_still_works_if_smtp_login_fails(make_server):
    fake = FakeSMTP(fail_auth=True)
    try:
        s = make_server({"CLOSA_MAIL_TRANSPORT": "smtp", "CLOSA_SMTP_HOST": "127.0.0.1", "CLOSA_SMTP_PORT": str(fake.port),
                         "CLOSA_SMTP_SECURE": "none", "CLOSA_SMTP_USER": "u", "CLOSA_SMTP_PASSWORD": "wrong"})
        r = s.client.post("/api/plans", json=make_body())
    finally:
        fake.close()
    assert r.status_code == 201
    assert s.client.get(f"/api/plans/{r.json()['token']}").status_code == 200


def test_saving_a_plan_still_works_if_the_mail_server_is_down(make_server):
    s = make_server({"CLOSA_MAIL_TRANSPORT": "smtp", "CLOSA_SMTP_HOST": "127.0.0.1", "CLOSA_SMTP_PORT": "1", "CLOSA_SMTP_SECURE": "none"})
    assert s.client.post("/api/plans", json=make_body()).status_code == 201
