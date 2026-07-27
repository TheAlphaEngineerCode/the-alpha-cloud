/**
 * @cloud/logger — thin wrapper around pino with structured fields for the platform.
 *
 * The default export is a shared logger bound to `service.name=cloud`; modules create
 * child loggers with `log.child({ module: 'inventory' })` rather than instantiating
 * their own.
 */
import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from 'pino';

export type { Logger } from 'pino';

export interface BuildLoggerOptions {
  /** Service name reported in every log line. */
  service?: string;
  /** Log level. Defaults to `info`. */
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** When true, emit human-readable pretty logs (dev). Defaults to `NODE_ENV !== 'production'`. */
  pretty?: boolean;
  /** Extra base fields merged into every record. */
  base?: Record<string, unknown>;
}

export function buildLogger(opts: BuildLoggerOptions = {}): Logger {
  const isProd = process.env.NODE_ENV === 'production';
  const pretty = opts.pretty ?? !isProd;
  const options: LoggerOptions = {
    level: opts.level ?? 'info',
    base: {
      service: opts.service ?? 'cloud',
      ...opts.base,
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.passwordHash',
        '*.sessionSecret',
        '*.secret',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req(req: { id?: string; method?: string; url?: string }) {
        return { id: req.id, method: req.method, url: req.url };
      },
    },
  };
  if (pretty) {
    const transport = pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname,service',
      },
    }) as unknown as DestinationStream;
    return pino(options, transport);
  }
  return pino(options);
}

/**
 * Shared default logger. Prefer creating per-module child loggers from this rather than
 * re-instantiating loggers.
 */
export const log = buildLogger();