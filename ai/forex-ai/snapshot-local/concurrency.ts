/**
 * Bounded Local AI inference concurrency (Phase 43D).
 * Max one running job; small queue; same snapshotId coalesces.
 */

export const LOCAL_AI_MAX_CONCURRENT = 1;
export const LOCAL_AI_MAX_QUEUE = 2;

type JobFn<T> = () => Promise<T>;

interface QueueItem<T> {
  snapshotId: string;
  run: JobFn<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

export class LocalAiInferenceGate {
  private running = 0;
  private readonly queue: Array<QueueItem<unknown>> = [];
  private readonly inFlight = new Map<string, Promise<unknown>>();

  stats() {
    return {
      running: this.running,
      queued: this.queue.length,
      inFlightKeys: [...this.inFlight.keys()],
      maxConcurrent: LOCAL_AI_MAX_CONCURRENT,
      maxQueue: LOCAL_AI_MAX_QUEUE,
    };
  }

  async runExclusive<T>(snapshotId: string, fn: JobFn<T>): Promise<T> {
    const key = String(snapshotId ?? "").trim();
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    if (this.running >= LOCAL_AI_MAX_CONCURRENT && this.queue.length >= LOCAL_AI_MAX_QUEUE) {
      throw Object.assign(new Error("Local AI inference queue is full. Retry shortly."), {
        code: "AI_QUEUE_FULL",
      });
    }

    const promise = new Promise<T>((resolve, reject) => {
      const item: QueueItem<T> = {
        snapshotId: key,
        run: fn,
        resolve,
        reject,
      };
      this.queue.push(item as QueueItem<unknown>);
      this.pump();
    });

    this.inFlight.set(key, promise as Promise<unknown>);
    promise.finally(() => {
      if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
    });
    return promise;
  }

  private pump(): void {
    while (this.running < LOCAL_AI_MAX_CONCURRENT && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.running += 1;
      void item.run()
        .then((value) => item.resolve(value))
        .catch((err) => item.reject(err))
        .finally(() => {
          this.running -= 1;
          this.pump();
        });
    }
  }
}

let gateSingleton: LocalAiInferenceGate | null = null;

export function getLocalAiInferenceGate(): LocalAiInferenceGate {
  gateSingleton ??= new LocalAiInferenceGate();
  return gateSingleton;
}

export function resetLocalAiInferenceGateForTests(): void {
  gateSingleton = null;
}
