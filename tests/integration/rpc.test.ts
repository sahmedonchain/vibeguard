import { describe, expect, it } from "vitest";
import { getChainConfig } from "@/lib/chain/config";
import { assertChainId, createChainClient } from "@/lib/chain/client";
import { analyzeContract } from "@/lib/contracts/analyze";
import { findCreation } from "@/lib/indexing/creation";
import { getLogsAdaptive } from "@/lib/indexing/logs";
import { TRANSFER_TOPIC, decodeTransferLogs } from "@/lib/indexing/transfers";

/** Live Robinhood Chain Testnet. Token "VIBE COOK" is an immutable, already-deployed contract. */
const TOKEN = "0xb2b489a0bb87bc2e8a1c11913c66ac0ac040e344" as const;
const CREATION_BLOCK = 126101084;
const cfg = getChainConfig();
const client = createChainClient(cfg);

describe("live testnet RPC", () => {
  it("serves the configured chain", async () => {
    await assertChainId(client, cfg.chainId);
    expect(await client.getBlockNumber()).toBeGreaterThan(CREATION_BLOCK);
  });

  it("reads ERC-20 data and detects no admin capabilities for a plain launchpad token", async () => {
    const block = Number(await client.getBlockNumber()) - 2;
    const a = await analyzeContract(client, cfg.explorerUrl, TOKEN, block);
    expect(a.hasCode).toBe(true);
    expect(a.erc20).toMatchObject({ isErc20Like: true, symbol: "COOK", decimals: 18, totalSupply: "1000000000000000000000000000" });
    expect(a.proxy.upgradeable).toBe(false);
    expect(a.failures).toEqual([]);
  });

  it("finds the creation block via explorer + RPC receipt", async () => {
    const c = await findCreation(client, cfg.explorerUrl, TOKEN, Number(await client.getBlockNumber()));
    expect(c?.block).toBe(CREATION_BLOCK);
    expect(c?.txSender).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("fetches and decodes Transfer logs over a wide address-filtered range", async () => {
    const logs = await getLogsAdaptive(client, { address: TOKEN, topics: [TRANSFER_TOPIC], fromBlock: CREATION_BLOCK, toBlock: CREATION_BLOCK + 300_000, maxRange: cfg.getLogsAddressMaxBlockRange });
    const { transfers } = decodeTransferLogs(logs);
    expect(transfers.length).toBeGreaterThan(0);
    // First event is the mint of the full supply from the zero address.
    expect(transfers[0].from).toBe("0x0000000000000000000000000000000000000000");
    expect(transfers[0].value).toBe(10n ** 27n);
  });

  it("surfaces provider range rejections so the adaptive splitter can act", async () => {
    // Unfiltered 100k-block query is rejected by the public RPC (observed limit 30000).
    const tip = Number(await client.getBlockNumber());
    await expect(client.request({ method: "eth_getLogs", params: [{ fromBlock: `0x${(tip - 100_000).toString(16)}`, toBlock: `0x${tip.toString(16)}`, topics: [TRANSFER_TOPIC] }] })).rejects.toThrow(/30000|exceeds limit/);
  });
});
