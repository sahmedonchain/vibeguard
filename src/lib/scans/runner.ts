import { eq, sql } from "drizzle-orm";
import type { PublicClient } from "viem";
import type { Db } from "@/db/client";
import { contractPermissions, contracts, evidenceRecords, riskFindings, riskScores, scans, tokens } from "@/db/schema";
import type { ChainConfig } from "@/lib/chain/config";
import { analyzeContract, type ContractAnalysis } from "@/lib/contracts/analyze";
import { type AppEnv } from "@/lib/env";
import { findCreation } from "@/lib/indexing/creation";
import { analyzeHolders, type HolderAnalysis } from "@/lib/indexing/holders";
import { indexTokenTransfers, loadTransfers, type IndexResult } from "@/lib/indexing/indexer";
import { computeBalances } from "@/lib/indexing/transfers";
import { errorMessage, isTransientError, withRetry } from "@/lib/retry";
import { METHODOLOGY_VERSION } from "@/lib/risk-engine/methodology";
import { computeScore, evaluateRules } from "@/lib/risk-engine/score";
import type { RuleContext } from "@/lib/risk-engine/types";
import { ensureReferenceData } from "./setup";

type Client = PublicClient;

export type ScanContext = {
  token: { address: string; name: string | null; symbol: string | null; decimals: number | null; totalSupply: string | null; creationBlock: number | null; creationTxHash: string | null; creator: string | null; immediateCreator: string | null; creationSource: string | null };
  contract: ContractAnalysis | null;
  holders: HolderAnalysis | null;
  indexing: Pick<IndexResult, "complete" | "stoppedReason" | "lastIndexedBlock" | "inserted" | "skippedLogs" | "rewoundTo"> & { error?: string } | null;
  reconciliation: RuleContext["reconciliation"];
};

class ScanFailure extends Error {
  constructor(public code: "SCAN_FAILED" | "PROVIDER_UNAVAILABLE" | "UNSUPPORTED_CONTRACT", message: string) {
    super(message);
  }
}

/**
 * Executes one scan that has been claimed (status = running).
 * Always ends the scan in a terminal status; never throws.
 */
export async function runScan(db: Db, client: Client, cfg: ChainConfig, env: AppEnv, scanId: string): Promise<void> {
  try {
    await executeScan(db, client, cfg, env, scanId);
  } catch (err) {
    const known = err instanceof ScanFailure ? err : null;
    const transient = isTransientError(err);
    const code = known?.code ?? (transient ? "PROVIDER_UNAVAILABLE" : "SCAN_FAILED");
    console.error(`[scan ${scanId}] failed:`, errorMessage(err));
    await db
      .update(scans)
      .set({
        status: code === "UNSUPPORTED_CONTRACT" ? "unsupported" : "failed",
        finishedAt: sql`now()`,
        errorCode: code,
        errorMessage: known?.message ?? (transient ? "The RPC provider was unavailable or rate limited. Try again shortly." : "The scan failed unexpectedly."),
      })
      .where(eq(scans.id, scanId));
  }
}

async function executeScan(db: Db, client: Client, cfg: ChainConfig, env: AppEnv, scanId: string): Promise<void> {
  await ensureReferenceData(db, cfg);
  const [scan] = await db.select().from(scans).where(eq(scans.id, scanId));
  if (!scan) throw new Error("scan not found");
  const address = scan.tokenAddress as `0x${string}`;

  // Pin the analysis block: all state reads use it, so the result is reproducible.
  const head = await withRetry(() => client.getBlockNumber());
  const analysisBlock = Math.max(0, Number(head) - env.INDEXER_CONFIRMATIONS);
  const header = await withRetry(() => client.getBlock({ blockNumber: BigInt(analysisBlock) }));
  await db
    .update(scans)
    .set({ analysisBlock, analysisBlockHash: header.hash, analysisBlockTime: new Date(Number(header.timestamp) * 1000), methodologyVersion: METHODOLOGY_VERSION })
    .where(eq(scans.id, scanId));

  // Contract analysis
  const contract = await analyzeContract(client, cfg.explorerUrl, address, analysisBlock);
  await db
    .insert(contracts)
    .values({ chainId: cfg.chainId, address: address.toLowerCase(), hasCode: contract.hasCode, codeSize: contract.codeSize, codeHash: contract.codeHash, sourceVerified: contract.source.verified, analyzedBlock: analysisBlock, analysis: contract })
    .onConflictDoUpdate({ target: [contracts.chainId, contracts.address], set: { hasCode: contract.hasCode, codeSize: contract.codeSize, codeHash: contract.codeHash, sourceVerified: contract.source.verified, analyzedBlock: analysisBlock, analysis: contract, updatedAt: sql`now()` } });
  if (!contract.hasCode) throw new ScanFailure("UNSUPPORTED_CONTRACT", "No contract code exists at this address at the analysis block. It may be a wallet, or the token may not be deployed yet.");
  if (!contract.erc20.isErc20Like) throw new ScanFailure("UNSUPPORTED_CONTRACT", "The contract does not respond to ERC-20 totalSupply() and balanceOf(address). VibeGuard supports ERC-20 tokens only.");

  // Token metadata and creation
  const [tokenRow] = await db.select().from(tokens).where(sql`${tokens.chainId} = ${cfg.chainId} and ${tokens.address} = ${address.toLowerCase()}`);
  let creation = tokenRow?.creationBlock != null ? { block: tokenRow.creationBlock, txHash: tokenRow.creationTxHash, txSender: tokenRow.creatorAddress, immediateCreator: null as string | null, source: tokenRow.creationSource } : null;
  if (!creation) {
    const found = await findCreation(client, cfg.explorerUrl, address, analysisBlock);
    if (found) creation = { block: found.block, txHash: found.txHash, txSender: found.txSender, immediateCreator: found.immediateCreator, source: found.source };
  }
  const supply = contract.erc20.totalSupply;
  await db
    .update(tokens)
    .set({ name: contract.erc20.name, symbol: contract.erc20.symbol, decimals: contract.erc20.decimals, totalSupply: supply, creationBlock: creation?.block ?? null, creationTxHash: creation?.txHash ?? null, creatorAddress: creation?.txSender ?? null, creationSource: creation?.source ?? null, updatedAt: sql`now()` })
    .where(sql`${tokens.chainId} = ${cfg.chainId} and ${tokens.address} = ${address.toLowerCase()}`);

  // Transfer index and holders
  const startBlock = creation?.block ?? env.INDEXER_START_BLOCK ?? null;
  const indexing = await indexTokenTransfers(db, client, { chainId: cfg.chainId, tokenAddress: address, startBlock, toBlock: analysisBlock, maxRange: cfg.getLogsAddressMaxBlockRange, budgetMs: env.INDEXER_SCAN_BUDGET_MS });
  let holders: HolderAnalysis | null = null;
  let reconciliation: RuleContext["reconciliation"] = null;
  if (indexing.complete && supply != null) {
    const all: { from: string; to: string; value: bigint }[] = [];
    for await (const page of loadTransfers(db, cfg.chainId, address, analysisBlock)) all.push(...page);
    const state = computeBalances(all);
    const onChainSupply = BigInt(supply);
    const indexedSupply = state.minted - state.burnedToZero;
    const isContract = async (a: string) => {
      const code = await withRetry(() => client.getCode({ address: a as `0x${string}`, blockNumber: BigInt(analysisBlock) }));
      // EIP-7702 delegated accounts (0xef0100 + address) are externally owned, not contracts.
      return Boolean(code && code !== "0x" && !(code.length === 48 && code.toLowerCase().startsWith("0xef0100")));
    };
    holders = await analyzeHolders({ balances: state.balances, totalSupply: onChainSupply, indexedSupply, creator: creation?.txSender ?? null, isContract });

    const mismatches: { address: string; indexed: string; onChain: string }[] = [];
    const top = holders.topHolders.slice(0, 20);
    const ERC20_BALANCE_ABI = [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] }] as const;
    let checked = 0;
    for (const h of top) {
      try {
        const onChain = await withRetry(() => client.readContract({ address, abi: ERC20_BALANCE_ABI, functionName: "balanceOf", args: [h.address as `0x${string}`], blockNumber: BigInt(analysisBlock) }));
        checked++;
        if (onChain.toString() !== h.balance) mismatches.push({ address: h.address, indexed: h.balance, onChain: onChain.toString() });
      } catch {
        /* a failed read is simply not counted as checked */
      }
    }
    reconciliation = { supplyMatches: indexedSupply === onChainSupply && state.negativeBalanceEvents === 0, indexedSupply: indexedSupply.toString(), onChainSupply: onChainSupply.toString(), checked, mismatches };
  }

  // Risk evaluation
  const ruleCtx: RuleContext = {
    token: { address: address.toLowerCase(), creationBlock: creation?.block ?? null, creator: creation?.txSender ?? null, creationTxHash: creation?.txHash ?? null },
    analysisBlock,
    contract,
    holders,
    reconciliation,
  };
  const evaluated = evaluateRules(ruleCtx);
  const score = computeScore(evaluated);
  const anyUnknown = evaluated.some((e) => e.result.status === "unknown");

  const context: ScanContext = {
    token: { address: address.toLowerCase(), name: contract.erc20.name, symbol: contract.erc20.symbol, decimals: contract.erc20.decimals, totalSupply: supply, creationBlock: creation?.block ?? null, creationTxHash: creation?.txHash ?? null, creator: creation?.txSender ?? null, immediateCreator: creation?.immediateCreator ?? null, creationSource: creation?.source ?? null },
    contract,
    holders,
    indexing: { complete: indexing.complete, stoppedReason: indexing.stoppedReason, lastIndexedBlock: indexing.lastIndexedBlock, inserted: indexing.inserted, skippedLogs: indexing.skippedLogs, rewoundTo: indexing.rewoundTo, ...(indexing.error ? { error: "Indexing stopped early" } : {}) },
    reconciliation,
  };

  await db.transaction(async (tx) => {
    await tx.insert(riskScores).values({ scanId, overall: score.overall === null ? null : score.overall.toFixed(2), level: score.level, coverage: score.coverage.toFixed(4), provisional: score.provisional, criticalOverride: score.criticalOverride, categories: score.categories, methodologyVersion: score.methodologyVersion });
    for (const e of evaluated) {
      const [f] = await tx
        .insert(riskFindings)
        .values({ scanId, ruleId: e.rule.id, category: e.rule.category, status: e.result.status, severity: e.result.severity, confidence: e.result.confidence, title: e.result.title, explanation: e.result.explanation, followUp: e.result.followUp ?? null })
        .returning({ id: riskFindings.id });
      if (e.result.evidence.length) {
        await tx.insert(evidenceRecords).values(e.result.evidence.map((ev) => ({ scanId, findingId: f.id, kind: ev.kind, label: ev.label, data: ev.data ?? null, address: ev.address ?? null, txHash: ev.txHash ?? null, blockNumber: ev.blockNumber ?? null })));
      }
    }
    if (contract.capabilities.length) {
      await tx.insert(contractPermissions).values(contract.capabilities.map((c) => ({ scanId, chainId: cfg.chainId, address: (contract.bytecode.analyzedAddress ?? address).toLowerCase(), capability: c.capability, signature: c.signature, selector: c.selector, detectedVia: c.via, confidence: c.confidence }))).onConflictDoNothing();
    }
    await tx
      .update(scans)
      .set({ status: anyUnknown || !indexing.complete ? "partial" : "completed", finishedAt: sql`now()`, latestIndexedBlock: indexing.lastIndexedBlock, context, errorCode: null, errorMessage: null })
      .where(eq(scans.id, scanId));
  });
}
