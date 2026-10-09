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

- `eth_getLogs` on the public RPC: a range over **30,000 blocks** is rejected unless an address filter is given (`only 30000 are allowed for this request; narrow the block range, or add an address filter`). A result set over **10,000 logs** is rejected (`logs matched by query exceeds limit of 10000`). Both limits were seen at 2026-10-09 and may change. The indexer must adapt to these errors.
- Block numbers on the L2 are about 131.7M at probe time; average block time reported by explorer is irregular (blocks are produced on demand).
- Public WebSocket on `/ws` returned HTTP 404. No public WS endpoint is verified.

## VibeVibe contracts: UNRESOLVED

No official VibeVibe contract address, factory, or docs were found. The site exposes no addresses to a fetch.

Observed on the explorer (not official, not confirmed as VibeVibe infrastructure):

- Token `VibeVibe (VIBES)` at `0x3c1b3e4383f3Fa90b314dD451332c86b1C779725`, 1,000,000,000 supply, created by tx `0x1e22…ef6e0` through contract `0x40f1be6faf8DAB9C143cce1a0A04c2075Fb2DF59` (method `createToken`, unverified source).
- Many tokens named "Vibe…" exist. Several were created via contracts `0xe794217880011f9cA6961340eD5c16EC9559Fea0` (selector `0x24e615b3`) and `0x2784448c519D01d3aE257C0aac0b7cDAd8AccEB1` (selector `0x0f5a5d1a`), all with unverified source. A launchpad may use these, but nothing links them to VibeVibe.

Do not treat these as the factory. Phase 2 plan: user-submitted token addresses first; accept a factory only after the user confirms it, set via `VIBEVIBE_FACTORY_ADDRESS`.

## Unresolved list

1. VibeVibe factory/launchpad address and event ABI.
2. Numeric rate limits of the public RPC and explorer API (docs say only "rate-limited").
3. Public WebSocket RPC (Alchemy WS needs a key).
4. Stable `eth_getLogs` limits (observed only).
5. Whether the VibeVibe DEX/pool contracts (Uniswap V4 per third parties) exist on this testnet. Affects momentum/market data.
6. Testnet faucet URL.

All are exposed as env vars or reported as `unresolved` capabilities (`src/lib/chain/capabilities.ts`).
