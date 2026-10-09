import { describe, expect, it } from "vitest";
import { getCapabilities } from "@/lib/chain/capabilities";
import { buildChain } from "@/lib/chain/client";
import { parseChainConfig } from "@/lib/chain/config";
import { explorerUrls, isEvmAddress, isTxHash } from "@/lib/chain/explorer";

describe("chain config", () => {
  it("defaults to verified Robinhood Chain Testnet values", () => {
    const c = parseChainConfig({});
    expect(c.chainId).toBe(46630);
    expect(c.rpcHttpUrl).toBe("https://rpc.testnet.chain.robinhood.com");
    expect(c.explorerUrl).toBe("https://explorer.testnet.chain.robinhood.com");
    expect(c.nativeCurrency.symbol).toBe("ETH");
    expect(c.rpcWsUrl).toBeUndefined();
    expect(c.vibevibeFactory).toBeUndefined();
  });
  it("treats empty env strings as unset", () => {
    const c = parseChainConfig({ VIBEVIBE_RPC_WS_URL: "", VIBEVIBE_FACTORY_ADDRESS: "" });
    expect(c.rpcWsUrl).toBeUndefined();
    expect(c.vibevibeFactory).toBeUndefined();
  });
  it("accepts overrides and strips trailing slash", () => {
    const addr = "0x" + "a".repeat(40);
    const c = parseChainConfig({ VIBEVIBE_EXPLORER_URL: "https://x.example/", VIBEVIBE_FACTORY_ADDRESS: addr, VIBEVIBE_FACTORY_START_BLOCK: "5" });
    expect(c.explorerUrl).toBe("https://x.example");
    expect(c.vibevibeFactory).toEqual({ address: addr, startBlock: 5 });
  });
  it("rejects invalid values", () => {
    expect(() => parseChainConfig({ VIBEVIBE_FACTORY_ADDRESS: "0x123" })).toThrow();
    expect(() => parseChainConfig({ VIBEVIBE_RPC_HTTP_URL: "not a url" })).toThrow();
  });
  it("builds a viem chain from config", () => {
    const chain = buildChain(parseChainConfig({}));
    expect(chain.id).toBe(46630);
    expect(chain.rpcUrls.default.http[0]).toBe("https://rpc.testnet.chain.robinhood.com");
  });
});

describe("capabilities", () => {
  it("marks unverified facts unresolved", () => {
    const caps = Object.fromEntries(getCapabilities(parseChainConfig({})).map((c) => [c.key, c.status]));
    expect(caps.factory).toBe("unresolved");
    expect(caps.ws).toBe("unresolved");
    expect(caps["rate-limits"]).toBe("unresolved");
    expect(caps.evm).toBe("verified");
  });
});

describe("explorer", () => {
  const u = explorerUrls("https://explorer.testnet.chain.robinhood.com/");
  it("formats Blockscout URLs", () => {
    expect(u.address("0xabc")).toBe("https://explorer.testnet.chain.robinhood.com/address/0xabc");
    expect(u.tx("0xdef")).toBe("https://explorer.testnet.chain.robinhood.com/tx/0xdef");
    expect(u.token("0xabc")).toBe("https://explorer.testnet.chain.robinhood.com/token/0xabc");
    expect(u.block(5)).toBe("https://explorer.testnet.chain.robinhood.com/block/5");
  });
  it("validates addresses and tx hashes", () => {
    expect(isEvmAddress("0x3c1b3e4383f3Fa90b314dD451332c86b1C779725")).toBe(true);
    expect(isEvmAddress("0x3c1b")).toBe(false);
    expect(isEvmAddress("<script>")).toBe(false);
    expect(isTxHash("0x" + "a".repeat(64))).toBe(true);
    expect(isTxHash("0x" + "a".repeat(63))).toBe(false);
  });
});
