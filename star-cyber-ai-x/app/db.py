import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .config import settings


SCHEMA = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    target TEXT NOT NULL,
    authorized INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    scope_id INTEGER,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    confidence INTEGER NOT NULL DEFAULT 0,
    cwe TEXT,
    owasp TEXT,
    summary TEXT NOT NULL DEFAULT '',
    evidence_json TEXT NOT NULL DEFAULT '{}',
    remediation TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scan_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope_id INTEGER NOT NULL,
    scanner TEXT NOT NULL,
    status TEXT NOT NULL,
    command TEXT NOT NULL,
    output TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT,
    FOREIGN KEY(scope_id) REFERENCES scopes(id)
);
"""


def init_db():
    Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(settings.database_path) as conn:
        conn.executescript(SCHEMA)


@contextmanager
def connect():
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def one(sql: str, params=()):
    with connect() as conn:
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row else None


def all_rows(sql: str, params=()):
    with connect() as conn:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
