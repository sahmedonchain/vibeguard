import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/report-view";
import { ScanButton, ScanPoller } from "@/components/report/scan-controls";
import { AddressDisplay } from "@/components/shared/address-display";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { getChainConfig } from "@/lib/chain/config";
import { isEvmAddress } from "@/lib/chain/explorer";
import { getLatestReport } from "@/lib/scans/report";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/token/[address]">): Promise<Metadata> {
  const { address } = await params;
  return { title: `Token ${address.slice(0, 10)}…`, description: "Evidence-backed token risk report. Automated analysis, not an audit.", robots: { index: false } };
}

export default async function TokenPage({ params }: PageProps<"/token/[address]">) {
  const { address } = await params;
  if (!isEvmAddress(address)) notFound();
  const wrap = (node: React.ReactNode) => (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12">
      <AddressDisplay address={address} full kind="contract" />
      {node}
    </div>
  );

  if (!isDatabaseConfigured()) return wrap(<ErrorState title="Scanning is unavailable">The database is not configured on this deployment.</ErrorState>);

  let report;
  try {
    report = await getLatestReport(getDb(), getChainConfig(), address);
  } catch (err) {
    console.error("token page load failed", err instanceof Error ? err.message : err);
    return wrap(<ErrorState title="Could not load the report">The data store is temporarily unavailable. Try again shortly.</ErrorState>);
  }

  if (!report) {
    return wrap(
      <EmptyState title="No scan yet">
        This token has not been scanned. A scan reads the contract, indexes its transfers, and takes about a minute for older tokens.
        <div className="mt-4 flex justify-center"><ScanButton address={address} /></div>
      </EmptyState>,
    );
  }
  if (report.status === "queued" || report.status === "running") {
    return wrap(
      <>
        <ScanPoller />
        <LoadingState label={report.status === "queued" ? "Scan queued…" : "Scanning…"} />
        <p className="text-center text-sm text-muted-foreground">This page refreshes automatically. Scans are run by a background worker.</p>
      </>,
    );
  }
  return (
    <>
      <ReportView report={report} />
      <div className="mx-auto flex w-full max-w-5xl justify-end px-4 pb-10"><ScanButton address={address} label="Scan again" /></div>
    </>
  );
}
