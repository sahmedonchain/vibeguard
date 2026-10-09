import { PHASE_NAMES, type RouteDef } from "@/lib/routes";
import { ComingSoonState } from "./states";

export function ComingSoonPage({ route }: { route: Pick<RouteDef, "title" | "description" | "phase"> }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">{route.title}</h1>
      <p className="mb-8 mt-2 text-muted-foreground">{route.description}</p>
      <ComingSoonState phase={route.phase} phaseName={PHASE_NAMES[route.phase]} />
    </div>
  );
}
