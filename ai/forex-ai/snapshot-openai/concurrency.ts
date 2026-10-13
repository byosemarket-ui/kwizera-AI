/**
 * Bounded OpenAI inference concurrency (independent of Local AI gate).
 */
export const OPENAI_AI_MAX_CONCURRENT = 1;
export const OPENAI_AI_MAX_QUEUE = 2;

type JobFn<T> = () => Promise<T>;

interface QueueItem<T> {
  snapshotId: string;
  run: JobFn<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

export class OpenAiInferenceGate {
  private running = 0;
  private readonly queue: Array<QueueItem<unknown>> = [];
  private readonly inFlight = new Map<string, Promise<unknown>>();

  stats() {
    return {
      running: this.running,
      queued: this.queue.length,
      inFlightKeys: [...this.inFlight.keys()],
      maxConcurrent: OPENAI_AI_MAX_CONCURRENT,
      maxQueue: OPENAI_AI_MAX_QUEUE,
    };
  }

  async runExclusive<T>(snapshotId: string, fn: JobFn<T>): Promise<T> {
    const key = `openai:${String(snapshotId ?? "").trim()}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    if (this.running >= OPENAI_AI_MAX_CONCURRENT && this.queue.length >= OPENAI_AI_MAX_QUEUE) {
      throw Object.assign(new Error("OpenAI inference queue is full. Retry shortly."), {
        code: "AI_QUEUE_FULL",
      });
    }

    const promise = new Promise<T>((resolve, reject) => {
      this.queue.push({
        snapshotId: key,
        run: fn,
        resolve,
        reject,
      } as QueueItem<unknown>);
      this.pump();
    });

    this.inFlight.set(key, promise as Promise<unknown>);
    promise.finally(() => {
      if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
    });
    return promise;
  }

  private pump(): void {
    while (this.running < OPENAI_AI_MAX_CONCURRENT && this.queue.length > 0) {
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

let gateSingleton: OpenAiInferenceGate | null = null;

export function getOpenAiInferenceGate(): OpenAiInferenceGate {
  gateSingleton ??= new OpenAiInferenceGate();
  return gateSingleton;
}

export function resetOpenAiInferenceGateForTests(): void {
  gateSingleton = null;
}
