#!/usr/bin/env node
/**
 * `cloud` CLI entrypoint.
 *
 * Phase 0 ships a `doctor` subcommand and a generic `help`. The full surface
 * (`resources list`, `apps inspect`, `topology`, `deploy`, `infra plan` …, see
 * spec §44) is wired in Phase 4+ when the inventory and deployment engines
 * exist and the platform has a typed client to talk to.
 */
import { ALL_EVENT_TYPES } from '@cloud/domain';

const VERSION = '0.0.0-phase-0';

interface ParsedArgs {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly flags: ReadonlyMap<string, string>;
}

function parseArgs(argv: ReadonlyArray<string>): ParsedArgs {
  const flags = new Map<string, string>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(arg.slice(2), next);
        i++;
      } else {
        flags.set(arg.slice(2), '');
      }
    } else {
      positional.push(arg);
    }
  }
  return { command: positional[0] ?? 'help', args: positional.slice(1), flags };
}

const HELP = `
The Alpha Cloud CLI v${VERSION}

Commands available at Phase 0:
  help                Show this help
  version             Print the CLI version
  doctor              Print a basic environment/health probe
  status              Placeholder — implemented in Phase 4

Future commands (spec §44):
  login, status, resources list, resources inspect, apps list, apps inspect,
  deploy, deployments list, topology, clusters list, logs, incidents list,
  costs summary, security scan, infra validate, infra plan, automation run
`;

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  switch (parsed.command) {
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      break;
    case 'version':
    case '--version':
    case '-v':
      console.log(VERSION);
      break;
    case 'doctor':
      console.log(
        JSON.stringify(
          {
            node: process.versions.node,
            platform: process.platform,
            arch: process.arch,
            uptimeSeconds: process.uptime(),
            envNodeEnv: process.env.NODE_ENV ?? '(unset)',
            handledEventTypes: ALL_EVENT_TYPES.length,
          },
          null,
          2,
        ),
      );
      break;
    case 'status':
      console.error('[cloud] status: not implemented in Phase 0 — see IMPLEMENTATION_STATUS.md');
      process.exitCode = 1;
      break;
    default:
      console.error(`[cloud] unknown command: ${parsed.command}\n${HELP}`);
      process.exitCode = 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
