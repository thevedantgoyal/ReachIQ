"""Smoke tests for ReachIQ dev stack: API health, Postgres tables, Redis, Alembic."""

import os

import redis
import requests
from sqlalchemy import bindparam, create_engine, text

PASS = "\033[0;32m[PASS]\033[0m"
FAIL = "\033[0;31m[FAIL]\033[0m"
RESET = "\033[0m"

REQUIRED_TABLES = (
    "campaigns",
    "contacts",
    "email_jobs",
    "daily_send_logs",
    "gmail_auth",
)


def load_env_file(path: str) -> dict[str, str]:
    """Parse KEY=VALUE lines from a .env file (no python-dotenv)."""
    values: dict[str, str] = {}
    if not os.path.isfile(path):
        return values
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            values[key] = val
    return values


def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(root, ".env")
    env = load_env_file(env_path)
    database_url = env.get("DATABASE_URL")
    redis_url = env.get("REDIS_URL")
    if not database_url:
        print(f"{FAIL} DATABASE_URL missing in {env_path}")
        return 1
    if not redis_url:
        print(f"{FAIL} REDIS_URL missing in {env_path}")
        return 1

    base_url = env.get("SMOKE_API_BASE_URL", "http://localhost:8000").rstrip("/")

    results = []

    reason1 = ""
    ok1 = False
    try:
        r = requests.get(f"{base_url}/health", timeout=10)
        r.raise_for_status()
        data = r.json()
        if data.get("status") == "ok" and data.get("db") == "connected":
            ok1 = True
        else:
            reason1 = "unexpected JSON: {!r}".format(data)
    except Exception as exc:
        reason1 = str(exc)
    results.append(("GET /health → status ok & db connected", ok1, reason1))

    reason2 = ""
    ok2 = False
    try:
        engine = create_engine(database_url, pool_pre_ping=True)
        stmt = (
            text(
                "SELECT tablename FROM pg_tables "
                "WHERE schemaname = 'public' AND tablename IN :names"
            ).bindparams(bindparam("names", expanding=True))
        )
        with engine.connect() as conn:
            rows = conn.execute(stmt, {"names": list(REQUIRED_TABLES)}).fetchall()
        found = {row[0] for row in rows}
        missing = set(REQUIRED_TABLES) - found
        if not missing:
            ok2 = True
        else:
            reason2 = "missing tables: {}".format(sorted(missing))
    except Exception as exc:
        reason2 = str(exc)
    results.append(("PostgreSQL: all 5 ORM tables exist", ok2, reason2))

    reason3 = ""
    ok3 = False
    try:
        rds = redis.from_url(redis_url, socket_connect_timeout=5)
        if rds.ping():
            ok3 = True
        else:
            reason3 = "ping returned falsey response"
    except Exception as exc:
        reason3 = str(exc)
    results.append(("Redis responds to PING", ok3, reason3))

    reason4 = ""
    ok4 = False
    try:
        engine = create_engine(database_url, pool_pre_ping=True)
        with engine.connect() as conn:
            reg = conn.execute(
                text("SELECT to_regclass('public.alembic_version')::text")
            ).scalar()
        if reg:
            ok4 = True
        else:
            reason4 = "public.alembic_version not found"
    except Exception as exc:
        reason4 = str(exc)
    results.append(("PostgreSQL: alembic_version table exists", ok4, reason4))

    passed = 0
    for label, ok, reason in results:
        if ok:
            print("{} {}".format(PASS, label))
            passed += 1
        else:
            print("{} {}{} — {}".format(FAIL, label, RESET, reason))

    print("")
    print("Summary: {}/4 tests passed".format(passed))
    return 0 if passed == 4 else 1


if __name__ == "__main__":
    raise SystemExit(main())
