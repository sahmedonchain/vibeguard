import { keccak256, toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import { EIP1967_ADMIN_SLOT, EIP1967_BEACON_SLOT, EIP1967_IMPLEMENTATION_SLOT, addressFromSlot, parseMinimalProxy } from "@/lib/contracts/proxy";
import { SELECTOR_TABLE, abiFunctionSignatures, extractPush4Selectors, matchSelectors } from "@/lib/contracts/selectors";

describe("selectors", () => {
  it("computes well-known selectors", () => {
    const by = Object.fromEntries(SELECTOR_TABLE.map((e) => [e.signature, e.selector]));
    expect(by["mint(address,uint256)"]).toBe("0x40c10f19");
    expect(by["pause()"]).toBe("0x8456cb59");
    expect(by["unpause()"]).toBe("0x3f4ba83a");
    expect(by["transferOwnership(address)"]).toBe("0xf2fde38b");
    expect(by["owner()"]).toBe("0x8da5cb5b");
    expect(by["upgradeTo(address)"]).toBe("0x3659cfe6");
  });
  it("has no duplicate selectors", () => {
    expect(new Set(SELECTOR_TABLE.map((e) => e.selector)).size).toBe(SELECTOR_TABLE.length);
  });
  it("finds PUSH4 selectors and skips push data", () => {
    // PUSH4 40c10f19 ... ; then PUSH32 whose data contains 0x63 bytes that must not be parsed as PUSH4.
    const code = "0x6340c10f19" + "5f" + "7f" + "63".repeat(32) + "638456cb59";
    const found = extractPush4Selectors(code);
    expect(found.has("0x40c10f19")).toBe(true);
    expect(found.has("0x8456cb59")).toBe(true);
    expect(found.size).toBe(2);
  });
  it("tolerates truncated bytecode", () => {
    expect(extractPush4Selectors("0x6340c1").size).toBe(0);
    expect(extractPush4Selectors("0x").size).toBe(0);
  });
  it("matches capabilities", () => {
    const m = matchSelectors(new Set([toFunctionSelector("mint(address,uint256)"), toFunctionSelector("pause()")]));
    expect(m.map((x) => x.capability).sort()).toEqual(["mint", "pause"]);
  });
  it("derives signatures from an ABI including tuples", () => {
    const sigs = abiFunctionSignatures([
      { type: "function", name: "mint", inputs: [{ type: "address" }, { type: "uint256" }] },
      { type: "function", name: "f", inputs: [{ type: "tuple[]", components: [{ type: "uint256" }, { type: "address" }] }] },
      { type: "event", name: "X", inputs: [] },
    ]);
    expect(sigs).toEqual(["mint(address,uint256)", "f((uint256,address)[])"]);
  });
});

describe("proxy", () => {
  it("derives EIP-1967 slots from their labels", () => {
    expect(EIP1967_IMPLEMENTATION_SLOT).toBe("0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");
    expect(EIP1967_ADMIN_SLOT).toBe("0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103");
    expect(EIP1967_BEACON_SLOT).toBe("0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50");
    expect(keccak256("0x")).toBeTruthy();
  });
  it("parses EIP-1167 minimal proxies", () => {
    const impl = "bebebebebebebebebebebebebebebebebebebebe";
    const code = `0x363d3d373d3d3d363d73${impl}5af43d82803e903d91602b57fd5bf3`;
    expect(parseMinimalProxy(code)).toBe(`0x${impl}`);
    expect(parseMinimalProxy("0x6080604052")).toBeNull();
    expect(parseMinimalProxy(`0x363d3d373d3d3d363d73${impl}00`)).toBeNull();
  });
  it("reads addresses from storage words", () => {
    expect(addressFromSlot("0x" + "0".repeat(64))).toBeNull();
    expect(addressFromSlot("0x" + "0".repeat(24) + "ab".repeat(20))).toBe("0x" + "ab".repeat(20));
    expect(addressFromSlot(undefined)).toBeNull();
  });
});
