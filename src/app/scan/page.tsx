import type { Metadata } from "next";
import { ScanForm } from "@/components/report/scan-controls";
import { isEvmAddress } from "@/lib/chain/explorer";

export const metadata: Metadata = { title: "Token Scanner", description: "Scan an ERC-20 token on Robinhood Chain Testnet for evidence-backed risk findings." };

export default async function ScanPage({ searchParams }: PageProps<"/scan">) {
  const raw = (await searchParams).address;
  const initial = typeof raw === "string" && isEvmAddress(raw) ? raw : "";
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Token Scanner</h1>
        <p className="mt-2 text-muted-foreground">Paste an ERC-20 token contract address from Robinhood Chain Testnet. VibeGuard reads the contract and its transfer history and returns findings with evidence.</p>
      </div>
      <ScanForm initialAddress={initial} />
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Only token contracts are supported. Wallet addresses are rejected with an explanation.</li>
        <li>Tokens are discovered only from addresses you submit. Automatic discovery is not available yet.</li>
        <li>Scans run in the background. Older, busier tokens take longer. The report shows partial results if indexing does not finish.</li>
        <li>Results are automated and are not an audit. See the <a className="underline" href="/methodology">methodology</a>.</li>
      </ul>
    </div>
  );
}
