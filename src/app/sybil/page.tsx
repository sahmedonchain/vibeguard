import type { Metadata } from "next";
import Link from "next/link";
import { ClusterCard } from "@/components/report/cluster-card";
import { AddressDisplay } from "@/components/shared/address-display";
import { FreshnessLabel } from "@/components/shared/freshness-label";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { fundingCoverage } from "@/lib/analysis/sybil";
import { getChainConfig } from "@/lib/chain/config";
import { isEvmAddress } from "@/lib/chain/explorer";
import { getLatestResultReport, type ScanReport } from "@/lib/scans/report";
import { safeText } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sybil Analysis", description: "Possible coordination among a token's largest wallets, with confidence, evidence and alternative explanations." };

export default async function SybilPage({ searchParams }: PageProps<"/sybil">) {
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw.trim() : "";
  const valid = isEvmAddress(token);

  let report: ScanReport | null = null;
  let failed = false;
  if (valid && isDatabaseConfigured()) {
    try {
      report = await getLatestResultReport(getDb(), getChainConfig(), token);
    } catch (err) {
      console.error("sybil page failed", err instanceof Error ? err.message : err);
      failed = true;
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Sybil analysis</h1>
        <p className="text-muted-foreground">Looks for groups among a token&apos;s largest wallet holders that show similar or coordinated on-chain behavior. Results say <strong>Possible Coordination</strong> or <strong>High Behavioral Similarity</strong>. They never say the wallets share an owner.</p>
      </header>

      <form action="/sybil" method="get" className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="token" className="sr-only">Token contract address</label>
        <input id="token" name="token" defaultValue={token} placeholder="0x… token contract address" autoComplete="off" spellCheck={false} className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 font-mono text-sm" />
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Analyze</button>
      </form>

      {!token && <EmptyState title="Enter a token address">Coordination is analyzed per token, as part of its scan. Paste a token address to see the latest result.</EmptyState>}
      {token && !valid && <ErrorState title="Not a valid address">Expected a 42-character EVM address starting with 0x.</ErrorState>}
      {valid && !isDatabaseConfigured() && <ErrorState title="Analysis is unavailable">The database is not configured on this deployment.</ErrorState>}
      {valid && failed && <ErrorState title="Could not load the analysis">The data store is temporarily unavailable. Try again shortly.</ErrorState>}
      {valid && isDatabaseConfigured() && !failed && !report && (
        <EmptyState title="No finished scan for this token">Sybil analysis runs as part of a token scan. <Link className="underline" href={`/scan?address=${token}`}>Scan this token</Link> first.</EmptyState>
      )}
      {report && <Result report={report} />}
    </div>
  );
}

function Result({ report }: { report: ScanReport }) {
  const s = report.sybil;
  const name = safeText(report.token?.name) || "Unnamed token";
  const findings = report.findings.filter((f) => f.ruleId === "VG-SUS-001" || f.ruleId === "VG-SUS-002");
  return (
    <section className="space-y-6" aria-labelledby="res-h">
      <div className="space-y-2">
        <h2 id="res-h" className="text-xl font-semibold">{name}{report.token?.symbol ? ` (${safeText(report.token.symbol, 16)})` : ""}</h2>
        {report.token && <AddressDisplay address={report.token.address} full kind="contract" />}
        <div className="flex flex-wrap items-center gap-3"><FreshnessLabel blockNumber={report.analysis.block} asOf={report.analysis.blockTime} /><Link className="text-sm underline" href={`/token/${report.token?.address}`}>Full risk report</Link></div>
      </div>

      {!s ? (
        <Card className="border-sev-medium/50">
          <h3 className="font-medium">No coordination analysis in this scan</h3>
          <p className="mt-1 text-sm text-muted-foreground">{report.holders ? "This scan predates sybil analysis (methodology 1.1.0). Scan the token again." : "The transfer index did not cover the full history, so holders and coordination could not be analyzed. This is not a sign that the token is safe."}</p>
        </Card>
      ) : (
        <>
          <Card className="space-y-1 p-4 text-sm">
            <p>Examined the <strong>{s.candidates}</strong> largest non-contract wallet holders. Funding history was readable for <strong>{s.fundingResolved}</strong> of them ({Math.round(fundingCoverage(s) * 100)}%){s.budgetExceeded ? "; the time budget ran out before every lookup finished" : ""}.</p>
            <p className="text-muted-foreground">Contracts and burn addresses are excluded. Funders that are contracts or very high-volume wallets (likely faucets, bridges, exchanges) are not used as evidence. Clusters under {(s.thresholds.minClusterShareBps / 100).toFixed(0)}% of supply are shown but not scored.</p>
          </Card>

          {s.clusters.length === 0 ? (
            <EmptyState title="No clusters found">No group of the examined wallets shared a funder, first acquired the token within the same minute, or sent tokens to a common wallet. Wallets funded through exchanges or bridges cannot be linked this way, so this does not prove independence.</EmptyState>
          ) : (
            <div className="space-y-4">{s.clusters.map((c) => <ClusterCard key={c.id} cluster={c} />)}</div>
          )}
        </>
      )}

      {findings.length > 0 && (
        <Card className="space-y-2 p-4">
          <h3 className="font-medium">Effect on the risk score</h3>
          <ul className="space-y-1 text-sm">{findings.map((f) => <li key={f.ruleId}><span className="font-mono text-xs">{f.ruleId}</span> {f.title} <span className="text-muted-foreground">({f.status === "detected" ? `${f.severity}, ${f.confidence} confidence` : f.status === "unknown" ? "could not be checked" : "nothing detected"})</span></li>)}</ul>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">Heuristics, not proof. Every signal lists a plausible innocent explanation. Method and thresholds are on the <Link className="underline" href="/methodology">methodology page</Link>.</p>
    </section>
  );
}
