import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/** uint256 as exact decimal. Never converted through floating point. */
const uint256 = (name: string) => numeric(name, { precision: 78, scale: 0 });
const address = (name: string) => varchar(name, { length: 42 });
const hash = (name: string) => varchar(name, { length: 66 });
const block = (name: string) => bigint(name, { mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const SCAN_STATUSES = ["queued", "running", "completed", "partial", "failed", "unsupported"] as const;

export const networks = pgTable("networks", {
  chainId: integer("chain_id").primaryKey(),
  name: text("name").notNull(),
  explorerUrl: text("explorer_url").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const tokens = pgTable(
  "tokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    chainId: integer("chain_id").notNull().references(() => networks.chainId),
    address: address("address").notNull(),
    name: text("name"),
    symbol: text("symbol"),
    decimals: smallint("decimals"),
    totalSupply: uint256("total_supply"),
    /** How VibeGuard learned of the token: "user_submitted" | "factory_event". */
    discoverySource: text("discovery_source").notNull(),
    creationBlock: block("creation_block"),
    creationTxHash: hash("creation_tx_hash"),
    creatorAddress: address("creator_address"),
    /** How creation data was found: "explorer" | "bytecode_search" (block only). */
    creationSource: text("creation_source"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("tokens_chain_address_uq").on(t.chainId, t.address)],
);

export const contracts = pgTable(
  "contracts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    chainId: integer("chain_id").notNull().references(() => networks.chainId),
    address: address("address").notNull(),
    hasCode: boolean("has_code").notNull(),
    codeSize: integer("code_size"),
    codeHash: hash("code_hash"),
    sourceVerified: boolean("source_verified"),
    analyzedBlock: block("analyzed_block"),
    analysis: jsonb("analysis"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("contracts_chain_address_uq").on(t.chainId, t.address)],
);

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chainId: integer("chain_id").notNull().references(() => networks.chainId),
    tokenAddress: address("token_address").notNull(),
    status: text("status").notNull().default("queued"),
    requestedAt: ts("requested_at").notNull().defaultNow(),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    analysisBlock: block("analysis_block"),
    analysisBlockHash: hash("analysis_block_hash"),
    analysisBlockTime: ts("analysis_block_time"),
    latestIndexedBlock: block("latest_indexed_block"),
    methodologyVersion: text("methodology_version"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    /** Token metadata, holder stats and contract analysis summary as observed by this scan. */
    context: jsonb("context"),
  },
  (t) => [
    index("scans_token_idx").on(t.chainId, t.tokenAddress, t.requestedAt),
    index("scans_status_idx").on(t.status, t.requestedAt),
    // At most one active scan per token: concurrent requests converge on the same scan.
    uniqueIndex("scans_active_uq").on(t.chainId, t.tokenAddress).where(sql`${t.status} in ('queued','running')`),
    check("scans_status_ck", sql`${t.status} in ('queued','running','completed','partial','failed','unsupported')`),
  ],
);

export const contractPermissions = pgTable(
  "contract_permissions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    scanId: uuid("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    address: address("address").notNull(),
    capability: text("capability").notNull(),
    signature: text("signature").notNull(),
    selector: varchar("selector", { length: 10 }).notNull(),
    /** "abi" (verified source) | "bytecode_selector" (heuristic). */
    detectedVia: text("detected_via").notNull(),
    confidence: text("confidence").notNull(),
  },
  (t) => [
    unique("contract_permissions_uq").on(t.scanId, t.selector),
    index("contract_permissions_addr_idx").on(t.chainId, t.address),
  ],
);

export const tokenTransfers = pgTable(
  "token_transfers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    chainId: integer("chain_id").notNull(),
    tokenAddress: address("token_address").notNull(),
    blockNumber: block("block_number").notNull(),
    blockHash: hash("block_hash").notNull(),
    txHash: hash("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    fromAddress: address("from_address").notNull(),
    toAddress: address("to_address").notNull(),
    value: uint256("value").notNull(),
  },
  (t) => [
    unique("token_transfers_event_uq").on(t.chainId, t.txHash, t.logIndex),
    index("token_transfers_token_block_idx").on(t.chainId, t.tokenAddress, t.blockNumber),
    index("token_transfers_from_idx").on(t.chainId, t.fromAddress),
    index("token_transfers_to_idx").on(t.chainId, t.toAddress),
  ],
);

export const indexedBlocks = pgTable(
  "indexed_blocks",
  {
    chainId: integer("chain_id").notNull(),
    blockNumber: block("block_number").notNull(),
    blockHash: hash("block_hash").notNull(),
    parentHash: hash("parent_hash").notNull(),
    blockTime: ts("block_time").notNull(),
    indexedAt: ts("indexed_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.chainId, t.blockNumber] })],
);

export const indexerCheckpoints = pgTable(
  "indexer_checkpoints",
  {
    chainId: integer("chain_id").notNull(),
    /** e.g. "token_transfers:0x…" */
    stream: text("stream").notNull(),
    lastBlock: block("last_block").notNull(),
    lastBlockHash: hash("last_block_hash").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.chainId, t.stream] })],
);

export const indexerErrors = pgTable(
  "indexer_errors",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    chainId: integer("chain_id").notNull(),
    stream: text("stream").notNull(),
    message: text("message").notNull(),
    details: jsonb("details"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("indexer_errors_idx").on(t.chainId, t.stream, t.createdAt)],
);

export const methodologyVersions = pgTable("methodology_versions", {
  version: text("version").primaryKey(),
  description: text("description").notNull(),
  weights: jsonb("weights").notNull(),
  thresholds: jsonb("thresholds").notNull(),
  severityPoints: jsonb("severity_points").notNull(),
  rules: jsonb("rules").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const riskScores = pgTable("risk_scores", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  scanId: uuid("scan_id").notNull().unique().references(() => scans.id, { onDelete: "cascade" }),
  /** Null when coverage is too low to score. 0-100, higher = more observed risk. */
  overall: numeric("overall", { precision: 5, scale: 2 }),
  level: text("level").notNull(),
  coverage: numeric("coverage", { precision: 5, scale: 4 }).notNull(),
  provisional: boolean("provisional").notNull(),
  criticalOverride: boolean("critical_override").notNull(),
  categories: jsonb("categories").notNull(),
  methodologyVersion: text("methodology_version").notNull().references(() => methodologyVersions.version),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const riskFindings = pgTable(
  "risk_findings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    scanId: uuid("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
    ruleId: text("rule_id").notNull(),
    category: text("category").notNull(),
    /** "detected" | "not_detected" | "unknown" */
    status: text("status").notNull(),
    severity: text("severity").notNull(),
    confidence: text("confidence").notNull(),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    followUp: text("follow_up"),
  },
  (t) => [unique("risk_findings_scan_rule_uq").on(t.scanId, t.ruleId)],
);

export const evidenceRecords = pgTable(
  "evidence_records",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    scanId: uuid("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
    findingId: bigint("finding_id", { mode: "number" }).references(() => riskFindings.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    data: jsonb("data"),
    address: address("address"),
    txHash: hash("tx_hash"),
    blockNumber: block("block_number"),
  },
  (t) => [index("evidence_finding_idx").on(t.findingId)],
);

export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
