import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { evidenceRecords, riskFindings, riskScores, scans, tokens } from "@/db/schema";
import type { ChainConfig } from "@/lib/chain/config";
import { CATEGORY_LABELS } from "@/lib/risk-engine/methodology";
import type { CategoryScore } from "@/lib/risk-engine/score";
import type { EvidenceItem, FindingStatus, Severity, Confidence, Category } from "@/lib/risk-engine/types";
import type { ScanContext } from "./runner";

export type ReportFinding = {
  ruleId: string;
  category: Category;
  status: FindingStatus;
  severity: Severity;
  confidence: Confidence;
  title: string;
  explanation: string;
  followUp: string | null;
  evidence: (EvidenceItem & { id: number })[];
};

export type ScanReport = {
  id: string;
  status: "queued" | "running" | "completed" | "partial" | "failed" | "unsupported";
  network: { chainId: number; name: string };
  token: { address: string; name: string | null; symbol: string | null; decimals: number | null; totalSupply: string | null; creationBlock: number | null; creationTxHash: string | null; creator: string | null; immediateCreator: string | null } | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  analysis: { block: number | null; blockHash: string | null; blockTime: string | null; latestIndexedBlock: number | null };
  methodologyVersion: string | null;
  score: { overall: number | null; level: string; coverage: number; provisional: boolean; criticalOverride: boolean; categories: (CategoryScore & { label: string })[] } | null;
  findings: ReportFinding[];
  holders: ScanContext["holders"];
  indexing: ScanContext["indexing"];
  error: { code: string; message: string } | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function buildReport(db: Db, cfg: ChainConfig, scanId: string): Promise<ScanReport | null> {
  const [scan] = await db.select().from(scans).where(eq(scans.id, scanId));
  if (!scan) return null;
  return assemble(db, cfg, scan);
}

/** Latest scan for a token regardless of status (so a running scan is visible). */
export async function getLatestReport(db: Db, cfg: ChainConfig, address: string): Promise<ScanReport | null> {
  const [scan] = await db
    .select()
    .from(scans)
    .where(and(eq(scans.chainId, cfg.chainId), eq(scans.tokenAddress, address.toLowerCase())))
    .orderBy(desc(scans.requestedAt))
    .limit(1);
  return scan ? assemble(db, cfg, scan) : null;
}

/** Latest scan that produced a result (completed, partial or unsupported). */
export async function getLatestResultReport(db: Db, cfg: ChainConfig, address: string): Promise<ScanReport | null> {
  const [scan] = await db
    .select()
    .from(scans)
    .where(and(eq(scans.chainId, cfg.chainId), eq(scans.tokenAddress, address.toLowerCase()), inArray(scans.status, ["completed", "partial"])))
    .orderBy(desc(scans.requestedAt))
    .limit(1);
  return scan ? assemble(db, cfg, scan) : null;
}

async function assemble(db: Db, cfg: ChainConfig, scan: typeof scans.$inferSelect): Promise<ScanReport> {
  const ctx = (scan.context ?? null) as ScanContext | null;
  const [score] = await db.select().from(riskScores).where(eq(riskScores.scanId, scan.id));
  const findings = await db.select().from(riskFindings).where(eq(riskFindings.scanId, scan.id)).orderBy(asc(riskFindings.ruleId));
  const evidence = findings.length ? await db.select().from(evidenceRecords).where(eq(evidenceRecords.scanId, scan.id)).orderBy(asc(evidenceRecords.id)) : [];
  const [tokenRow] = await db.select().from(tokens).where(and(eq(tokens.chainId, scan.chainId), eq(tokens.address, scan.tokenAddress)));

  return {
    id: scan.id,
    status: scan.status as ScanReport["status"],
    network: { chainId: cfg.chainId, name: cfg.name },
    token: ctx?.token
      ? { ...ctx.token }
      : { address: scan.tokenAddress, name: tokenRow?.name ?? null, symbol: tokenRow?.symbol ?? null, decimals: tokenRow?.decimals ?? null, totalSupply: tokenRow?.totalSupply ?? null, creationBlock: tokenRow?.creationBlock ?? null, creationTxHash: tokenRow?.creationTxHash ?? null, creator: tokenRow?.creatorAddress ?? null, immediateCreator: null },
    requestedAt: scan.requestedAt.toISOString(),
    startedAt: iso(scan.startedAt),
    finishedAt: iso(scan.finishedAt),
    analysis: { block: scan.analysisBlock, blockHash: scan.analysisBlockHash, blockTime: iso(scan.analysisBlockTime), latestIndexedBlock: scan.latestIndexedBlock },
    methodologyVersion: scan.methodologyVersion,
    score: score
      ? {
          overall: score.overall === null ? null : Number(score.overall),
          level: score.level,
          coverage: Number(score.coverage),
          provisional: score.provisional,
          criticalOverride: score.criticalOverride,
          categories: (score.categories as CategoryScore[]).map((c) => ({ ...c, label: CATEGORY_LABELS[c.category] })),
        }
      : null,
    findings: findings.map((f) => ({
      ruleId: f.ruleId,
      category: f.category as Category,
      status: f.status as FindingStatus,
      severity: f.severity as Severity,
      confidence: f.confidence as Confidence,
      title: f.title,
      explanation: f.explanation,
      followUp: f.followUp,
      evidence: evidence
        .filter((e) => e.findingId === f.id)
        .map((e) => ({
          id: e.id,
          kind: e.kind as EvidenceItem["kind"],
          label: e.label,
          ...(e.address ? { address: e.address } : {}),
          ...(e.txHash ? { txHash: e.txHash } : {}),
          ...(e.blockNumber != null ? { blockNumber: e.blockNumber } : {}),
          ...(e.data ? { data: e.data as EvidenceItem["data"] } : {}),
        })),
    })),
    holders: ctx?.holders ?? null,
    indexing: ctx?.indexing ?? null,
    error: scan.errorCode ? { code: scan.errorCode, message: scan.errorMessage ?? "" } : null,
  };
}
