import { z } from "zod";

/**
 * Optional Blockscout v2 adapter. Every function returns null when the explorer is unavailable
 * so callers degrade to RPC-only analysis. Responses are untrusted input and validated.
 */
const hex = z.string().regex(/^0x[0-9a-fA-F]+$/);

const addressInfoSchema = z.object({
  creator_address_hash: hex.nullish(),
  creation_transaction_hash: hex.nullish(),
  is_contract: z.boolean().optional(),
});

const smartContractSchema = z.object({
  is_verified: z.boolean().nullish(),
  name: z.string().nullish(),
  abi: z.array(z.record(z.string(), z.unknown())).nullish(),
});

export type ExplorerAddressInfo = {
  creator: `0x${string}` | null;
  creationTxHash: `0x${string}` | null;
};
export type ExplorerContractInfo = { verified: boolean; name: string | null; abi: unknown[] | null };

async function getJson(url: string, timeoutMs = 10_000): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchAddressInfo(baseUrl: string, address: string): Promise<ExplorerAddressInfo | null> {
  const json = await getJson(`${baseUrl}/api/v2/addresses/${address}`);
  const parsed = addressInfoSchema.safeParse(json);
  if (!parsed.success) return null;
  return {
    creator: (parsed.data.creator_address_hash as `0x${string}` | null | undefined) ?? null,
    creationTxHash: (parsed.data.creation_transaction_hash as `0x${string}` | null | undefined) ?? null,
  };
}

export async function fetchContractInfo(baseUrl: string, address: string): Promise<ExplorerContractInfo | null> {
  const json = await getJson(`${baseUrl}/api/v2/smart-contracts/${address}`);
  const parsed = smartContractSchema.safeParse(json);
  if (!parsed.success) return null;
  return { verified: parsed.data.is_verified === true, name: parsed.data.name ?? null, abi: parsed.data.abi ?? null };
}

/* ---- Address history (Blockscout v2). Page cursors come from the explorer and are passed back as-is. ---- */

const addrRef = z.object({ hash: hex, is_contract: z.boolean().nullish() });
const decimalString = z.string().regex(/^\d+$/);

const txSchema = z.object({
  hash: hex,
  block_number: z.number().int().nonnegative(),
  timestamp: z.string(),
  from: addrRef,
  to: addrRef.nullish(),
  value: decimalString,
  method: z.string().nullish(),
  status: z.string().nullish(),
  created_contract: addrRef.nullish(),
});
const txPageSchema = z.object({ items: z.array(txSchema), next_page_params: z.record(z.string(), z.unknown()).nullish() });

export type ExplorerTx = {
  hash: string;
  block: number;
  /** Unix ms. */
  time: number;
  from: string;
  to: string | null;
  fromIsContract: boolean | null;
  toIsContract: boolean | null;
  value: bigint;
  method: string | null;
  ok: boolean;
  createdContract: string | null;
};

const lc = (s: string) => s.toLowerCase();

function toTx(t: z.infer<typeof txSchema>): ExplorerTx | null {
  const time = Date.parse(t.timestamp);
  if (!Number.isFinite(time)) return null;
  return {
    hash: lc(t.hash),
    block: t.block_number,
    time,
    from: lc(t.from.hash),
    to: t.to ? lc(t.to.hash) : null,
    fromIsContract: t.from.is_contract ?? null,
    toIsContract: t.to?.is_contract ?? null,
    value: BigInt(t.value),
    method: t.method ? t.method.toLowerCase() : null,
    ok: t.status ? t.status === "ok" : true,
    createdContract: t.created_contract ? lc(t.created_contract.hash) : null,
  };
}

export type TxPage = { items: ExplorerTx[]; truncated: boolean };

function cursorQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) q.set(k, String(v));
  return q.toString();
}

/**
 * Reads up to `maxPages` pages (50 items each) of an address's transactions.
 * `truncated` is true when the explorer reports more pages than were read.
 * Returns null when the first page cannot be read, so callers treat the data as unavailable, not empty.
 */
export async function fetchAddressTransactions(
  baseUrl: string,
  address: string,
  opts: { order: "asc" | "desc"; filter?: "to" | "from"; maxPages?: number },
): Promise<TxPage | null> {
  const items: ExplorerTx[] = [];
  let cursor: Record<string, unknown> | null = null;
  const maxPages = opts.maxPages ?? 1;
  for (let page = 0; page < maxPages; page++) {
    const q = cursorQuery({ sort: "block_number", order: opts.order, ...(opts.filter ? { filter: opts.filter } : {}), ...(cursor ?? {}) });
    const json = await getJson(`${baseUrl}/api/v2/addresses/${address}/transactions?${q}`);
    const parsed = txPageSchema.safeParse(json);
    if (!parsed.success) return page === 0 ? null : { items, truncated: true };
    for (const t of parsed.data.items) {
      const tx = toTx(t);
      if (tx) items.push(tx);
    }
    cursor = parsed.data.next_page_params ?? null;
    if (!cursor) return { items, truncated: false };
  }
  return { items, truncated: true };
}

const countersSchema = z.object({ transactions_count: decimalString.nullish(), token_transfers_count: decimalString.nullish() });

export async function fetchAddressCounters(baseUrl: string, address: string): Promise<{ transactions: number | null; tokenTransfers: number | null } | null> {
  const parsed = countersSchema.safeParse(await getJson(`${baseUrl}/api/v2/addresses/${address}/counters`));
  if (!parsed.success) return null;
  return {
    transactions: parsed.data.transactions_count != null ? Number(parsed.data.transactions_count) : null,
    tokenTransfers: parsed.data.token_transfers_count != null ? Number(parsed.data.token_transfers_count) : null,
  };
}

const tokenTransferSchema = z.object({
  block_number: z.number().int().nonnegative(),
  timestamp: z.string(),
  transaction_hash: hex,
  from: addrRef,
  to: addrRef,
  token: z.object({ address_hash: hex, name: z.string().nullish(), symbol: z.string().nullish(), type: z.string().nullish() }),
  total: z.object({ value: decimalString.nullish() }).nullish(),
});
const tokenTransferPageSchema = z.object({ items: z.array(tokenTransferSchema), next_page_params: z.record(z.string(), z.unknown()).nullish() });

export type ExplorerTokenTransfer = {
  txHash: string;
  block: number;
  time: number;
  from: string;
  to: string;
  token: string;
  tokenName: string | null;
  tokenSymbol: string | null;
};

/** ERC-20 transfers touching the address, newest first. Null when unavailable. */
export async function fetchAddressTokenTransfers(baseUrl: string, address: string, maxPages = 2): Promise<{ items: ExplorerTokenTransfer[]; truncated: boolean } | null> {
  const items: ExplorerTokenTransfer[] = [];
  let cursor: Record<string, unknown> | null = null;
  for (let page = 0; page < maxPages; page++) {
    const q = cursorQuery({ type: "ERC-20", ...(cursor ?? {}) });
    const parsed = tokenTransferPageSchema.safeParse(await getJson(`${baseUrl}/api/v2/addresses/${address}/token-transfers?${q}`));
    if (!parsed.success) return page === 0 ? null : { items, truncated: true };
    for (const t of parsed.data.items) {
      const time = Date.parse(t.timestamp);
      if (!Number.isFinite(time)) continue;
      items.push({ txHash: lc(t.transaction_hash), block: t.block_number, time, from: lc(t.from.hash), to: lc(t.to.hash), token: lc(t.token.address_hash), tokenName: t.token.name ?? null, tokenSymbol: t.token.symbol ?? null });
    }
    cursor = parsed.data.next_page_params ?? null;
    if (!cursor) return { items, truncated: false };
  }
  return { items, truncated: true };
}

const txDetailSchema = z.object({
  token_transfers: z
    .array(z.object({ type: z.string().nullish(), from: addrRef, token: z.object({ address_hash: hex, type: z.string().nullish() }) }))
    .nullish(),
  token_transfers_overflow: z.boolean().nullish(),
});

/**
 * ERC-20 contracts whose supply was minted (transfer from the zero address) in a transaction.
 * This is how a token created through a launchpad contract is attributed to the transaction sender.
 * Null when the transaction cannot be read.
 */
export async function fetchMintedTokens(baseUrl: string, txHash: string): Promise<string[] | null> {
  const parsed = txDetailSchema.safeParse(await getJson(`${baseUrl}/api/v2/transactions/${txHash}`));
  if (!parsed.success) return null;
  const zero = "0x0000000000000000000000000000000000000000";
  const minted = (parsed.data.token_transfers ?? []).filter((t) => lc(t.from.hash) === zero && t.token.type === "ERC-20").map((t) => lc(t.token.address_hash));
  return [...new Set(minted)];
}
