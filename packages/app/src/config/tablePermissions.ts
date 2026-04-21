// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { MedSpaRole } from '../auth/role';

/**
 * Table action permissions by resource type and user role
 * Defines which roles can perform which actions on each resource type
 */

export interface TablePermissions {
  /** Who can create new resources */
  create: MedSpaRole[];
  /** Who can delete resources */
  delete: MedSpaRole[];
  /** Who can export data */
  export: MedSpaRole[];
  /** Who can perform bulk operations */
  bulk: MedSpaRole[];
}

/**
 * Default permissions that apply to most resource types
 * Used as fallback when specific permissions not defined
 */
const DEFAULT_PERMISSIONS: TablePermissions = {
  create: ['super-admin', 'project-admin', 'provider'],
  delete: ['super-admin', 'project-admin'],
  export: ['super-admin', 'project-admin'],
  bulk: ['super-admin', 'project-admin'],
};

/**
 * Resource-specific table permissions
 * Add new resource types here as needed
 */
export const TABLE_PERMISSIONS: Record<string, TablePermissions> = {
  // Patient - Coordinators can view and create, but not delete
  Patient: {
    create: ['super-admin', 'project-admin', 'provider', 'coordinator'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // Appointment - All roles can create/edit
  Appointment: {
    create: ['super-admin', 'project-admin', 'provider', 'coordinator'],
    delete: ['super-admin', 'project-admin', 'coordinator'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // Encounter - Clinical only
  Encounter: {
    create: ['super-admin', 'project-admin', 'provider'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // Procedure - Clinical only
  Procedure: {
    create: ['super-admin', 'project-admin', 'provider'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // Observation - Clinical only
  Observation: {
    create: ['super-admin', 'project-admin', 'provider'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // Questionnaire - Admin only for editing
  Questionnaire: {
    create: ['super-admin', 'project-admin'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // Media (Photos) - Clinical can upload, all can view
  Media: {
    create: ['super-admin', 'project-admin', 'provider', 'coordinator'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // Consent - Clinical can create
  Consent: {
    create: ['super-admin', 'project-admin', 'provider'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // Invoice - Coordinators can create/edit
  Invoice: {
    create: ['super-admin', 'project-admin', 'coordinator'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // DocumentReference - Clinical can create
  DocumentReference: {
    create: ['super-admin', 'project-admin', 'provider'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // Communication - All roles can create
  Communication: {
    create: ['super-admin', 'project-admin', 'provider', 'coordinator'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // Bot - Admin only
  Bot: {
    create: ['super-admin', 'project-admin'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // ClientApplication - Admin only
  ClientApplication: {
    create: ['super-admin', 'project-admin'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // AccessPolicy - Admin only
  AccessPolicy: {
    create: ['super-admin', 'project-admin'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // UserConfiguration - Admin only
  UserConfiguration: {
    create: ['super-admin', 'project-admin'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // ProjectMembership - Admin only
  ProjectMembership: {
    create: ['super-admin', 'project-admin'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // Subscription - Admin only
  Subscription: {
    create: ['super-admin', 'project-admin'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // DiagnosticReport - Clinical only
  DiagnosticReport: {
    create: ['super-admin', 'project-admin', 'provider'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // ServiceRequest - Clinical only
  ServiceRequest: {
    create: ['super-admin', 'project-admin', 'provider'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },

  // Task - All roles can create/edit
  Task: {
    create: ['super-admin', 'project-admin', 'provider', 'coordinator'],
    delete: ['super-admin', 'project-admin'],
    export: ['super-admin', 'project-admin'],
    bulk: ['super-admin', 'project-admin'],
  },
};

/**
 * Get permissions for a specific resource type
 * Falls back to default permissions if not defined
 *
 * @param resourceType - The FHIR resource type
 * @returns TablePermissions for that resource
 */
export function getTablePermissions(resourceType: string): TablePermissions {
  return TABLE_PERMISSIONS[resourceType] ?? DEFAULT_PERMISSIONS;
}

/**
 * Check if a role has permission for a specific action on a resource
 *
 * @param resourceType - The FHIR resource type
 * @param action - The action to check (create, delete, export, bulk)
 * @param role - The user's MedSpa role
 * @returns True if the role has permission
 */
export function hasTablePermission(
  resourceType: string,
  action: keyof TablePermissions,
  role: MedSpaRole
): boolean {
  const permissions = getTablePermissions(resourceType);
  return permissions[action].includes(role);
}

/**
 * Check if a role can create resources of a given type
 * Convenience function
 */
export function canCreate(resourceType: string, role: MedSpaRole): boolean {
  return hasTablePermission(resourceType, 'create', role);
}

/**
 * Check if a role can delete resources of a given type
 * Convenience function
 */
export function canDelete(resourceType: string, role: MedSpaRole): boolean {
  return hasTablePermission(resourceType, 'delete', role);
}

/**
 * Check if a role can export resources of a given type
 * Convenience function
 */
export function canExport(resourceType: string, role: MedSpaRole): boolean {
  return hasTablePermission(resourceType, 'export', role);
}

/**
 * Check if a role can perform bulk operations on a given type
 * Convenience function
 */
export function canBulk(resourceType: string, role: MedSpaRole): boolean {
  return hasTablePermission(resourceType, 'bulk', role);
}
