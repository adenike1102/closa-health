"""Starts the real PHP API with `php -S` for each test, with a throw-away database and mail file.
Tests never touch a real database or send real email."""
import json
import os
import socket
import subprocess
import time
from pathlib import Path

import httpx
import pytest

API_DIR = Path(__file__).resolve().parent.parent


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Server:
    def __init__(self, tmp_path, extra_env=None):
        self.db = tmp_path / "test.db"
        self.mail_file = tmp_path / "mail.jsonl"
        self.port = free_port()
        env = dict(os.environ)
        env.update(
            CLOSA_DB=str(self.db),
            CLOSA_MAIL_TRANSPORT="file",
            CLOSA_MAIL_FILE=str(self.mail_file),
            CLOSA_BASE_URL="https://closahealth.com",
        )
        env.update(extra_env or {})
        self.proc = subprocess.Popen(
            ["php", "-S", f"127.0.0.1:{self.port}", "-t", str(API_DIR), str(API_DIR / "index.php")],
            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        self.client = httpx.Client(base_url=f"http://127.0.0.1:{self.port}", timeout=10)
        for _ in range(100):
            try:
                self.client.get("/api/health")
                return
            except httpx.HTTPError:
                time.sleep(0.05)
        raise RuntimeError("php -S did not start")

    def emails(self):
        if not self.mail_file.exists():
            return []
        return [json.loads(line) for line in self.mail_file.read_text().splitlines()]

    def stop(self):
        self.client.close()
        self.proc.terminate()
        self.proc.wait(timeout=5)


@pytest.fixture()
def server(tmp_path):
    s = Server(tmp_path)
    yield s
    s.stop()


@pytest.fixture()
def client(server):
    return server.client


@pytest.fixture()
def make_server(tmp_path):
    """For tests that need special settings (for example a fake SMTP server)."""
    started = []

    def make(extra_env):
        s = Server(tmp_path, extra_env)
        started.append(s)
        return s

    yield make
    for s in started:
        s.stop()
