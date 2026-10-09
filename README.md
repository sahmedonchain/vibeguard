# VibeGuard

Evidence-backed token risk analysis for VibeVibe tokens on Robinhood Chain Testnet. Automated analysis, not an audit.

Status: phase 3. Token scanner, indexer, risk engine, holder analysis, creator reputation, wallet DNA and coordination (sybil) analysis work end to end. Whales, momentum, alerts, Token Doctor, ecosystem view and the full developer docs are not built yet. See `docs/IMPLEMENTATION_STATUS.md`.

## Develop

```bash
pnpm install
cp .env.example .env.local     # set DATABASE_URL; chain defaults are verified public values
pnpm db:migrate                # apply migrations (additive)
pnpm dev                       # web app on :3000
pnpm worker                    # scan worker (separate process; required for scans to run)
pnpm scan 0x<token>            # or: run one scan in-process and print the JSON report
```

Scans submitted through the UI/API stay `queued` until a worker is running.

## Scripts

`typecheck`, `lint`, `test` (unit), `test:integration` (live testnet RPC + Postgres; needs `.env.local`), `test:e2e` (Playwright; builds and starts the app), `build`, `db:generate`, `db:migrate`, `worker`, `scan`.

## Docs

- `docs/MASTER_SRS.md` source of truth; `docs/PHASES.md` phase prompts
- `docs/CHAIN_DISCOVERY.md` verified chain facts, observations, unresolved items
- `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/RISK_METHODOLOGY.md`, `docs/API.md`
- `docs/IMPLEMENTATION_STATUS.md` checklist per phase
