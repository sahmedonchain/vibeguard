import { ROUTE_LIST } from "@/lib/routes";

export const PRIMARY_NAV = ROUTE_LIST.filter((r) => r.nav === "primary");
export const MORE_NAV = ROUTE_LIST.filter((r) => r.nav === "more");
