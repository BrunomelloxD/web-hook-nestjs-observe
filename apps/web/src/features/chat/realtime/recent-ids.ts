import 'server-only';

const CAPACITY = 1000;
const GLOBAL_KEY = Symbol.for('web-hook.recent-webhook-ids');

/** The last `capacity` webhook ids, oldest evicted first (WHIN-02). */
export class RecentIds {
  // A Set keeps insertion order, so the first value is the oldest.
  private readonly ids = new Set<string>();

  constructor(private readonly capacity = CAPACITY) {}

  has(id: string): boolean {
    return this.ids.has(id);
  }

  add(id: string): void {
    this.ids.add(id);
    if (this.ids.size > this.capacity) {
      this.ids.delete(this.ids.values().next().value as string);
    }
  }
}

/** Process-wide instance: route handler bundles share it, and it survives HMR (AD-003). */
export function getRecentIds(): RecentIds {
  const store = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: RecentIds;
  };
  return (store[GLOBAL_KEY] ??= new RecentIds());
}
