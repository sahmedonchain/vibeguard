import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RiskScore, riskBand } from "@/components/shared/risk-score";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { shortenAddress } from "@/components/shared/address-display";
import { FreshnessLabel } from "@/components/shared/freshness-label";
import { ROUTE_LIST } from "@/lib/routes";

describe("risk score", () => {
  it("bands", () => {
    expect(riskBand(0)).toBe("low");
    expect(riskBand(25)).toBe("medium");
    expect(riskBand(50)).toBe("high");
    expect(riskBand(75)).toBe("critical");
  });
  it("renders null score as N/A, never safe", () => {
    const html = renderToStaticMarkup(<RiskScore score={null} />);
    expect(html).toContain("N/A");
    expect(html).not.toMatch(/low risk/i);
  });
  it("shows coverage separately", () => {
    expect(renderToStaticMarkup(<RiskScore score={10} coverage={0.4} />)).toContain("Coverage 40%");
  });
});

describe("shared components", () => {
  it("severity badge renders label", () => {
    expect(renderToStaticMarkup(<SeverityBadge severity="critical" />)).toContain("critical");
  });
  it("shortens addresses", () => {
    expect(shortenAddress("0x3c1b3e4383f3Fa90b314dD451332c86b1C779725")).toBe("0x3c1b…9725");
  });
  it("freshness states unknown when empty", () => {
    expect(renderToStaticMarkup(<FreshnessLabel />)).toContain("unknown");
    expect(renderToStaticMarkup(<FreshnessLabel blockNumber={5} />)).toContain("Block 5");
  });
});

describe("routes", () => {
  it("has unique paths and valid phases", () => {
    const paths = ROUTE_LIST.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const r of ROUTE_LIST) expect(r.phase).toBeGreaterThanOrEqual(1);
  });
});
