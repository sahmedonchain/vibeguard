import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { getChainConfig } from "@/lib/chain/config";
import { createChainClient } from "@/lib/chain/client";
import { newRequestId } from "@/lib/api/respond";
import { NextResponse } from "next/server";

/** Readiness: database reachable and RPC serves the configured chain. No internals are exposed. */
export async function GET() {
  const requestId = newRequestId();
  const cfg = getChainConfig();
  let database: "ok" | "unconfigured" | "error" = "unconfigured";
  if (isDatabaseConfigured()) {
    database = await getDb().execute(sql`select 1`).then(() => "ok" as const, () => "error" as const);
  }
  const rpc = await createChainClient(cfg).getChainId().then((id) => (id === cfg.chainId ? ("ok" as const) : ("wrong_chain" as const)), () => "error" as const);
  const healthy = database !== "error" && rpc === "ok";
  return NextResponse.json({ status: healthy ? "ok" : "degraded", checks: { database, rpc }, chainId: cfg.chainId, requestId }, { status: healthy ? 200 : 503, headers: { "cache-control": "no-store", "x-request-id": requestId } });
}
