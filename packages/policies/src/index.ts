/**
 * @cloud/policies — declarative policy engine (spec §33).
 *
 * PLACEHOLDER — Phase 10 (Security) ships the evaluator. Until then this package only
 * declares the shape of a `Policy` so other code can be written against it.
 */
import type { OrganizationId } from '@cloud/domain';

export type PolicySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface PolicyScope {
  readonly environment?: string;
  readonly provider?: string;
  readonly resourceType?: string;
}

export interface PolicyRequire {
  readonly [field: string]: unknown;
}

export interface Policy {
  readonly id: string;
  readonly organizationId: OrganizationId | null;
  readonly name: string;
  readonly description: string;
  readonly scope: PolicyScope;
  readonly require: PolicyRequire;
  readonly severity: PolicySeverity;
  readonly enabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
