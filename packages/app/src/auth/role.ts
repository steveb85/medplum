// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { MedplumClient } from '@medplum/core';

/**
 * Nurse Mel MedSpa Role Hierarchy
 *
 * Super Admin (Platform)
 * └── Project Admin (Project)
 *     ├── Provider (Clinical)
 *     └── Coordinator (Operations)
 *
 * @see docs/roles.md for full documentation
 */

export type MedSpaRole = 'super-admin' | 'project-admin' | 'provider' | 'coordinator';

/**
 * Feature flags for UI filtering
 * Each feature represents a distinct capability in the application
 */
export type MedSpaFeature =
  | 'labs'
  | 'bots'
  | 'clients'
  | 'admin-settings'
  | 'clinical-docs'
  | 'billing-edit'
  | 'scheduling'
  | 'photos'
  | 'intake-forms'
  | 'labs-view';

/**
 * Get the user's MedSpa role based on their Medplum permissions
 *
 * Hierarchy:
 * 1. Super Admin (medplum.isSuperAdmin())
 * 2. Project Admin (medplum.isProjectAdmin())
 * 3. Provider (AccessPolicy or UserConfiguration)
 * 4. Coordinator (default - safest)
 *
 * @param medplum - The Medplum client instance
 * @returns The user's role
 */
export function getMedSpaRole(medplum: MedplumClient): MedSpaRole {
  // Check for Super Admin
  if (medplum.isSuperAdmin()) {
    return 'super-admin';
  }

  // Check for Project Admin
  if (medplum.isProjectAdmin()) {
    return 'project-admin';
  }

  // Check UserConfiguration for explicit role setting
  const config = medplum.getUserConfiguration();
  const userType = config?.option?.find((o: { id: string }) => o.id === 'userType')?.valueString;

  if (userType === 'provider') {
    return 'provider';
  }

  if (userType === 'coordinator') {
    return 'coordinator';
  }

  // Check AccessPolicy name for role hints
  const membership = medplum.getProjectMembership();

  // Try to infer from AccessPolicy or other metadata
  if (membership?.admin) {
    return 'project-admin';
  }

  // Check AccessPolicy name for provider hints
  const accessPolicy = membership?.access?.[0]?.policy;
  if (accessPolicy) {
    const policyName = (accessPolicy.display || '').toLowerCase();
    if (policyName.includes('provider')) {
      return 'provider';
    }
    if (policyName.includes('coordinator')) {
      return 'coordinator';
    }
  }

  // Check AccessPolicy reference
  const accessPolicyRef = membership?.access?.[0]?.policy?.reference;
  if (accessPolicyRef) {
    const policyName = accessPolicyRef.toLowerCase();
    if (policyName.includes('provider')) {
      return 'provider';
    }
    if (policyName.includes('coordinator')) {
      return 'coordinator';
    }
  }

  // Default to coordinator for safety
  // This ensures new users have limited access until explicitly granted
  return 'coordinator';
}

/**
 * Check if a role can access a specific feature
 *
 * @param role - The user's role
 * @param feature - The feature to check
 * @returns True if the role has access to the feature
 */
export function canAccess(role: MedSpaRole, feature: MedSpaFeature): boolean {
  const permissions: Record<MedSpaRole, string[]> = {
    'super-admin': ['*'],
    'project-admin': ['*'],
    provider: ['clinical-docs', 'labs-view', 'scheduling', 'photos', 'intake-forms'],
    coordinator: ['scheduling', 'photos', 'billing-edit', 'intake-forms'],
  };

  if (permissions[role].includes('*')) {
    return true;
  }

  return permissions[role].includes(feature);
}

/**
 * Check if a route is accessible to a given role
 *
 * @param route - The route path
 * @param role - The user's role
 * @returns True if the route is accessible
 */
export function isRouteAccessible(route: string, role: MedSpaRole): boolean {
  // Admin routes - only accessible to admins
  if (route.startsWith('/admin/')) {
    return role === 'super-admin' || role === 'project-admin';
  }

  // Lab routes - restricted
  if (route.startsWith('/lab/')) {
    return role === 'super-admin' || role === 'project-admin';
  }

  // All other routes are accessible to everyone
  // AccessPolicy will enforce actual security
  return true;
}

/**
 * Filter menu links based on user role
 *
 * @param links - Array of menu links
 * @param role - The user's role
 * @returns Filtered array of links
 */
export function filterMenuLinks<T extends { href: string }>(links: T[], role: MedSpaRole): T[] {
  if (role === 'super-admin' || role === 'project-admin') {
    return links;
  }

  return links.filter((link) => {
    // Hide lab links from providers and coordinators
    if (link.href.startsWith('/lab/')) {
      return false;
    }
    
    // get rid of diagnostic report
    if (link.href.startsWith('/DiagnosticReport')) {
      return false;
    }
    // get rid of service request
    if (link.href.startsWith('/ServiceRequest')) {
      return false;
    }
    // get rid of orgnanization
    if (link.href.startsWith('/Organization')) {
      return false;
    }

    // Hide admin links from non-admins
    if (link.href.startsWith('/admin/')) {
      return false;
    }

    return true;
  });
}

/**
 * Filter patient tabs based on user role
 *
 * @param tabs - Array of tab names
 * @param role - The user's role
 * @returns Filtered array of tab names
 */
export function filterPatientTabs(tabs: string[], role: MedSpaRole): string[] {
  if (role === 'super-admin' || role === 'project-admin') {
    return tabs;
  }

  // Tabs that should be hidden for non-admins
  const adminOnlyTabs = ['Event', 'Blame', 'JSON', 'Apps', 'Profiles', 'Export', 'History', 'Accounts'];

  // Tabs that should be hidden for coordinators
  const coordinatorHiddenTabs = ['Edit'];
  
  return tabs.filter((tab) => {
    // Hide admin-only tabs
    if (adminOnlyTabs.includes(tab)) {
      return false;
    }

    // Hide coordinator-restricted tabs
    if (role === 'coordinator' && coordinatorHiddenTabs.includes(tab)) {
      return false;
    }

    return true;
  });
}

/**
 * Check if the user can edit a patient record
 *
 * @param role - The user's role
 * @returns True if editing is allowed
 */
export function canEditPatient(role: MedSpaRole): boolean {
  return role === 'super-admin' || role === 'project-admin' || role === 'provider';
}

/**
 * Check if the user can create clinical documentation
 *
 * @param role - The user's role
 * @returns True if clinical documentation is allowed
 */
export function canCreateClinicalDocs(role: MedSpaRole): boolean {
  return role === 'super-admin' || role === 'project-admin' || role === 'provider';
}

/**
 * Check if the user can manage billing
 *
 * @param role - The user's role
 * @returns True if billing management is allowed
 */
export function canManageBilling(role: MedSpaRole): boolean {
  return (
    role === 'super-admin' ||
    role === 'project-admin' ||
    role === 'coordinator'
  );
}
