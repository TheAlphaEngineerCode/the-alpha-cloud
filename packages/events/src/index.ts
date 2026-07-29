/**
 * @cloud/events — internal in-process event bus.
 *
 * Why in-process first (ADR-0005): the modular monolith runs in one process'. Workers
 * will eventually receive events via Postgres LISTEN/NOTIFY or Redis streams, but the
 * app/bus boundary is here — `EventBus` is the only thing the rest of the codebase calls.
 *
 * Subscribers MUST be idempotent. The bus is **at-least-once**: it never drops an event,
 * even if a subscriber throws — the error is logged and the next subscriber runs.
 */
import type { EventEnvelope, EventType } from '@cloud/domain';

export type Subscriber<T extends EventType = EventType> = (
  event: EventEnvelope<T>,
) => void | Promise<void>;

export interface EventBus {
  publish<T extends EventType, P>(event: EventEnvelope<T, P>): Promise<void>;
  subscribe<T extends EventType>(type: T, sub: Subscriber<T>): () => void;
  close(): void;
}

export class InMemoryEventBus implements EventBus {
  private readonly subscribers: Map<EventType, Set<Subscriber>> = new Map();
  private closed = false;

  async publish<T extends EventType, P>(event: EventEnvelope<T, P>): Promise<void> {
    if (this.closed) throw new Error('EventBus is closed');
    const subs = this.subscribers.get(event.type);
    if (!subs || subs.size === 0) return;
    // Snapshot to allow subscribers to unsubscribe while iterating
    const snapshot = Array.from(subs);
    for (const sub of snapshot) {
      try {
        await sub(event);
      } catch (err) {
        // bus must not abort on a single bad subscriber; log + continue
        // eslint-disable-next-line no-console
        console.error('[cloud] event subscriber threw', {
          type: event.type,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  subscribe<T extends EventType>(type: T, sub: Subscriber<T>): () => void {
    if (this.closed) throw new Error('EventBus is closed');
    let set = this.subscribers.get(type);
    if (!set) {
      set = new Set();
      this.subscribers.set(type, set);
    }
    set.add(sub as Subscriber);
    return () => {
      set?.delete(sub as Subscriber);
    };
  }

  close(): void {
    this.closed = true;
    this.subscribers.clear();
  }
}
