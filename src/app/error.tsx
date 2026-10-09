"use client";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <ErrorState>
        <Button variant="outline" onClick={reset}>Try again</Button>
      </ErrorState>
    </div>
  );
}
