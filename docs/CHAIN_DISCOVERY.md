# Chain Discovery

Verified 2026-10-09. Sources: official docs (https://docs.robinhood.com/chain/connecting), live RPC probes, live Blockscout API probes.

## Result

VibeVibe testnet (https://testnet.vibevibe.fun/) identifies itself as "vibe/vibe · Robinhood Chain Testnet". Confirmed from the site content. Robinhood Chain Testnet is an Ethereum L2 built on Arbitrum (Nitro). Third-party sources (not official VibeVibe docs) describe vibe/vibe as a bonding-curve launchpad that later graduates tokens to Uniswap V4.

## Verified facts

| Item | Value | Evidence |
|---|---|---|
| Chain ID | 46630 (0xb626) | Official docs; `eth_chainId` returned `0xb626` |
| Native currency | ETH, 18 decimals | Official docs |
| EVM compatible | Yes (Arbitrum Nitro `nitro/v3.12.1-rc.2`) | Official docs; `web3_clientVersion` |
| Public HTTP RPC | `https://rpc.testnet.chain.robinhood.com` (also answers at `/rpc`) | Official docs; live probe |
| Alchemy HTTP RPC | `https://robinhood-testnet.g.alchemy.com/v2/{API_KEY}` | Official docs (key required) |
| Alchemy WS RPC | `wss://robinhood-testnet.g.alchemy.com/v2/{API_KEY}` | Official docs (key required) |
| Sequencer feed | `wss://feed.testnet.chain.robinhood.com` | Official docs (not used) |
| Explorer | `https://explorer.testnet.chain.robinhood.com` (Blockscout v10.2.6) | Official docs; `/api/v2/config/backend-version` |
| Explorer URL formats | `/address/{addr}`, `/tx/{hash}`, `/token/{addr}`, `/block/{n}` | Blockscout standard; `/api/v2/search` returns `/address/..` and `/token/..` paths |
| Explorer API | `/api/v2/*` public, no key | Live probe |

## Observed (not documented)

All observations below were made on 2026-10-09/10 against the public RPC and may change. The code reads them from env and adapts.

- `eth_getLogs` on the public RPC: an address-less query over **30,000 blocks** is rejected (`only 30000 are allowed for this request; narrow the block range, or add an address filter`). **With an address filter, spans of 20,000,000 blocks were accepted** (token `0xb2b4…e344`, 5.7M blocks in one call). The indexer uses `GETLOGS_ADDRESS_MAX_BLOCK_RANGE` (default 2M) and halves the range when a provider rejects it. A result set over **10,000 logs** is rejected (`logs matched by query exceeds limit of 10000`). Both limits were seen at 2026-10-09 and may change. The indexer must adapt to these errors.
- Block numbers on the L2 are about 131.7M at probe time; average block time reported by explorer is irregular (blocks are produced on demand).
- Public WebSocket on `/ws` returned HTTP 404. No public WS endpoint is verified.
- Historical state (`eth_getCode`/`eth_call` at old blocks) works on the public RPC, including a binary search for the first block with code. The creation block is taken from the explorer's creation tx and confirmed with the RPC receipt.
- Node connecting to the Postgres host (Neon) from a dual-stack machine needs `net.setDefaultAutoSelectFamilyAttemptTimeout(3000)`; the 250 ms default fails with ETIMEDOUT/ENETUNREACH.

## Explorer address endpoints used in phase 3 (observed 2026-10-10)

- `GET /api/v2/addresses/{a}/transactions?sort=block_number&order=asc|desc[&filter=to|from]` returns 50 items per page and `next_page_params`, which are passed back as query parameters. `created_contract` is set only for direct CREATE transactions.
- Launchpad launches do **not** appear as `created_contract`. The creation transaction's detail (`GET /api/v2/transactions/{hash}`) lists `token_transfers` including a `token_minting` transfer from the zero address with `token.type` (`ERC-20`, `ERC-721`, …). VibeGuard attributes a token to a sender only through an ERC-20 mint in a transaction the sender sent through a known creation path (target + selector).
- `GET /api/v2/addresses/{a}/counters` can lag: `transactions_count` was `0` for an address that listed 40 transactions (and `40` minutes later). Counts are reconciled against the listed transactions.
- `GET /api/v2/addresses/{a}/token-transfers?type=ERC-20` lists token transfers touching the address, paged the same way.
- No documented rate limit; calls are bounded (concurrency 4–5, time budget per scan).

## Token population (observed)

Blockscout `/api/v2/tokens?type=ERC-20&q=vibe` lists many launchpad tokens. A survey of 25 of them (analysis block 131.77M) found every one to be a plain ERC-20: no `owner()`, no proxy, no mint/pause/blacklist/fee selectors, all unverified source. Creation transactions come from user EOAs through launchpad contracts (`0x40f1…`, `0xe794…`, `0x2784…`), so the *creation tx sender* is the user and the *immediate creator* (explorer `creator_address_hash`) is a contract. VibeGuard reports both and does not equate either with a person.

Launchpad tokens commonly keep a large share of supply in contracts (the token contract itself and curve/pool-like contracts held 68–86% in the two tokens fully scanned). Reconciliation of indexed transfers against `totalSupply()` and `balanceOf()` matched exactly for both.

Non-launchpad tokens on the same chain (stablecoin-like, test tokens) do expose owner, mint, pause, EIP-1967 proxies and verified ABIs; the capability detector was validated on those.

## VibeVibe contracts: UNRESOLVED

No official VibeVibe contract address, factory, or docs were found. The site exposes no addresses to a fetch.

Observed on the explorer (not official, not confirmed as VibeVibe infrastructure):

- Token `VibeVibe (VIBES)` at `0x3c1b3e4383f3Fa90b314dD451332c86b1C779725`, 1,000,000,000 supply, created by tx `0x1e22…ef6e0` through contract `0x40f1be6faf8DAB9C143cce1a0A04c2075Fb2DF59` (method `createToken`, unverified source).
- Many tokens named "Vibe…" exist. Several were created via contracts `0xe794217880011f9cA6961340eD5c16EC9559Fea0` (selector `0x24e615b3`) and `0x2784448c519D01d3aE257C0aac0b7cDAd8AccEB1` (selector `0x0f5a5d1a`), all with unverified source. A launchpad may use these, but nothing links them to VibeVibe.

**Decision (owner, 2026-10-10):** token discovery is user-submitted addresses only. `VIBEVIBE_FACTORY_ADDRESS` stays as an optional, currently unused env var.

## Unresolved list

1. VibeVibe factory/launchpad address and event ABI.
2. Numeric rate limits of the public RPC and explorer API (docs say only "rate-limited").
3. Public WebSocket RPC (Alchemy WS needs a key). Polling is used.
4. Stable `eth_getLogs` limits (observed only).
5. Whether the VibeVibe DEX/pool contracts (Uniswap V4 per third parties) exist on this testnet. Affects liquidity and momentum; the liquidity category is reported as not assessed.
6. Testnet faucet URL.

All are exposed as env vars or reported as `unresolved` capabilities (`src/lib/chain/capabilities.ts`).
