import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonPage } from "@/components/shared/coming-soon-page";
import { AddressDisplay } from "@/components/shared/address-display";
import { isEvmAddress } from "@/lib/chain/explorer";
import { ROUTES } from "@/lib/routes";

const route = ROUTES.token;
export const metadata: Metadata = { title: route.title, description: route.description };

export default async function Page({ params }: PageProps<"/token/[address]">) {
  const { address } = await params;
  if (!isEvmAddress(address)) notFound();
  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 pt-12"><AddressDisplay address={address} full /></div>
      <ComingSoonPage route={route} />
    </>
  );
}
