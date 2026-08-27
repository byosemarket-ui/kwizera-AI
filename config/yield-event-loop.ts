/** Yield so Node can process HTTP while CPU-heavy startup work continues. */
export function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
