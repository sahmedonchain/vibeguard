/**
 * Runs `fn` over `items` with bounded concurrency. Stops starting new work after `deadline` (epoch ms)
 * and returns results only for items that finished, in input order (skipped items are omitted).
 * A rejected `fn` yields null for that item.
 */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>, deadline?: number): Promise<(R | null)[]> {
  const out: (R | null | undefined)[] = new Array(items.length).fill(undefined);
  let next = 0;
  const worker = async () => {
    for (;;) {
      if (deadline !== undefined && Date.now() > deadline) return;
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = await fn(items[i]);
      } catch {
        out[i] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out.filter((r): r is R | null => r !== undefined);
}
