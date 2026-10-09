import Link from "next/link";
import { UnsupportedState } from "@/components/shared/states";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <UnsupportedState title="Page or address not found">
        The page does not exist, or the address is not a valid EVM address. <Link href="/" className="underline">Go home</Link>.
      </UnsupportedState>
    </div>
  );
}
