import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/shared/coming-soon-page";
import { ROUTES } from "@/lib/routes";

const route = ROUTES.alerts;
export const metadata: Metadata = { title: route.title, description: route.description };

export default function Page() {
  return <ComingSoonPage route={route} />;
}
