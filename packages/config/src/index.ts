/**
 * @cloud/config — typed environment loader.
 *
 * Modules MUST NOT call `process.env` directly. They request a typed `Env` from here so
 * defaults and missing-variable errors surface in one place, and so tests can stub env
 * deterministically via `buildEnv(input)`.
 */
import { z } from 'zod';

/**
 * Raw env shape (string → typed). Naming matches `.env.example`.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(8080),
  API_PUBLIC_URL: z.string().url(),

  SESSION_COOKIE_NAME: z.string().default('cloud_session'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  SESSION_SECRET: z.string().min(32),

  CORS_ORIGINS: z.string().transform((s) =>
    s
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  ),

  WEB_PORT: z.coerce.number().int().positive().default(3000),
  WEB_PUBLIC_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),

  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string(),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  DATABASE_URL: z.string().url().optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_POOL_IDLE: z.coerce.number().int().positive().default(30000),

  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().nonnegative().default(0),
  REDIS_URL: z.string().url().optional(),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('cloud'),
  OTEL_RESOURCE_ATTRIBUTES: z.string().default(''),

  RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_GENERAL_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  readonly issues: ReadonlyArray<z.ZodIssue>;
  constructor(issues: ReadonlyArray<z.ZodIssue>) {
    super(
      `Invalid environment variables:\n${issues
        .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('\n')}`,
    );
    this.name = 'EnvError';
    this.issues = issues;
  }
}

/**
 * Parse an arbitrary env map (defaults to `process.env`) into a validated `Env`.
 * Throws `EnvError` listing every offending variable.
 */
export function buildEnv(input: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) throw new EnvError(parsed.error.issues);
  return parsed.data;
}

let cached: Env | undefined;

/**
 * Lazily load and cache the runtime env. Tests should call `buildEnv()` with their
 * fixture and pass it explicitly; this helper is for app code that wants the runtime env.
 */
export function loadEnv(): Env {
  if (cached) return cached;
  cached = buildEnv();
  return cached;
}

/**
 * Reset the cached env. Test-only.
 */
export function resetEnvForTests(): void {
  cached = undefined;
}
