# VibeGuard

Evidence-backed token risk analysis for VibeVibe tokens on Robinhood Chain Testnet. Automated analysis, not an audit.

Status: phase 1 (foundation). Only the landing page and route shells exist. See `docs/IMPLEMENTATION_STATUS.md`.

## Develop

```bash
pnpm install
cp .env.example .env.local   # defaults work for the public testnet
pnpm dev
```

Scripts: `typecheck`, `lint`, `test` (Vitest), `test:e2e` (Playwright; builds and starts the app), `build`, `db:generate`, `db:migrate`.

## Docs

- `docs/MASTER_SRS.md` source of truth
- `docs/CHAIN_DISCOVERY.md` verified chain facts and unresolved items
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_STATUS.md`
