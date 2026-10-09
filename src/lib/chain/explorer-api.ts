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
