import Link from "next/link";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { AddressDisplay } from "@/components/shared/address-display";
import { FreshnessLabel } from "@/components/shared/freshness-label";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { RiskScore } from "@/components/shared/risk-score";
import { ShareButton } from "@/components/shared/share-button";
import { BlockLink, TxLink } from "@/components/shared/tx-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SEVERITIES } from "@/lib/risk-engine/types";
import type { ScanReport } from "@/lib/scans/report";
import { safeText } from "@/lib/text";
import { CreationsList, CreatorFacts } from "./creator-facts";
import { FindingCard } from "./finding-card";
import { HolderHistoryView } from "./holder-extras";
import { HoldersChart, type ChartHolder } from "./holders-chart";
import { isProvisional, type RiskLevel } from "@/lib/risk-engine/methodology";

const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;
const sevRank = (s: string) => SEVERITIES.indexOf(s as (typeof SEVERITIES)[number]);

function formatSupply(raw: string | null, decimals: number | null): string {
  if (raw == null) return "Unknown";
  const d = decimals ?? 0;
  const s = raw.padStart(d + 1, "0");
  const whole = d ? s.slice(0, -d) : s;
  return BigInt(whole).toLocaleString("en-US");
}

export function ReportView({ report }: { report: ScanReport }) {
  const tokenName = safeText(report.token?.name) || "Unnamed token";
  const symbol = safeText(report.token?.symbol, 16);
  const detected = report.findings.filter((f) => f.status === "detected").sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || a.ruleId.localeCompare(b.ruleId));
  const clear = report.findings.filter((f) => f.status === "not_detected");
  const unchecked = report.findings.filter((f) => f.status === "unknown");
  const score = report.score;
  const chart: ChartHolder[] = (report.holders?.topHolders ?? []).slice(0, 10).map((h, i) => ({ label: `#${i + 1}`, address: h.address, percent: h.bps / 100, cls: h.class }));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{tokenName}{symbol && <span className="ml-2 text-muted-foreground">({symbol})</span>}</h1>
          <Badge className="text-muted-foreground">{report.network.name}</Badge>
          <Badge className={report.status === "completed" ? "text-sev-low" : "text-sev-medium"}>Scan {report.status}</Badge>
        </div>
        {report.token && <AddressDisplay address={report.token.address} full kind="contract" />}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FreshnessLabel blockNumber={report.analysis.block} asOf={report.analysis.blockTime} />
          {report.methodologyVersion && <Link href="/methodology" className="text-xs text-muted-foreground underline">Methodology v{report.methodologyVersion}</Link>}
          <ShareButton />
        </div>
      </header>

      {report.status === "unsupported" && (
        <Card className="border-sev-medium/50">
          <h2 className="font-medium">This address cannot be scanned</h2>
          <p className="mt-1 text-sm text-muted-foreground">{report.error?.message}</p>
          {report.token && <p className="mt-2 text-sm">If this is a wallet, open its <Link className="underline" href={`/wallet/${report.token.address}`}>wallet page</Link>.</p>}
        </Card>
      )}

      {report.status === "failed" && (
        <Card className="border-sev-critical/50" role="alert">
          <h2 className="font-medium">The scan failed</h2>
          <p className="mt-1 text-sm text-muted-foreground">{report.error?.message || "The scan did not complete."} No risk assessment is available. This is not a sign that the token is safe.</p>
        </Card>
      )}

      {score && (
        <section aria-labelledby="score-h" className="space-y-4">
          <h2 id="score-h" className="sr-only">Risk score</h2>
          {isProvisional(score.coverage) && (
            <div role="note" className="flex gap-3 rounded-lg border border-sev-medium/50 bg-sev-medium/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-sev-medium" aria-hidden />
              <p><strong>Provisional result.</strong> Only {Math.round(score.coverage * 100)}% of the methodology could be evaluated. Categories without data are <strong>not</strong> assumed safe. This is not a complete security assessment.</p>
            </div>
          )}
          {score.criticalOverride && (
            <div role="alert" className="flex gap-3 rounded-lg border border-sev-critical/60 bg-sev-critical/10 p-4 text-sm">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-sev-critical" aria-hidden />
              <p><strong>Critical finding.</strong> At least one critical finding was detected. The risk level is set to critical regardless of the aggregate score.</p>
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
            <RiskScore score={score.overall} coverage={score.coverage} level={score.level as RiskLevel} />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                The score runs from 0 to 100. A higher score means more detected risk, not a better token.{" "}
                <InfoTooltip text="It combines weighted categories using only checks that returned a result. Missing data lowers coverage; it never lowers risk." />
              </p>
              <p>It reflects automated on-chain checks at one block. It does not guarantee safety, predict price, or replace an audit.</p>
              <p><Link href="/methodology" className="underline">How the score is calculated</Link></p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Risk by category</caption>
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr><th scope="col" className="px-3 py-2">Category</th><th scope="col" className="px-3 py-2">Weight</th><th scope="col" className="px-3 py-2">Risk</th><th scope="col" className="px-3 py-2">Coverage</th></tr>
              </thead>
              <tbody>
                {score.categories.map((c) => (
                  <tr key={c.category} className="border-t border-border align-top">
                    <th scope="row" className="px-3 py-2 font-medium">{c.label}{c.unavailableReason && <p className="mt-0.5 text-xs font-normal text-muted-foreground">{c.unavailableReason}</p>}</th>
                    <td className="px-3 py-2 tabular-nums">{Math.round(c.weight * 100)}%</td>
                    <td className="px-3 py-2 tabular-nums">{c.score === null ? <span className="text-muted-foreground">Not assessed</span> : c.score.toFixed(1)}</td>
                    <td className="px-3 py-2 tabular-nums">{Math.round(c.coverage * 100)}%{c.unknown.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({c.unknown.length} unchecked)</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {report.findings.length > 0 && (
        <section aria-labelledby="findings-h" className="space-y-4">
          <h2 id="findings-h" className="text-xl font-semibold">Findings</h2>
          {detected.length === 0 ? (
            <p className="text-sm text-muted-foreground">No findings were detected by the checks that ran. See below for what was and was not checked.</p>
          ) : (
            <div className="space-y-3">{detected.map((f) => <FindingCard key={f.ruleId} finding={f} />)}</div>
          )}
          {unchecked.length > 0 && (
            <details open>
              <summary className="cursor-pointer text-sm font-medium">Could not be checked ({unchecked.length})</summary>
              <div className="mt-3 space-y-3">{unchecked.map((f) => <FindingCard key={f.ruleId} finding={f} />)}</div>
            </details>
          )}
          {clear.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium">Checked, nothing detected ({clear.length})</summary>
              <div className="mt-3 space-y-3">{clear.map((f) => <FindingCard key={f.ruleId} finding={f} />)}</div>
            </details>
          )}
        </section>
      )}

      {report.holders && (
        <section aria-labelledby="holders-h" className="space-y-4">
          <h2 id="holders-h" className="text-xl font-semibold">Holders</h2>
          <p className="text-sm text-muted-foreground">
            {report.holders.holderCount.toLocaleString("en-US")} addresses hold a balance. Shares are of total supply. Contracts and burn addresses are excluded from concentration figures and listed below, not hidden.
            {report.holders.lowerBound && " Only the largest 50 holders were classified, so shares are lower bounds."}
          </p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Top 1 wallet", pct(report.holders.eoaTop1Bps)],
              ["Top 5 wallets", pct(report.holders.eoaTop5Bps)],
              ["Top 10 wallets", pct(report.holders.eoaTop10Bps)],
              ["Top 20 wallets", pct(report.holders.eoaTop20Bps)],
              ["Held by contracts", pct(report.holders.exclusions.contractBps)],
              ["Burn address", pct(report.holders.exclusions.burnBps)],
              ["Creator", report.holders.creatorBps == null ? "Unknown" : pct(report.holders.creatorBps)],
              ["Total supply", formatSupply(report.holders.totalSupply, report.token?.decimals ?? null)],
            ].map(([k, v]) => (
              <Card key={k} className="p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd></Card>
            ))}
          </dl>
          <HoldersChart data={chart} />
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">Largest holders</caption>
              <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th scope="col" className="px-3 py-2">#</th><th scope="col" className="px-3 py-2">Address</th><th scope="col" className="px-3 py-2">Type</th><th scope="col" className="px-3 py-2 text-right">Share</th></tr></thead>
              <tbody>
                {report.holders.topHolders.slice(0, 20).map((h, i) => (
                  <tr key={h.address} className="border-t border-border">
                    <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2"><AddressDisplay address={h.address} /></td>
                    <td className="px-3 py-2"><span className="capitalize">{h.class === "eoa" ? "wallet" : h.class}</span>{h.label && <span className="block text-xs text-muted-foreground">{h.label}</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(h.bps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Contract holders are labelled only when the address equals this token or the contract that created it. Pools, bonding curves and vaults cannot be identified because no verified DEX or launchpad registry exists for this network, so no balance is reported as a &quot;known liquidity pool&quot;.
          </p>
          {report.holderHistory && <HolderHistoryView history={report.holderHistory} />}
        </section>
      )}

      {report.creator && report.token?.creator && (
        <section aria-labelledby="creator-h" className="space-y-3">
          <h2 id="creator-h" className="text-xl font-semibold">Creator</h2>
          <Card className="space-y-4">
            <CreatorFacts facts={report.creator} />
            {report.creator.explorerAvailable && <CreationsList facts={report.creator} />}
            {report.creator.sellDown && (
              <p className="text-sm">Creator&apos;s share of supply: peak {pct(report.creator.sellDown.peakBps)}, now {pct(report.creator.sellDown.currentBps)}.</p>
            )}
            <p className="text-sm"><Link className="underline" href={`/creator/${report.token.creator}`}>Full creator reputation</Link></p>
          </Card>
        </section>
      )}

      {report.sybil && report.sybil.clusters.length > 0 && (
        <section aria-labelledby="coord-h" className="space-y-3">
          <h2 id="coord-h" className="text-xl font-semibold">Possible coordination</h2>
          <ul className="space-y-2 text-sm">
            {report.sybil.clusters.slice(0, 3).map((c) => (
              <li key={c.id}><span className="font-medium">{c.label}</span> — {c.members.length} wallets, {pct(c.combinedBps)} of supply, {c.confidence} confidence ({c.signals.map((x) => x.label.toLowerCase()).join("; ")}).</li>
            ))}
          </ul>
          <p className="text-sm"><Link className="underline" href={`/sybil?token=${report.token?.address ?? ""}`}>See evidence and alternative explanations</Link>. Similar behavior does not show a shared owner.</p>
        </section>
      )}

      <section aria-labelledby="meta-h" className="space-y-3">
        <h2 id="meta-h" className="text-xl font-semibold">Scan details</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Analysis block</dt>
          <dd>{report.analysis.block != null ? <BlockLink block={report.analysis.block} /> : "—"}</dd>
          <dt className="text-muted-foreground">Transfers indexed through</dt>
          <dd>{report.analysis.latestIndexedBlock != null ? <BlockLink block={report.analysis.latestIndexedBlock} /> : "—"}{report.indexing && !report.indexing.complete && <span className="ml-2 text-sev-medium">incomplete ({report.indexing.stoppedReason})</span>}</dd>
          <dt className="text-muted-foreground">Created at block</dt>
          <dd>{report.token?.creationBlock != null ? <BlockLink block={report.token.creationBlock} /> : "Unknown"}</dd>
          {report.token?.creationTxHash && (<><dt className="text-muted-foreground">Creation transaction</dt><dd><TxLink hash={report.token.creationTxHash} /></dd></>)}
          {report.token?.creator && (<><dt className="text-muted-foreground">Creation tx sender <InfoTooltip text="Fact: this address sent the creation transaction. It may be a user acting through a launchpad contract. VibeGuard does not claim it identifies a person." /></dt><dd><AddressDisplay address={report.token.creator} /></dd></>)}
          {report.token?.immediateCreator && (<><dt className="text-muted-foreground">Deployed by contract</dt><dd><AddressDisplay address={report.token.immediateCreator} kind="contract" /></dd></>)}
          <dt className="text-muted-foreground">Scan requested</dt>
          <dd><time dateTime={report.requestedAt}>{report.requestedAt}</time></dd>
          <dt className="text-muted-foreground">Scan ID</dt>
          <dd className="break-all font-mono text-xs">{report.id}</dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          VibeGuard is an automated analysis tool, not an audit and not financial advice. Findings come from bytecode and event heuristics and can be wrong. Testnet results do not establish mainnet security.
        </p>
      </section>
    </div>
  );
}
