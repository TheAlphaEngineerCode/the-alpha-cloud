/**
 * Branded id types — distinct nominal types over UUIDv4 string payloads.
 *
 * Why brand instead of just `string`: the API surface area of a control plane mixes many
 * distinct ids (organizationId, userId, resourceId, sessionId, eventId, approvalId…).
 * Letting them all be `string` lets a `userId` slip into a `resourceId` slot at a callsite,
 * which is the kind of bug that ends in a tenant reading someone else's data. Brands cost
 * nothing at runtime and surface mistakes at typecheck time.
 */

export type Brand<T, B> = T & { readonly __brand: B };

export type OrganizationId = Brand<string, 'OrganizationId'>;
export type UserId = Brand<string, 'UserId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type ResourceId = Brand<string, 'ResourceId'>;
export type ResourceNodeId = Brand<string, 'ResourceNodeId'>;
export type ResourceEdgeId = Brand<string, 'ResourceEdgeId'>;
export type ApplicationId = Brand<string, 'ApplicationId'>;
export type DeploymentId = Brand<string, 'DeploymentId'>;
export type EnvironmentId = Brand<string, 'EnvironmentId'>;
export type ClusterId = Brand<string, 'ClusterId'>;
export type ProviderId = Brand<string, 'ProviderId'>;
export type CostRecordId = Brand<string, 'CostRecordId'>;
export type SecurityFindingId = Brand<string, 'SecurityFindingId'>;
export type PolicyId = Brand<string, 'PolicyId'>;
export type PolicyEvaluationId = Brand<string, 'PolicyEvaluationId'>;
export type AuditEventId = Brand<string, 'AuditEventId'>;
export type EventId = Brand<string, 'EventId'>;
export type ApprovalId = Brand<string, 'ApprovalId'>;
export type IncidentId = Brand<string, 'IncidentId'>;
export type SloId = Brand<string, 'SloId'>;
export type AlertId = Brand<string, 'AlertId'>;

export type AnyId =
  | OrganizationId
  | UserId
  | SessionId
  | ResourceId
  | ResourceNodeId
  | ResourceEdgeId
  | ApplicationId
  | DeploymentId
  | EnvironmentId
  | ClusterId
  | ProviderId
  | CostRecordId
  | SecurityFindingId
  | PolicyId
  | AuditEventId
  | EventId
  | ApprovalId
  | IncidentId
  | SloId
  | AlertId;

export const brandId = <B extends string>(value: string): Brand<string, B> => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new TypeError(`Invalid UUID: ${value}`);
  }
  return value as Brand<string, B>;
};

// helper builders per id — keeps construction explicit at the call site.
export const organizationId = (v: string): OrganizationId => brandId(v);
export const userId = (v: string): UserId => brandId(v);
export const sessionId = (v: string): SessionId => brandId(v);
export const resourceId = (v: string): ResourceId => brandId(v);
export const resourceNodeId = (v: string): ResourceNodeId => brandId(v);
export const resourceEdgeId = (v: string): ResourceEdgeId => brandId(v);
export const applicationId = (v: string): ApplicationId => brandId(v);
export const deploymentId = (v: string): DeploymentId => brandId(v);
export const environmentId = (v: string): EnvironmentId => brandId(v);
export const clusterId = (v: string): ClusterId => brandId(v);
export const providerId = (v: string): ProviderId => brandId(v);
export const costRecordId = (v: string): CostRecordId => brandId(v);
export const securityFindingId = (v: string): SecurityFindingId => brandId(v);
export const policyId = (v: string): PolicyId => brandId(v);
export const auditEventId = (v: string): AuditEventId => brandId(v);
export const eventId = (v: string): EventId => brandId(v);
export const approvalId = (v: string): ApprovalId => brandId(v);
export const incidentId = (v: string): IncidentId => brandId(v);
export const sloId = (v: string): SloId => brandId(v);
export const alertId = (v: string): AlertId => brandId(v);
