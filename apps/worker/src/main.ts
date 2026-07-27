/**
 * Worker entrypoint — subscribes to the platform event bus and runs background
 * jobs: discovery sweeps, drift detection, automation triggers, eval tasks.
 *
 * Phase 0 / Phase 1: MINIMAL — the worker initializes the event bus, registers
 * a no-op subscriber for every event type (so future code can drop in concrete
 * handlers), and waits for SIGTERM. Phase 2+ replaces the bus instance with a
 * Redis Streams consumer.
 */
import { buildLogger } from '@cloud/logger';
import { InMemoryEventBus, type EventBus } from '@cloud/events';
import { ALL_EVENT_TYPES, type EventEnvelope } from '@cloud/domain';

const log = buildLogger({ service: 'cloud-worker' });

async function main() {
  const bus: EventBus = new InMemoryEventBus();

  let processed = 0;
  for (const type of ALL_EVENT_TYPES) {
    bus.subscribe(type, (event: EventEnvelope) => {
      processed++;
      log.debug({ type, eventId: event.id, correlationId: event.correlationId }, 'event received (no-op)');
    });
  }

  log.info({ subscriptions: ALL_EVENT_TYPES.length }, 'CLOUD worker ready (no-op handlers)');

  const shutdown = (signal: string) => {
    log.info({ signal, processed }, 'worker stopping');
    bus.close();
    // Caller-intentional: workers exit on signal receipt; we don't throw because
    // we want a clean exit, not an error stack.
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Keep alive
  return new Promise<void>(() => {
    /* never resolves */
  });
}

void main();