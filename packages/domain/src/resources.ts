import type { OrganizationId, ProviderId, ResourceId } from './ids.js';

/** Provider kinds known to the platform. New connectors add kinds here. */
export type ProviderKind =
  'aws' | 'azure' | 'gcp' | 'kubernetes' | 'docker' | 'local' | 'simulator';

/** Cloud resource types (spec §9). Only stable enum values; new types require a code change. */
export type ResourceType =
  | 'VIRTUAL_MACHINE'
  | 'CONTAINER'
  | 'KUBERNETES_CLUSTER'
  | 'KUBERNETES_NODE'
  | 'KUBERNETES_POD'
  | 'KUBERNETES_DEPLOYMENT'
  | 'KUBERNETES_SERVICE'
  | 'DATABASE'
  | 'CACHE'
  | 'QUEUE'
  | 'LOAD_BALANCER'
  | 'OBJECT_STORAGE'
  | 'VOLUME'
  | 'NETWORK'
  | 'SUBNET'
  | 'FIREWALL'
  | 'DNS'
  | 'SERVERLESS_FUNCTION'
  | 'API_GATEWAY'
  | 'SECRET'
  | 'CERTIFICATE'
  | 'APPLICATION'
  | 'SERVICE'
  | 'ENVIRONMENT'
  | 'OTHER';

export const ALL_RESOURCE_TYPES: readonly ResourceType[] = [
  'VIRTUAL_MACHINE',
  'CONTAINER',
  'KUBERNETES_CLUSTER',
  'KUBERNETES_NODE',
  'KUBERNETES_POD',
  'KUBERNETES_DEPLOYMENT',
  'KUBERNETES_SERVICE',
  'DATABASE',
  'CACHE',
  'QUEUE',
  'LOAD_BALANCER',
  'OBJECT_STORAGE',
  'VOLUME',
  'NETWORK',
  'SUBNET',
  'FIREWALL',
  'DNS',
  'SERVERLESS_FUNCTION',
  'API_GATEWAY',
  'SECRET',
  'CERTIFICATE',
  'APPLICATION',
  'SERVICE',
  'ENVIRONMENT',
  'OTHER',
] as const;

export type ResourceStatus =
  'RUNNING' | 'STOPPED' | 'PROVISIONING' | 'FAILED' | 'TERMINATED' | 'UNKNOWN';

export interface CloudResource {
  readonly id: ResourceId;
  readonly organizationId: OrganizationId;
  readonly providerId: ProviderId;
  readonly externalId: string;
  readonly name: string;
  readonly resourceType: ResourceType;
  readonly provider: ProviderKind;
  readonly region: string | null;
  readonly zone: string | null;
  readonly environment: string | null;
  readonly status: ResourceStatus;
  /** Whether the platform is the source of truth for this resource (IaC-managed). */
  readonly managed: boolean;
  readonly createdAt: Date;
  readonly discoveredAt: Date;
  readonly updatedAt: Date;
  /** Free-form vendor metadata, capped in size by the storage layer. */
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly tags: Readonly<Record<string, string>>;
  readonly labels: Readonly<Record<string, string>>;
}
