import { closeDb, getDb } from "@/db/client";
import { getChainConfig } from "@/lib/chain/config";
import { assertChainId, createChainClient } from "@/lib/chain/client";
import { getEnv } from "@/lib/env";
import { claimNextScan } from "@/lib/scans/queue";
import { runScan } from "@/lib/scans/runner";
import { ensureReferenceData } from "@/lib/scans/setup";

/**
 * Long-running scan worker. Runs outside Next.js/serverless.
 * Polls the DB-backed queue; one scan at a time (bounded concurrency).
 */
async function main() {
  const cfg = getChainConfig();
  const env = getEnv();
  const db = getDb();
  const client = createChainClient(cfg);
  await assertChainId(client, cfg.chainId);
  await ensureReferenceData(db, cfg);
  console.log(`[worker] started chain=${cfg.chainId} poll=${env.INDEXER_POLL_INTERVAL_MS}ms`);

  let stopping = false;
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { stopping = true; console.log(`[worker] ${sig}, finishing current scan`); });

  while (!stopping) {
    try {
      const scan = await claimNextScan(db);
      if (!scan) {
        await new Promise((r) => setTimeout(r, env.INDEXER_POLL_INTERVAL_MS));
        continue;
      }
      console.log(`[worker] scan ${scan.id} token=${scan.tokenAddress}`);
      await runScan(db, client, cfg, env, scan.id);
      console.log(`[worker] scan ${scan.id} done`);
    } catch (err) {
      console.error("[worker] loop error:", err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, env.INDEXER_POLL_INTERVAL_MS * 2));
    }
  }
  await closeDb();
}

main().catch((err) => {
  console.error("[worker] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
