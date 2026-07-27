import type { OrganizationId, ResourceId, ResourceNodeId } from './ids.js';
import type { ResourceType } from './resources.js';

/** Relation kinds in the Cloud Topology Graph (spec §10). */
export type RelationType =
  | 'DEPENDS_ON'
  | 'CONNECTS_TO'
  | 'ROUTES_TO'
  | 'HOSTS'
  | 'RUNS_ON'
  | 'USES'
  | 'READS_FROM'
  | 'WRITES_TO'
  | 'PROTECTED_BY'
  | 'BALANCED_BY'
  | 'EXPOSED_BY'
  | 'MONITORED_BY'
  | 'BACKED_BY'
  | 'DEPLOYED_TO'
  | 'MANAGED_BY';

export const ALL_RELATION_TYPES: readonly RelationType[] = [
  'DEPENDS_ON',
  'CONNECTS_TO',
  'ROUTES_TO',
  'HOSTS',
  'RUNS_ON',
  'USES',
  'READS_FROM',
  'WRITES_TO',
  'PROTECTED_BY',
  'BALANCED_BY',
  'EXPOSED_BY',
  'MONITORED_BY',
  'BACKED_BY',
  'DEPLOYED_TO',
  'MANAGED_BY',
] as const;

export interface ResourceNode {
  readonly id: ResourceNodeId;
  readonly organizationId: OrganizationId;
  readonly resourceId: ResourceId;
  readonly resourceType: ResourceType;
  readonly provider: string;
  readonly state: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ResourceEdge {
  readonly id: ResourceNodeId; // alias used as EdgeId in spec
  readonly organizationId: OrganizationId;
  readonly sourceNodeId: ResourceNodeId;
  readonly targetNodeId: ResourceNodeId;
  readonly relationType: RelationType;
  readonly critical: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface BlastRadiusResult {
  readonly rootResourceId: ResourceId;
  readonly affectedResourceIds: ReadonlyArray<ResourceId>;
  readonly affectedServices: ReadonlyArray<string>;
  /** Simple cascade level (0 = root, 1 = direct deps, 2+ = transitively). */
  readonly depth: number;
  readonly criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}