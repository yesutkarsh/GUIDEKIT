# GuideKit Backend — Phase 1

Database foundation, unified auth (dashboard + VS Code extension device-code
login), and project/key provisioning for GuideKit.

- **Framework:** FastAPI + Uvicorn (Python 3.11+)
- **Database:** Neon Serverless PostgreSQL 15+ (`pgcrypto` + `pgvector`)
- **ORM:** Async SQLAlchemy 2.0 with `psycopg` (v3) async
- **Auth:** Argon2 (`pwdlib`), JWT access tokens (`PyJWT`), SHA-256-hashed
  refresh tokens / device codes / API keys

## Directory layout

```text
backend/
├── .env.example              # every environment variable, with defaults
├── pyproject.toml
├── sql/schema_v2.sql         # full GuideKit v2 DDL + the 2 Phase 1 patches
├── scripts/
│   ├── init_db.py            # async migration runner (psycopg)
│   └── smoke_test_phase1.py  # end-to-end httpx verification
├── app/
│   ├── main.py
│   ├── core/                 # config, security, deps
│   ├── db/session.py         # engine + RLS-aware session providers
│   ├── models/               # SQLAlchemy 2.0 models mirroring the DDL
│   ├── schemas/              # Pydantic v2 request/response models
│   └── api/v1/endpoints/     # auth, device_auth, projects, sdk_guard
└── tests/                    # offline pytest suite (no DB required)
```

## Environment variables

Copy the template and fill in values:

```bash
cp .env.example .env
```

| Variable | Required | Where | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ (for DB work) | `.env` | Neon connection string, e.g. `postgresql+psycopg://USER:PASSWORD@HOST:5432/guidekit?sslmode=require` |
| `SECRET_KEY` | ✅ (prod) | `.env` | JWT signing secret (`python -c "import secrets; print(secrets.token_urlsafe(64))"`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | – | `.env` | Access-token lifetime (default 15) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | – | `.env` | Refresh-token lifetime (default 30) |
| `DEVICE_CODE_EXPIRE_SECONDS` | – | `.env` | Device-code lifetime (default 600) |
| `DASHBOARD_URL` | – | `.env` | URL shown during device-code login |
| `CLERK_ISSUER` | – | `.env` | Expected issuer for fail-closed Clerk JWT verification |
| `CLERK_AUTHORIZED_PARTIES` | localhost origins | optional | Allowed Clerk `azp` frontend origins |
| `CORS_ORIGINS` | – | `.env` | Comma-separated allowed dashboard origins |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` / `DB_POOL_PRE_PING` | – | `.env` | Connection pool tuning |
| `ENVIRONMENT` / `DEBUG` / `API_V1_PREFIX` | – | `.env` | App metadata |

All values are read by `app.core.config.Settings` from the environment first,
then `.env` (see `pydantic-settings`).

## Run it

```bash
# 1. Install
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# 2. Apply the schema (provide DATABASE_URL in .env first)
python scripts/init_db.py            # apply; add --drop to reset

# 3. Start the API
uvicorn app.main:app --reload

# 4. End-to-end verification (separate terminal)
BASE_URL=http://127.0.0.1:8000 python scripts/smoke_test_phase1.py
```

## Offline verification (no database)

```bash
pytest
```

The test suite imports the app, exercises every pure security primitive,
validates the Pydantic schemas, and statically asserts the two mandatory DDL
patches and the full v2 table surface in `sql/schema_v2.sql` — no database
connection is required.

## Notes for reviewers

- **Driver choice:** `psycopg` (v3) async is used instead of `asyncpg` because
  the migration runner must execute a multi-statement DDL script (with `DO`
  blocks and `$$`-quoted function bodies) in one shot. `asyncpg` cannot run
  multiple statements per call; `psycopg`'s simple-query path can.
- **RLS & the SDK path:** the SDK verification endpoint uses a service-role
  session that issues `SET LOCAL row_security = off` (see
  `app/db/session.py`). This requires the app's DB role to own the tables —
  true by default in Neon when the same role runs `init_db.py`. For a hardened
  multi-role deployment, create a dedicated `service_role` with `BYPASSRLS`.
- The legacy nullable `password_hash` column remains for schema compatibility,
  but the application exposes no password routes. Clerk
  Google OAuth is the only account identity path.
