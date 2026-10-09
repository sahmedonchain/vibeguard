import { closeDb, getDb } from "@/db/client";
import { getChainConfig } from "@/lib/chain/config";
import { assertChainId, createChainClient } from "@/lib/chain/client";
import { getEnv } from "@/lib/env";
import { isEvmAddress } from "@/lib/chain/explorer";
import { createScan, claimNextScan } from "@/lib/scans/queue";
import { buildReport } from "@/lib/scans/report";
import { runScan } from "@/lib/scans/runner";

/** Usage: pnpm scan <tokenAddress>  — enqueues a scan and runs it in this process, then prints the report. */
async function main() {
  const address = process.argv[2];
  if (!address || !isEvmAddress(address)) {
    console.error("Usage: pnpm scan <0xTokenAddress>");
    process.exit(2);
  }
  const cfg = getChainConfig();
  const db = getDb();
  const client = createChainClient(cfg);
  await assertChainId(client, cfg.chainId);
  const { scan, disposition } = await createScan(db, cfg, address);
  console.error(`scan ${scan.id} (${disposition})`);
  if (disposition === "created" || disposition === "active") {
    const claimed = await claimNextScan(db);
    if (claimed) await runScan(db, client, cfg, getEnv(), claimed.id);
  }
  console.log(JSON.stringify(await buildReport(db, cfg, scan.id), null, 2));
  await closeDb();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
