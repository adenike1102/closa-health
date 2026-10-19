"""Tests for the name/opt-in fields, tracking events, deletion markers and the dashboard."""
import base64
import hashlib
import hmac
import json
import sqlite3
import time

import httpx
import pytest

ADMIN_PW = "dash-pass-1"
CONTACTS_PW = "contacts-pass-2"
H = {"X-Closa-Admin": "1"}  # header the dashboard adds to every change request
ANSWERS = {"Q1": ["pain", "heavy"], "Q2": "20_34", "Q5": "regular", "Q10": "severe", "Q14": ["none"], "Q16": "trying_now"}
OUTCOME = {"urgency": 4, "flags": ["F-HMB", "F-ENDO"], "who": ["gp", "gyn"], "tests": ["T-FBC"], "safety": []}


def body(**over):
    b = {"email": "ada@example.com", "consent": True, "answers": dict(ANSWERS)}
    b.update(over)
    return b


def db(server):
    return sqlite3.connect(server.db)


@pytest.fixture()
def admin(make_server):
    """A server with both dashboard passwords set."""
    return make_server({"CLOSA_ADMIN_PASSWORD": ADMIN_PW, "CLOSA_CONTACTS_PASSWORD": CONTACTS_PW})


def login(admin_server, password=ADMIN_PW):
    return admin_server.client.post("/api/admin/login", json={"password": password}, headers=H)


def unlock(admin_server, password=CONTACTS_PW):
    return admin_server.client.post("/api/admin/contacts/unlock", json={"password": password}, headers=H)


def token(level, ttl, admin_pw=ADMIN_PW, contacts_pw=CONTACTS_PW):
    """Makes a signed cookie the way the server does (used to test expiry and tampering)."""
    key = hashlib.sha256(f"closa|{admin_pw}|{contacts_pw}".encode()).hexdigest().encode()
    # the server signs with: 'closa|' . plain . hash(''), '|' , plain . hash('')
    key = hashlib.sha256(("closa|" + admin_pw + "" + "|" + contacts_pw + "").encode()).hexdigest().encode()
    payload = base64.urlsafe_b64encode(json.dumps({"l": level, "e": int(time.time()) + ttl}, separators=(",", ":")).encode()).rstrip(b"=")
    return payload.decode() + "." + hmac.new(key, payload, hashlib.sha256).hexdigest()


def add_event(server, name, sid, when="2026-10-10T12:00:00+00:00", **cols):
    c = db(server)
    keys = ["name", "sid", "created_at", *cols]
    c.execute(f"INSERT INTO events ({','.join(keys)}) VALUES ({','.join('?' * len(keys))})", [name, sid, when, *cols.values()])
    c.commit()
    c.close()


# =================== plan: name + opt-in ===================
def test_name_is_saved_and_returned(client, server):
    tok = client.post("/api/plans", json=body(name="  Ada   Obi ")).json()["token"]
    assert client.get(f"/api/plans/{tok}").json()["name"] == "Ada Obi"


def test_name_is_optional(client):
    for extra in ({}, {"name": ""}, {"name": "   "}, {"name": None}):
        tok = client.post("/api/plans", json=body(**extra)).json()["token"]
        assert client.get(f"/api/plans/{tok}").json()["name"] is None


def test_name_strips_control_characters(client):
    tok = client.post("/api/plans", json=body(name="Ada\r\nBcc: x@y.com")).json()["token"]
    assert "\n" not in client.get(f"/api/plans/{tok}").json()["name"]


@pytest.mark.parametrize("bad", ["x" * 61, 5, ["Ada"], {"a": 1}])
def test_name_validation_422(client, bad):
    assert client.post("/api/plans", json=body(name=bad)).status_code == 422


def test_name_appears_in_email_and_is_escaped(client, server):
    client.post("/api/plans", json=body(name="Ada <b>"))
    mail = server.emails()[0]
    assert "Hello Ada <b>," in mail["body"] and "Hello Ada &lt;b&gt;," in mail["body"]
    client.post("/api/plans", json=body(email="b@example.com"))
    assert "Hello,\r\n" in server.emails()[1]["body"]


def test_launch_optin_default_false_and_saved(client, server):
    client.post("/api/plans", json=body())
    client.post("/api/plans", json=body(launch_optin=True))
    assert db(server).execute("SELECT launch_optin FROM plans ORDER BY id").fetchall() == [(0,), (1,)]


@pytest.mark.parametrize("bad", ["yes", 1, "true", []])
def test_launch_optin_must_be_boolean(client, bad):
    assert client.post("/api/plans", json=body(launch_optin=bad)).status_code == 422


def test_mail_status_recorded(client, server, make_server):
    client.post("/api/plans", json=body())
    assert db(server).execute("SELECT mail_status FROM plans").fetchone() == ("sent",)
    down = make_server({"CLOSA_MAIL_TRANSPORT": "smtp", "CLOSA_SMTP_HOST": "127.0.0.1", "CLOSA_SMTP_PORT": "1", "CLOSA_SMTP_SECURE": "none"})
    down.client.post("/api/plans", json=body())
    assert db(down).execute("SELECT mail_status FROM plans ORDER BY id DESC").fetchone() == ("failed",)


# =================== anonymous plan summary ===================
def test_plan_summary_is_anonymous_and_coarse(client, server):
    client.post("/api/plans", json=body(ttc_consent=True, outcome=OUTCOME, name="Ada", launch_optin=True))
    cols = [r[1] for r in db(server).execute("PRAGMA table_info(plan_stats)")]
    assert not {"email", "name", "token", "plan_id", "answers"} & set(cols)
    r = db(server).execute("SELECT age, concerns, cycle, pain, ttc, urgency, flags, who FROM plan_stats").fetchone()
    assert r == ("20_34", '["pain","heavy"]', "regular", "severe", "trying_now", 4, '["F-HMB","F-ENDO"]', '["gp","gyn"]')


def test_plan_summary_leaves_out_pregnancy_plans_without_consent(client, server):
    client.post("/api/plans", json=body(ttc_consent=False, outcome=OUTCOME))
    assert db(server).execute("SELECT ttc FROM plan_stats").fetchone() == (None,)


@pytest.mark.parametrize(
    "outcome",
    [None, "x", {}, {"urgency": 9}, {"urgency": "4"}, {"urgency": 0}, [1, 2]],
)
def test_bad_outcome_never_stops_a_plan_being_saved(client, server, outcome):
    assert client.post("/api/plans", json=body(outcome=outcome)).status_code == 201
    assert db(server).execute("SELECT urgency FROM plan_stats").fetchone() == (None,)


def test_outcome_keeps_only_known_values(client, server):
    o = {"urgency": 3, "flags": ["F-HMB", "<script>", "F-" + "X" * 30], "who": ["gp", "hack"], "tests": ["T-FBC", "nope"], "safety": ["none", "s2_sudden_pain", "bad"]}
    client.post("/api/plans", json=body(outcome=o))
    r = db(server).execute("SELECT flags, who, tests, safety FROM plan_stats").fetchone()
    assert r == ('["F-HMB"]', '["gp"]', '["T-FBC"]', '["s2_sudden_pain"]')


def test_plan_created_event_records_the_visitor_code(client, server):
    client.post("/api/plans", json=body(sid="abcdef123456XYZ"))
    assert db(server).execute("SELECT name, sid FROM events WHERE name = 'plan_created'").fetchall() == [("plan_created", "abcdef123456XYZ")]


def test_bad_visitor_code_is_ignored(client, server):
    assert client.post("/api/plans", json=body(sid="short!")).status_code == 201
    assert db(server).execute("SELECT sid FROM events WHERE name = 'plan_created'").fetchone() == (None,)


# =================== deleting keeps only a marker ===================
def test_delete_wipes_personal_data_but_keeps_a_marker(client, server):
    tok = client.post("/api/plans", json=body(name="Ada", launch_optin=True, ttc_consent=True, outcome=OUTCOME)).json()["token"]
    assert client.delete(f"/api/plans/{tok}").status_code == 204
    row = db(server).execute("SELECT email, name, answers, launch_optin, ttc_saved, token, deleted_at, created_at FROM plans").fetchone()
    assert row[:5] == ("", None, "{}", 0, 0) and row[5] != tok and row[6] and row[7]
    assert client.get(f"/api/plans/{tok}").status_code == 404
    dump = "".join(db(server).iterdump())
    assert "ada@example.com" not in dump and "Ada" not in dump.replace("Admin", "")


def test_delete_keeps_the_anonymous_summary_and_logs_an_event(client, server):
    tok = client.post("/api/plans", json=body(outcome=OUTCOME)).json()["token"]
    client.delete(f"/api/plans/{tok}")
    assert db(server).execute("SELECT COUNT(*) FROM plan_stats").fetchone() == (1,)
    assert db(server).execute("SELECT COUNT(*) FROM events WHERE name = 'plan_delete'").fetchone() == (1,)


# =================== upgrading an older database ===================
def test_old_database_is_upgraded_without_losing_plans(make_server, tmp_path):
    old = tmp_path / "old.db"
    c = sqlite3.connect(old)
    c.executescript(
        """CREATE TABLE plans (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL UNIQUE, email TEXT NOT NULL,
               answers TEXT NOT NULL, ttc_saved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
           CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT, source TEXT,
               city TEXT, has_plan INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
           INSERT INTO plans (token, email, answers, created_at) VALUES ('oldtoken123456789', 'old@example.com',
               '{"Q1":["heavy"],"Q2":"35_39"}', '2026-10-01T10:00:00+00:00');
           INSERT INTO events (name, category, created_at) VALUES ('plan_action', 'gyn', '2026-10-01T10:00:00+00:00');"""
    )
    c.commit()
    c.close()
    s = make_server({"CLOSA_DB": str(old)})
    r = s.client.get("/api/plans/oldtoken123456789")
    assert r.status_code == 200 and r.json()["email"] == "old@example.com" and r.json()["name"] is None
    cols = {x[1] for x in sqlite3.connect(old).execute("PRAGMA table_info(plans)")}
    assert {"name", "launch_optin", "deleted_at", "mail_status"} <= cols
    assert sqlite3.connect(old).execute("SELECT age, concerns FROM plan_stats").fetchall() == [("35_39", '["heavy"]')]  # backfilled
    assert sqlite3.connect(old).execute("SELECT COUNT(*) FROM events").fetchone() == (1,)
    assert s.client.post("/api/plans", json=body()).status_code == 201  # and it still works afterwards


# =================== tracking events ===================
def test_tracking_event_stores_attribution(client, server):
    r = client.post("/api/events", json={"name": "session_start", "sid": "abcdef123456XYZ", "device": "m", "utm_source": "instagram",
                                         "utm_medium": "paid", "utm_campaign": "launch", "referrer": "l.instagram.com"})
    assert r.status_code == 204
    row = db(server).execute("SELECT sid, device, utm_source, utm_medium, utm_campaign, referrer FROM events").fetchone()
    assert row == ("abcdef123456XYZ", "m", "instagram", "paid", "launch", "l.instagram.com")


def test_tracking_tags_are_cleaned(client, server):
    client.post("/api/events", json={"name": "session_start", "sid": "abcdef123456XYZ", "utm_source": "<img src=x>" + "a" * 100})
    got = db(server).execute("SELECT utm_source FROM events").fetchone()[0]
    assert "<" not in got and len(got) <= 60


def test_a_visit_is_counted_once_per_visitor_code(client, server):
    for _ in range(3):
        client.post("/api/events", json={"name": "session_start", "sid": "abcdef123456XYZ"})
    assert db(server).execute("SELECT COUNT(*) FROM events WHERE name = 'session_start'").fetchone() == (1,)


@pytest.mark.parametrize("name", ["session_start", "cta_click", "symptom_pick", "question_view", "safety_screen", "csv_upload",
                                  "email_view", "plan_view", "provider_view", "checklist_tick", "summary_copy", "summary_print"])
def test_every_tracking_event_is_accepted(client, name):
    assert client.post("/api/events", json={"name": name, "sid": "abcdef123456XYZ", "step": "Q1"}).status_code == 204


@pytest.mark.parametrize("b", [
    {"name": "plan_created"}, {"name": "plan_delete"},                   # only the server may record these
    {"name": "question_view", "step": "Q1; DROP"}, {"name": "question_view", "step": "x" * 17},
    {"name": "session_start", "device": "phone"}, {"name": "session_start", "device": 3},
])
def test_bad_tracking_events_422(client, b):
    assert client.post("/api/events", json=b).status_code == 422


def test_tracking_is_rate_limited(client):
    codes = {client.post("/api/events", json={"name": "cta_click"}).status_code for _ in range(603)}
    assert codes == {204, 429}


# =================== dashboard: signing in ===================
def test_dashboard_is_off_until_passwords_are_set(client):
    assert client.post("/api/admin/login", json={"password": "x"}, headers=H).status_code == 503
    assert client.get("/api/admin/stats").status_code == 503
    assert client.get("/api/admin/contacts").status_code == 503


def test_one_password_missing_keeps_it_off(make_server):
    s = make_server({"CLOSA_ADMIN_PASSWORD": ADMIN_PW})
    assert s.client.post("/api/admin/login", json={"password": ADMIN_PW}, headers=H).status_code == 503


def test_stats_need_a_login(admin):
    assert admin.client.get("/api/admin/stats").status_code == 401
    assert admin.client.get("/api/admin/session").status_code == 401


def test_wrong_password_rejected(admin):
    r = login(admin, "nope")
    assert r.status_code == 401 and "set-cookie" not in r.headers


def test_login_needs_the_custom_header(admin):
    assert admin.client.post("/api/admin/login", json={"password": ADMIN_PW}).status_code == 403


def test_login_then_stats_and_logout(admin):
    r = login(admin)
    assert r.status_code == 200
    cookie = r.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=Strict" in cookie and "path=/api/admin" in cookie.lower()
    assert admin.client.get("/api/admin/stats").status_code == 200
    assert admin.client.get("/api/admin/session").json() == {"ok": True, "contacts_unlocked": False}
    assert admin.client.post("/api/admin/logout", headers=H).status_code == 204
    assert admin.client.get("/api/admin/stats").status_code == 401


def test_login_locks_out_after_six_wrong_guesses(admin):
    for _ in range(6):
        assert login(admin, "wrong").status_code == 401
    assert login(admin, ADMIN_PW).status_code == 429  # even the right password waits
    assert admin.client.get("/api/admin/stats").status_code == 401


def test_cookies_that_are_tampered_or_expired_are_refused(admin):
    good = token("admin", 600)
    assert httpx.get(f"http://127.0.0.1:{admin.port}/api/admin/stats", cookies={"closa_admin": good}).status_code == 200
    for bad in [good[:-3] + "abc", "x." + good.split(".")[1], good.split(".")[0], token("admin", -5), token("contacts", 600),
                token("admin", 600, admin_pw="other")]:
        r = httpx.get(f"http://127.0.0.1:{admin.port}/api/admin/stats", cookies={"closa_admin": bad})
        assert r.status_code == 401, bad


def test_changing_a_password_logs_everyone_out(make_server):
    a = make_server({"CLOSA_ADMIN_PASSWORD": "old-one", "CLOSA_CONTACTS_PASSWORD": CONTACTS_PW})
    cookie = token("admin", 600, admin_pw="old-one")
    assert httpx.get(f"http://127.0.0.1:{a.port}/api/admin/stats", cookies={"closa_admin": cookie}).status_code == 200
    b = make_server({"CLOSA_ADMIN_PASSWORD": "new-one", "CLOSA_CONTACTS_PASSWORD": CONTACTS_PW})
    assert httpx.get(f"http://127.0.0.1:{b.port}/api/admin/stats", cookies={"closa_admin": cookie}).status_code == 401


def test_hashed_passwords_work(make_server):
    import subprocess

    def hashed(pw):
        return subprocess.run(["php", "-r", f"echo password_hash('{pw}', PASSWORD_DEFAULT);"], capture_output=True, text=True).stdout

    s = make_server({"CLOSA_ADMIN_PASSWORD_HASH": hashed("hash-one"), "CLOSA_CONTACTS_PASSWORD_HASH": hashed("hash-two")})
    assert s.client.post("/api/admin/login", json={"password": "wrong"}, headers=H).status_code == 401
    assert s.client.post("/api/admin/login", json={"password": "hash-one"}, headers=H).status_code == 200
    assert s.client.post("/api/admin/contacts/unlock", json={"password": "hash-one"}, headers=H).status_code == 401
    assert s.client.post("/api/admin/contacts/unlock", json={"password": "hash-two"}, headers=H).status_code == 200
    assert s.client.get("/api/admin/contacts").status_code == 200


# =================== dashboard: contacts need the second password ===================
def seed_contacts(admin):
    c = admin.client
    c.post("/api/plans", json=body(email="optin@example.com", name="Opt In", launch_optin=True))
    c.post("/api/plans", json=body(email="noopt@example.com", name="No Opt"))
    c.post("/api/plans", json=body(email="=cmd@example.com", name="=HYPERLINK(1)", launch_optin=True))
    gone = c.post("/api/plans", json=body(email="gone@example.com", launch_optin=True)).json()["token"]
    c.delete(f"/api/plans/{gone}")


def test_contacts_are_locked_after_first_login(admin):
    login(admin)
    assert admin.client.get("/api/admin/contacts").status_code == 403
    assert admin.client.get("/api/admin/contacts.csv").status_code == 403
    assert admin.client.delete("/api/admin/contacts/1", headers=H).status_code == 403


def test_contacts_need_the_admin_login_too(admin):
    assert unlock(admin).status_code == 401  # not signed in


def test_wrong_contacts_password_rejected_and_locked_out(admin):
    login(admin)
    for _ in range(6):
        assert unlock(admin, "wrong").status_code == 401
    assert unlock(admin, CONTACTS_PW).status_code == 429
    assert admin.client.get("/api/admin/contacts").status_code == 403


def test_dashboard_password_does_not_open_contacts(admin):
    login(admin)
    assert unlock(admin, ADMIN_PW).status_code == 401


def test_contacts_list_after_unlock(admin):
    seed_contacts(admin)
    login(admin)
    assert unlock(admin).status_code == 200
    assert admin.client.get("/api/admin/session").json()["contacts_unlocked"] is True
    rows = admin.client.get("/api/admin/contacts").json()["contacts"]
    active = [r for r in rows if r["status"] == "active"]
    assert {r["email"] for r in active} == {"optin@example.com", "noopt@example.com", "=cmd@example.com"}
    deleted = [r for r in rows if r["status"] == "deleted"]
    assert len(deleted) == 1 and deleted[0]["email"] is None and deleted[0]["name"] is None and deleted[0]["deleted_at"]
    assert deleted[0]["launch_optin"] is False


def test_contacts_filter_and_search(admin):
    seed_contacts(admin)
    login(admin)
    unlock(admin)
    opt = admin.client.get("/api/admin/contacts", params={"optin": "1"}).json()["contacts"]
    assert {r["email"] for r in opt} == {"optin@example.com", "=cmd@example.com"}  # no deleted, no non-opt-in
    found = admin.client.get("/api/admin/contacts", params={"q": "noopt"}).json()["contacts"]
    assert [r["email"] for r in found] == ["noopt@example.com"]
    assert admin.client.get("/api/admin/contacts", params={"q": "%"}).json()["contacts"] == []  # % is not a wildcard


def test_launch_list_csv_only_has_opted_in_active_people(admin):
    seed_contacts(admin)
    login(admin)
    unlock(admin)
    r = admin.client.get("/api/admin/contacts.csv")
    assert r.headers["content-type"].startswith("text/csv") and "attachment" in r.headers["content-disposition"]
    text = r.text
    assert text.splitlines()[0] == "name,email,joined"
    assert "optin@example.com" in text
    assert "noopt@example.com" not in text and "gone@example.com" not in text


def test_csv_defuses_spreadsheet_formulas(admin):
    seed_contacts(admin)
    login(admin)
    unlock(admin)
    text = admin.client.get("/api/admin/contacts.csv").text
    assert '"\'=HYPERLINK(1)"' in text and '"\'=cmd@example.com"' in text


def test_contacts_unlock_expires(admin):
    seed_contacts(admin)
    cookies = {"closa_admin": token("admin", 600), "closa_contacts": token("contacts", -1)}
    assert httpx.get(f"http://127.0.0.1:{admin.port}/api/admin/contacts", cookies=cookies).status_code == 403
    cookies["closa_contacts"] = token("contacts", 600)
    assert httpx.get(f"http://127.0.0.1:{admin.port}/api/admin/contacts", cookies=cookies).status_code == 200
    cookies["closa_contacts"] = token("admin", 600)  # an admin cookie is not a contacts cookie
    assert httpx.get(f"http://127.0.0.1:{admin.port}/api/admin/contacts", cookies=cookies).status_code == 403


def test_admin_can_delete_a_contact_on_request(admin):
    seed_contacts(admin)
    login(admin)
    unlock(admin)
    rows = admin.client.get("/api/admin/contacts").json()["contacts"]
    target = next(r for r in rows if r["email"] == "optin@example.com")
    assert admin.client.delete(f"/api/admin/contacts/{target['id']}").status_code == 403  # needs the header
    assert admin.client.delete(f"/api/admin/contacts/{target['id']}", headers=H).status_code == 204
    assert admin.client.delete(f"/api/admin/contacts/{target['id']}", headers=H).status_code == 404
    assert admin.client.delete("/api/admin/contacts/99999", headers=H).status_code == 404
    again = admin.client.get("/api/admin/contacts").json()["contacts"]
    assert next(r for r in again if r["id"] == target["id"])["status"] == "deleted"
    assert "optin@example.com" not in admin.client.get("/api/admin/contacts.csv").text


# =================== dashboard: numbers ===================
def stats(admin, **params):
    login(admin)
    return admin.client.get("/api/admin/stats", params=params)


def test_stats_shape_on_an_empty_database(admin):
    r = stats(admin)
    assert r.status_code == 200
    d = r.json()
    assert d["kpis"]["current"]["visitors"] == 0 and d["kpis"]["current"]["completion"] is None
    assert len(d["series"]) == 30 and d["funnel"][0]["count"] == 0
    assert d["audience"]["enough"] is False and d["care"]["enough"] is False


@pytest.mark.parametrize("params", [{"from": "nope", "to": "2026-10-10"}, {"from": "2026-10-10", "to": "2026-10-01"},
                                    {"from": "2026-02-30", "to": "2026-03-01"}, {"from": "2024-01-01", "to": "2026-01-01"}])
def test_stats_reject_bad_ranges(admin, params):
    assert stats(admin, **params).status_code == 422


def test_days_are_lagos_days(admin):
    admin.client.get("/api/health")
    add_event(admin, "session_start", "visitor00000001", when="2026-10-01T22:59:59+00:00")  # 23:59 Lagos, 1 Oct
    add_event(admin, "session_start", "visitor00000002", when="2026-10-01T23:00:00+00:00")  # 00:00 Lagos, 2 Oct
    d = stats(admin, **{"from": "2026-10-01", "to": "2026-10-02"}).json()
    assert [(x["date"], x["visitors"]) for x in d["series"]] == [("2026-10-01", 1), ("2026-10-02", 1)]
    only_first = stats(admin, **{"from": "2026-10-01", "to": "2026-10-01"}).json()
    assert only_first["kpis"]["current"]["visitors"] == 1


def test_funnel_counts_people_not_events(admin):
    admin.client.get("/api/health")
    for i, sid in enumerate(["aaaaaaaaaaaa", "bbbbbbbbbbbb", "cccccccccccc"]):
        add_event(admin, "session_start", sid)
        add_event(admin, "session_start", sid + "x") if i == 0 else None
    for sid in ["aaaaaaaaaaaa", "bbbbbbbbbbbb"]:
        add_event(admin, "cta_click", sid)
        add_event(admin, "question_view", sid, step="Q0")
        add_event(admin, "question_view", sid, step="Q0")  # seen twice, counted once
    add_event(admin, "question_view", "aaaaaaaaaaaa", step="Q1")
    add_event(admin, "email_view", "aaaaaaaaaaaa")
    add_event(admin, "plan_created", "aaaaaaaaaaaa")
    add_event(admin, "provider_view", "aaaaaaaaaaaa", city="Lagos", category="gyn")
    add_event(admin, "directions_tap", "aaaaaaaaaaaa", city="Lagos", category="gyn")
    d = stats(admin, **{"from": "2026-10-10", "to": "2026-10-10"}).json()
    f = {x["key"]: x["count"] for x in d["funnel"]}
    assert f == {"visit": 4, "cta": 2, "started": 2, "email": 1, "plan": 1, "providers": 1, "directions": 1}
    k = d["kpis"]["current"]
    assert k["completion"] == 0.5 and k["care_intent"] == 1.0
    q = {x["id"]: x["count"] for x in d["questions"]}
    assert q["Q0"] == 2 and q["Q1"] == 1 and q["Q2"] == 0
    assert [x["id"] for x in d["questions"]].index("UP") == [x["id"] for x in d["questions"]].index("Q5") - 1


def test_directions_only_count_towards_the_north_star_if_a_plan_was_made(admin):
    admin.client.get("/api/health")
    add_event(admin, "plan_created", "aaaaaaaaaaaa")
    add_event(admin, "plan_created", "bbbbbbbbbbbb")
    add_event(admin, "directions_tap", "aaaaaaaaaaaa")
    add_event(admin, "directions_tap", "zzzzzzzzzzzz")  # never made a plan in this tab
    k = stats(admin, **{"from": "2026-10-10", "to": "2026-10-10"}).json()["kpis"]["current"]
    assert k["care_intent"] == 0.5


def test_sources_devices_and_conversion(admin):
    admin.client.get("/api/health")
    for sid, kw in [("aaaaaaaaaaaa", dict(utm_source="instagram", utm_medium="paid", utm_campaign="launch", device="m")),
                    ("bbbbbbbbbbbb", dict(utm_source="instagram", utm_medium="paid", utm_campaign="launch", device="m")),
                    ("cccccccccccc", dict(referrer="google.com", device="d")),
                    ("dddddddddddd", dict(device="d"))]:
        add_event(admin, "session_start", sid, **kw)
    add_event(admin, "question_view", "aaaaaaaaaaaa", step="Q0")
    add_event(admin, "plan_created", "aaaaaaaaaaaa")
    d = stats(admin, **{"from": "2026-10-10", "to": "2026-10-10"}).json()
    by = {(s["source"], s["campaign"]): s for s in d["sources"]}
    ig = by[("instagram", "launch")]
    assert (ig["visitors"], ig["started"], ig["plans"], ig["medium"]) == (2, 1, 1, "paid")
    assert by[("google.com", "")]["visitors"] == 1 and by[("direct", "")]["visitors"] == 1
    assert {x["key"]: x["n"] for x in d["devices"]} == {"m": 2, "d": 2}


def test_comparison_with_the_previous_period(admin):
    admin.client.get("/api/health")
    add_event(admin, "session_start", "aaaaaaaaaaaa", when="2026-10-09T12:00:00+00:00")
    add_event(admin, "session_start", "bbbbbbbbbbbb", when="2026-10-10T12:00:00+00:00")
    add_event(admin, "session_start", "cccccccccccc", when="2026-10-10T13:00:00+00:00")
    d = stats(admin, **{"from": "2026-10-10", "to": "2026-10-10"}).json()
    assert d["kpis"]["current"]["visitors"] == 2 and d["kpis"]["previous"]["visitors"] == 1
    assert d["range"]["previous_from"] == "2026-10-09" == d["range"]["previous_to"]


def make_plans(admin, ages):
    for i, age in enumerate(ages):
        admin.client.post("/api/plans", json=body(email=f"p{i}@example.com", answers={**ANSWERS, "Q2": age}, outcome=OUTCOME))


def test_small_groups_are_hidden(admin):
    make_plans(admin, ["20_34"] * 5 + ["35_39"])
    d = stats(admin).json()
    assert d["audience"]["enough"] is True and d["audience"]["n"] == 6
    by = {x["key"]: x for x in d["audience"]["age"]}
    assert by["20_34"]["count"] == 5 and by["20_34"]["small"] is False
    assert by["35_39"]["count"] is None and by["35_39"]["small"] is True  # one person: not shown
    assert d["care"]["flags"][0]["count"] == 6


def test_too_few_plans_shows_no_breakdowns_at_all(admin):
    make_plans(admin, ["20_34"] * 4)
    d = stats(admin).json()
    assert d["audience"]["enough"] is False and d["audience"]["age"] == [] and d["care"]["flags"] == []


def test_care_plan_outcomes(admin):
    make_plans(admin, ["20_34"] * 6)
    d = stats(admin).json()
    assert d["care"]["urgency"][0] == {"key": "4", "count": 6, "small": False}
    assert {x["key"] for x in d["care"]["flags"]} == {"F-HMB", "F-ENDO"}
    assert {x["key"] for x in d["care"]["who"]} == {"gp", "gyn"}


def test_deleted_plans_stay_in_the_numbers_and_are_labelled(admin):
    toks = [admin.client.post("/api/plans", json=body(email=f"p{i}@example.com", outcome=OUTCOME, launch_optin=True)).json()["token"] for i in range(6)]
    for t in toks[:2]:
        admin.client.delete(f"/api/plans/{t}")
    d = stats(admin).json()
    k = d["kpis"]["current"]
    assert k["plans"] == 6                      # plans made does not go down
    assert k["emails_active"] == 4              # people we can still contact does
    assert k["launch_optins"] == 4
    assert k["deleted"] == 2 and d["totals"]["deleted"] == 2 and d["totals"]["active"] == 4
    assert d["audience"]["n"] == 6              # anonymous summaries are kept
    assert d["totals"]["launch_optins"] == 4


def test_health_numbers(admin, make_server):
    for i in range(4):
        admin.client.post("/api/plans", json=body(email=f"p{i}@example.com", launch_optin=i < 2, ttc_consent=i == 0))
    d = stats(admin).json()["health"]
    assert d["mail"] == {"sent": 4, "failed": 0, "pending": 0}
    assert d["launch_optin_rate"] == 0.5 and d["ttc_optin_rate"] == 0.25


def test_failed_emails_raise_an_alert(make_server):
    s = make_server({"CLOSA_ADMIN_PASSWORD": ADMIN_PW, "CLOSA_CONTACTS_PASSWORD": CONTACTS_PW, "CLOSA_MAIL_TRANSPORT": "smtp",
                     "CLOSA_SMTP_HOST": "127.0.0.1", "CLOSA_SMTP_PORT": "1", "CLOSA_SMTP_SECURE": "none"})
    s.client.post("/api/plans", json=body())
    login(s)
    alerts = s.client.get("/api/admin/stats").json()["alerts"]
    assert any("failed to send" in a["text"] for a in alerts)


def test_engagement_and_city_demand(admin):
    admin.client.get("/api/health")
    add_event(admin, "directions_tap", "aaaaaaaaaaaa", city="Abuja", category="gyn")
    add_event(admin, "directions_tap", "bbbbbbbbbbbb", city="Abuja", category="lab")
    add_event(admin, "plan_view", "aaaaaaaaaaaa", source="link")
    add_event(admin, "checklist_tick", "aaaaaaaaaaaa")
    add_event(admin, "checklist_tick", "aaaaaaaaaaaa")
    add_event(admin, "summary_copy", "aaaaaaaaaaaa")
    e = stats(admin, **{"from": "2026-10-10", "to": "2026-10-10"}).json()["engagement"]
    abuja = next(c for c in e["cities"] if c["city"] == "Abuja")
    assert abuja["directions"] == 2 and abuja["listings"] > 0
    assert e["link_opens"] == 1 and e["checklist_ticks"] == 2 and e["checklist_sessions"] == 1 and e["summary_copy"] == 1


def test_stats_never_contain_email_addresses(admin):
    make_plans(admin, ["20_34"] * 6)
    assert "@example.com" not in stats(admin).text
