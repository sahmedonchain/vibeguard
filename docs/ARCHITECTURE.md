# Architecture

## Stack (pinned in package.json)

Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui-style components (hand-written, `components.json` present), Lucide, Recharts (installed, first used in later phases), Drizzle ORM + PostgreSQL (`pg`), Viem, Zod, Vitest, Playwright. Package manager: pnpm. Node >= 22.

## Layout

```
src/app/            routes (App Router). Every public route exists; unbuilt ones show "Coming in phase N".
src/components/ui/  primitives (button, card, badge)
src/components/shared/  address display+copy, risk score, severity badge, freshness label, state components
src/components/layout/  header, footer, mobile nav
src/lib/routes.ts   single route registry: drives nav, footer, coming-soon pages, tests
src/lib/chain/      chain adapter: config (zod + env), client (viem), capabilities, explorer
src/db/             Drizzle client (lazy) and schema (empty until phase 2)
worker/             (phase 2) separate indexer process, not serverless
tests/unit, e2e/    Vitest, Playwright
```

## Chain adapter

EVM was confirmed (see CHAIN_DISCOVERY.md), so Viem is used. All chain values come from `parseChainConfig(env)`. Verified values are defaults; unverified values (factory address, WS URL) have no default and the capability is reported `unresolved`. The adapter never invents data. `getLogsMaxBlockRange` is configurable because the limit is only observed.

## Data flow (planned)

worker indexes logs/blocks -> Postgres -> risk engine (pure, deterministic, versioned) -> API routes + pages. Web tier reads the DB only. RPC calls from the web tier are limited to on-demand reads.

## Decisions

- Dark-first: single dark palette in `globals.css` tokens, no theme toggle in phase 1.
- No auth, user dashboard, or admin panel (explicit requirement).
- `cacheComponents` from the scaffold was disabled; it adds Suspense constraints with no phase-1 benefit.
- Address route params are validated with Viem `isAddress`; invalid input returns 404.
- Address strings are rendered as text only; token metadata will be treated as untrusted.

## Spec gap

`docs/MASTER_SRS.md` is the six-phase prompt document. It does not contain the numbered sections the prompt references (5.1 routes, 6 landing, 8.3 scoring, 29 error codes, 35 report format). Routes were derived from the phase prompts; the landing page follows the prompt text. Supply the full SRS to settle these.
