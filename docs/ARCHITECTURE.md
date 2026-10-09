# Architecture

## Stack (pinned in package.json)

Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui-style components (hand-written, `components.json` present), Lucide, Recharts (installed, first used in later phases), Drizzle ORM + PostgreSQL (`pg`), Viem, Zod, Vitest, Playwright. Package manager: pnpm. Node >= 22.

## Layout

```
src/app/            routes. Live: /, /scan, /token/[address], /methodology, /api/v1/*. Others show "Coming in phase N".
src/components/     ui (primitives), shared (address, tx, risk score, severity, freshness, states, tooltip, network badge), report (report view, finding/evidence cards, holders chart, scan controls), layout
src/lib/routes.ts   route registry: nav, footer, coming-soon pages, tests
src/lib/chain/      config (zod/env), client (viem), capabilities, explorer URLs, optional Blockscout API adapter
src/lib/contracts/  selector table, bytecode scan, proxy detection, contract analysis
src/lib/indexing/   adaptive getLogs, Transfer decoding, balances, holder analysis, indexer (checkpoint/reorg), creation lookup
src/lib/risk-engine/ methodology constants, rule registry + rules, evaluation and scoring (pure)
src/lib/scans/      queue (create/claim), runner, report assembly, reference-data setup
src/lib/api/        error codes, envelope, schemas, rate limiter, handler pipeline
src/db/             Drizzle schema and lazy client
worker/             index.ts (queue worker), scan-cli.ts (run one scan locally)
drizzle/            SQL migrations
tests/unit, tests/integration, e2e/
```

## Chain adapter

EVM was confirmed (see CHAIN_DISCOVERY.md), so Viem is used. All chain values come from `parseChainConfig(env)`. Verified values are defaults; unverified values (factory address, WS URL) have no default and the capability is reported `unresolved`. The adapter never invents data. `getLogsMaxBlockRange` is configurable because the limit is only observed.

## Data flow (implemented)

```
user/API --POST /api/v1/scans--> web tier: validate, rate limit (Postgres), enqueue (or reuse active/recent scan)
worker: claim queued scan (SKIP LOCKED) -> pin analysis block (head - confirmations)
        -> contract analysis at that block (code, ERC-20 calls, owner, proxy slots, selectors, optional verified ABI)
        -> index Transfer events from creation block (address-filtered, adaptive ranges, checkpoint, reorg rewind, time budget)
        -> balances -> holder classification -> reconciliation against totalSupply()/balanceOf()
        -> rules -> score -> persist (one transaction) -> status completed|partial|unsupported|failed
web tier: /token/[address] and GET endpoints read the DB; the page polls via router.refresh() while queued/running
```

The web tier never runs a scan and never calls the RPC except `/api/v1/health`. Heavy work is bounded by `INDEXER_SCAN_BUDGET_MS`; an unfinished index yields a partial scan with unknown holder rules, never a guessed one.

Reproducibility: all state reads use the pinned analysis block. Scores are derived only from the stored context; the engine has no clock or randomness.

## Decisions

- Dark-first: single dark palette in `globals.css` tokens, no theme toggle in phase 1.
- No auth, user dashboard, or admin panel (explicit requirement).
- `cacheComponents` from the scaffold was disabled; it adds Suspense constraints with no phase-1 benefit.
- Address route params are validated with Viem `isAddress`; invalid input returns 404.
- Address strings are rendered as text only; token metadata will be treated as untrusted.

## Operational notes

- Queue is DB-backed (no Redis; SRS 4.4 allows it). Stale `running` scans (> 10 min) are returned to the queue.
- Rate limiter is Postgres-backed (fixed window, HMAC of client IP) so it holds across serverless instances. It fails open if the DB errors.
- Postgres from some hosts needs a longer IPv4/IPv6 attempt timeout; set in `src/db/client.ts`.
- Token discovery: user-submitted addresses only (owner decision 2026-10-10). The factory env var is optional and unused.
