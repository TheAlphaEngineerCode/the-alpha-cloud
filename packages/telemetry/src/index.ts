/**
 * @cloud/telemetry — OpenTelemetry setup helper.
 *
 * PLACEHOLDER — Phase 0 ships no OTel instrumentation. Phase 7 (Observability) wires this
 * for real. Until then, any module that imports here gets a no-op span/meter; tests can
 * assert that "instrumentation called" without depending on a collector.
 */

export interface SpanContext {
  readonly traceId: string;
  readonly spanId: string;
}

export class NoopSpan {
  readonly traceId = '00000000000000000000000000000000';
  readonly spanId = '0000000000000000';
  setAttribute(_k: string, _v: unknown): this {
    return this;
  }
  recordError(_err: Error): this {
    return this;
  }
  end(): void {}
}

export function startSpan(_name: string): NoopSpan {
  return new NoopSpan();
}

/**
 * Will be real in Phase 7. For now, registering a tracer is a noop so feature code can be
 * written against this surface without coupling to OTel.
 */
export function initTelemetry(_endpoint: string | undefined): void {
  // intentionally noop until Phase 7
}
