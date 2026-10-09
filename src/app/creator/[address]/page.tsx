import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreationsList, CreatorFacts } from "@/components/report/creator-facts";
import { AddressDisplay } from "@/components/shared/address-display";
import { FreshnessLabel } from "@/components/shared/freshness-label";
import { ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { getCreatorProfile, type CreatorProfile } from "@/lib/analysis/creator-profile";
import { enforcePageLimit, isApiError } from "@/lib/api/page-limit";
import { LIMITS } from "@/lib/api/rate-limit";
import { createChainClient } from "@/lib/chain/client";
import { getChainConfig } from "@/lib/chain/config";
import { isEvmAddress } from "@/lib/chain/explorer";
import { safeText } from "@/lib/text";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/creator/[address]">): Promise<Metadata> {
  const { address } = await params;
  return { title: `Creator ${address.slice(0, 10)}…`, description: "Evidence-backed creator history. Facts and inferences are separated.", robots: { index: false } };
}

const LEVEL_TEXT: Record<CreatorProfile["assessment"]["level"], { title: string; className: string }> = {
  insufficient_data: { title: "Insufficient data", className: "text-muted-foreground" },
  no_signals_observed: { title: "No risk signals observed", className: "text-sev-low" },
  signals_observed: { title: "Risk signals observed", className: "text-sev-medium" },
};

export default async function CreatorPage({ params }: PageProps<"/creator/[address]">) {
  const { address } = await params;
  if (!isEvmAddress(address)) notFound();
  const a = address.toLowerCase();
  const shell = (node: React.ReactNode) => (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10">
      <header className="space-y-2"><h1 className="text-2xl font-semibold">Creator reputation</h1><AddressDisplay address={a} full /></header>
      {node}
    </div>
  );
  if (!isDatabaseConfigured()) return shell(<ErrorState title="Creator analysis is unavailable">The database is not configured on this deployment.</ErrorState>);

  let p: CreatorProfile;
  try {
    const db = getDb();
    const cfg = getChainConfig();
    await enforcePageLimit(db, LIMITS.analyze);
    p = await getCreatorProfile(db, createChainClient(cfg), cfg.chainId, cfg.explorerUrl, a);
  } catch (err) {
    if (isApiError(err)) return shell(<ErrorState title={err.code === "RATE_LIMITED" ? "Too many requests" : "Creator analysis is unavailable"}>{err.message}</ErrorState>);
    console.error("creator page failed", err instanceof Error ? err.message : err);
    return shell(<ErrorState title="Could not load the creator">A data provider is temporarily unavailable. Try again shortly.</ErrorState>);
  }

  const lvl = LEVEL_TEXT[p.assessment.level];
  return shell(
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Badge className="text-muted-foreground">{p.isContract ? "Contract" : "Wallet"}</Badge>
        <Badge className={lvl.className}>{lvl.title}</Badge>
        <FreshnessLabel asOf={p.computedAt} />
      </div>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Assessment</h2>
        {p.assessment.signals.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm">{p.assessment.signals.map((s) => <li key={s.label}><span className="font-medium">{s.label}</span> <span className="text-muted-foreground">({s.severity}; {s.basis})</span></li>)}</ul>
        ) : (
          <p className="text-sm text-muted-foreground">{p.assessment.level === "insufficient_data" ? "There is not enough history to assess this wallet." : "None of the checks below found a signal in the history that was read."}</p>
        )}
        <p className="text-xs text-muted-foreground">{p.assessment.note} Method: signals are the checks VG-CRT-001 to VG-CRT-003 plus VibeGuard&apos;s own scan results; see the <Link className="underline" href="/methodology">methodology</Link>.</p>
      </Card>

      <section aria-labelledby="facts-h" className="space-y-3">
        <h2 id="facts-h" className="text-lg font-semibold">Facts <span className="text-sm font-normal text-muted-foreground">verified by transactions</span></h2>
        <Card><CreatorFacts facts={p.facts} showAddress={false} /></Card>
        <h3 className="font-medium">Token creations found</h3>
        <Card><CreationsList facts={p.facts} /></Card>
        <h3 className="font-medium">Tokens recorded by VibeGuard</h3>
        {p.knownTokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">VibeGuard has not scanned any token whose creation transaction this wallet sent.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">Tokens created by this wallet that VibeGuard has recorded</caption>
              <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th scope="col" className="px-3 py-2">Token</th><th scope="col" className="px-3 py-2">Latest scan</th><th scope="col" className="px-3 py-2 text-right">Report</th></tr></thead>
              <tbody>
                {p.knownTokens.map((t) => (
                  <tr key={t.address} className="border-t border-border"><td className="px-3 py-2"><span className="mr-2">{safeText(t.name, 40) || "Unnamed"} {t.symbol && <span className="text-muted-foreground">({safeText(t.symbol, 12)})</span>}</span><AddressDisplay address={t.address} kind="contract" /></td><td className="px-3 py-2">{t.scan ? `${t.scan.level}${t.scan.overall !== null ? ` · ${t.scan.overall.toFixed(1)}` : ""}${t.scan.provisional ? " (provisional)" : ""}` : "Not scanned"}</td><td className="px-3 py-2 text-right"><Link className="underline" href={`/token/${t.address}`}>Open</Link></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="inf-h" className="space-y-3">
        <h2 id="inf-h" className="text-lg font-semibold">Inferences <span className="text-sm font-normal text-muted-foreground">interpretations, not facts</span></h2>
        {p.inferences.length === 0 ? <p className="text-sm text-muted-foreground">No inferences are drawn from the available facts.</p> : (
          <div className="space-y-3">
            {p.inferences.map((i) => (
              <Card key={i.id} className="space-y-2 p-4">
                <p className="text-sm font-medium">{i.statement} <Badge className="ml-1 text-muted-foreground">{i.confidence} confidence</Badge></p>
                <p className="text-xs text-muted-foreground">Basis: {i.basis.join("; ")}</p>
                <p className="text-xs text-muted-foreground">Alternatives: {i.alternatives.join(" ")}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">VibeGuard does not say who controls an address. A token that failed or lost value is not evidence of wrongdoing by its creator. Not an audit and not financial advice.</p>
    </>,
  );
}
