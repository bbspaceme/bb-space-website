# BB Space / KBAI Terminal Production Status

Last updated: 2026-05-13

## Current production readiness

The repository now tracks only actionable production status instead of self-graded audit theater. The current priority is keeping deployment reproducible, security controls honest, and runtime dependencies explicit.

## Remediated in this hardening pass

- Removed stale `@types/uuid` and `xlsx` package entries that blocked deterministic installs or carried avoidable dependency risk.
- Replaced admin XLSX export with standards-based CSV downloads.
- Made auth role extraction importable and covered by tests that exercise production code.
- Made structured logging correlation IDs explicit in request context instead of server-global mutable state.
- Raised Sentry trace sampling to 100% by default, while allowing environment override.
- Corrected the Cloudflare KV rate-limit binding name to `RATE_LIMIT_KV` and fail fast when KV is requested but missing in production.
- Disabled Yahoo Finance fallback unless explicitly enabled for local development.
- Corrected Supabase role-claim trigger logic to update `auth.users.raw_app_meta_data.roles` from `NEW.user_id`/`OLD.user_id`.
- Reconciled the soft-delete migration with the actual schema names (`profiles` and `watchlist`).
- Added package-lock verification to CI and deployment workflows.

## Required production environment configuration

Set the following before relying on production features:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `RATE_LIMIT_KV_ENABLED=true` only after binding Cloudflare KV as `RATE_LIMIT_KV`
- A licensed market-data provider key and implementation path for production price refreshes
- `MARKET_DATA_ALLOW_UNLICENSED_YAHOO=true` only for local development/testing where legally appropriate
- `VITE_SENTRY_DSN`
- `VITE_SENTRY_TRACES_SAMPLE_RATE` if a value other than `1.0` is required
- Direct AI provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`) before removing legacy Lovable gateway usage completely

## Remaining follow-up work

- Finish Vercel SSR alignment by adding the TanStack Start Nitro adapter when dependency installation is available.
- Replace legacy Lovable AI gateway calls with the existing direct provider abstraction in every AI workflow.
- Implement a licensed IDX market-data provider and keep Yahoo fallback out of production.
- Provision real Cloudflare KV namespace IDs if Cloudflare Workers remains a target.
- Add integration tests for login, 2FA, admin route guards, transaction creation, and cash balance adjustments.
- Add Lighthouse and axe checks after the deployment pipeline is green.
