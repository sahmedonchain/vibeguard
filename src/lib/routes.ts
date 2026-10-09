export type RouteDef = {
  path: string;
  title: string;
  description: string;
  /** Phase (1-6, see docs/IMPLEMENTATION_STATUS.md) in which the route becomes functional. */
  phase: number;
  nav?: "primary" | "more";
  footer?: "product" | "developers" | "company";
  /** True once the route is functional (not a coming-soon shell). */
  live?: boolean;
};

export const ROUTES = {
  scan: { path: "/scan", title: "Token Scanner", description: "Scan a token address for evidence-backed risk findings.", phase: 2, nav: "primary", footer: "product", live: true },
  methodology: { path: "/methodology", title: "Methodology", description: "How risk scores and findings are computed.", phase: 2, nav: "primary", footer: "product", live: true },
  sybil: { path: "/sybil", title: "Sybil Analysis", description: "Possible coordination between wallets, with confidence and alternatives.", phase: 3, nav: "more", footer: "product" },
  whales: { path: "/whales", title: "Whale Tracker", description: "Large transfers and holder balance changes.", phase: 4, nav: "primary", footer: "product" },
  momentum: { path: "/momentum", title: "Momentum", description: "Activity trends from verified on-chain data.", phase: 4, nav: "more", footer: "product" },
  alerts: { path: "/alerts", title: "Alerts", description: "Browser notifications for watched tokens and wallets.", phase: 4, nav: "more", footer: "product" },
  doctor: { path: "/doctor", title: "Token Doctor", description: "Static checks for deployed contracts or pasted Solidity.", phase: 5, nav: "primary", footer: "product" },
  ecosystem: { path: "/ecosystem", title: "Ecosystem", description: "Indexed aggregates across scanned tokens.", phase: 5, nav: "more", footer: "product" },
  developers: { path: "/developers", title: "Developers", description: "Build on the VibeGuard API.", phase: 5, footer: "developers" },
  developersApi: { path: "/developers/api", title: "API Reference", description: "Endpoints, schemas, and rate limits.", phase: 5, footer: "developers" },
  about: { path: "/about", title: "About", description: "What VibeGuard is and is not.", phase: 5, footer: "company" },
  privacy: { path: "/privacy", title: "Privacy", description: "What data VibeGuard handles.", phase: 5, footer: "company" },
  terms: { path: "/terms", title: "Terms", description: "Terms of use.", phase: 5, footer: "company" },
  status: { path: "/status", title: "Status", description: "Indexer and RPC health.", phase: 5, footer: "company" },
  token: { path: "/token/[address]", title: "Token Report", description: "Risk report for a token.", phase: 2, live: true },
  creator: { path: "/creator/[address]", title: "Creator Reputation", description: "Deployment history and funding facts for a creator.", phase: 3 },
  wallet: { path: "/wallet/[address]", title: "Wallet DNA", description: "Activity timeline, flows, and counterparties.", phase: 3 },
} as const satisfies Record<string, RouteDef>;

export const ROUTE_LIST: RouteDef[] = Object.values(ROUTES);

export const PHASE_NAMES: Record<number, string> = {
  1: "Foundation",
  2: "Data pipeline & token scanner",
  3: "Holders, creator, wallets, sybil",
  4: "Whales, momentum, alerts",
  5: "Token Doctor, ecosystem, API",
  6: "Security, QA, deploy",
};
