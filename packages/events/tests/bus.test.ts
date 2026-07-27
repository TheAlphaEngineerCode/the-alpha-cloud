import { describe, it, expect, vi } from 'vitest';
import { InMemoryEventBus } from '../src/index.js';
import { buildEvent, eventId, organizationId } from '@cloud/domain';

const baseEvent = () =>
  buildEvent({
    id: eventId(crypto.randomUUID()),
    type: 'user.login',
    organizationId: organizationId(crypto.randomUUID()),
    source: 'test',
    entityId: 'user-1',
    correlationId: 'corr-1',
    causationId: null,
    occurredAt: new Date(),
    payload: { ok: true },
  });

describe('in-memory event bus', () => {
  it('delivers to subscribed handlers', async () => {
    const bus = new InMemoryEventBus();
    const seen: string[] = [];
    bus.subscribe('user.login', () => {
      seen.push('h1');
    });
    await bus.publish(baseEvent());
    expect(seen).toEqual(['h1']);
    bus.close();
  });

  it('one subscriber throwing does not block others', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];
    bus.subscribe('user.login', () => {
      throw new Error('boom');
    });
    bus.subscribe('user.login', () => {
      received.push('after-throw');
    });
    await bus.publish(baseEvent());
    expect(received).toEqual(['after-throw']);
    bus.close();
  });

  it('unsubscribe removes the handler', async () => {
    const bus = new InMemoryEventBus();
    const fn = vi.fn();
    const off = bus.subscribe('user.login', fn);
    off();
    await bus.publish(baseEvent());
    expect(fn).not.toHaveBeenCalled();
    bus.close();
  });

  it('throws when publishing after close', async () => {
    const bus = new InMemoryEventBus();
    bus.close();
    await expect(bus.publish(baseEvent())).rejects.toThrow();
  });
});