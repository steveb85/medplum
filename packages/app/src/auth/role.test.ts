import { MockClient } from '@medplum/mock';
import type { Practitioner } from '@medplum/fhirtypes';
import {
  getMedSpaRole,
  isMainProviderEligible,
  isAssistantEligible,
  canAccess,
  isRouteAccessible,
  filterMenuLinks,
  filterPatientTabs,
  canEditPatient,
  canCreateClinicalDocs,
  canManageBilling,
} from './role';

describe('Auth Role Utilities', () => {
  let medplum: MockClient;

  beforeEach(() => {
    medplum = new MockClient();
  });

  describe('getMedSpaRole', () => {
    test('should return super-admin for super admin users', () => {
      jest.spyOn(medplum, 'isSuperAdmin').mockReturnValue(true);
      expect(getMedSpaRole(medplum)).toBe('super-admin');
    });

    test('should return project-admin for project admins', () => {
      jest.spyOn(medplum, 'isSuperAdmin').mockReturnValue(false);
      jest.spyOn(medplum, 'isProjectAdmin').mockReturnValue(true);
      expect(getMedSpaRole(medplum)).toBe('project-admin');
    });

    test('should return provider for users with userType=provider', () => {
      medplum.getUserConfiguration = jest.fn().mockReturnValue({
        resourceType: 'UserConfiguration',
        id: 'test-config',
        option: [{ id: 'userType', valueString: 'provider' }],
      });
      expect(getMedSpaRole(medplum)).toBe('provider');
    });

    test('should return assistant for users with userType=assistant', () => {
      medplum.getUserConfiguration = jest.fn().mockReturnValue({
        resourceType: 'UserConfiguration',
        id: 'test-config',
        option: [{ id: 'userType', valueString: 'assistant' }],
      });
      expect(getMedSpaRole(medplum)).toBe('assistant');
    });

    test('should return coordinator for users with userType=coordinator', () => {
      medplum.getUserConfiguration = jest.fn().mockReturnValue({
        resourceType: 'UserConfiguration',
        id: 'test-config',
        option: [{ id: 'userType', valueString: 'coordinator' }],
      });
      expect(getMedSpaRole(medplum)).toBe('coordinator');
    });

    test('should infer provider role from AccessPolicy display name', () => {
      medplum.getProjectMembership = jest.fn().mockReturnValue({
        id: 'membership-1',
        access: [{ policy: { display: 'Provider Access Policy' } }],
      });
      expect(getMedSpaRole(medplum)).toBe('provider');
    });

    test('should infer assistant role from AccessPolicy reference', () => {
      medplum.getProjectMembership = jest.fn().mockReturnValue({
        id: 'membership-1',
        access: [{ policy: { reference: 'AccessPolicy/assistant-policy' } }],
      });
      expect(getMedSpaRole(medplum)).toBe('assistant');
    });

    test('should default to coordinator for safety', () => {
      expect(getMedSpaRole(medplum)).toBe('coordinator');
    });
  });

  describe('isMainProviderEligible', () => {
    test('should allow RNs as main providers', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1', qualification: [{ code: { coding: [{ code: 'RN' }] } }] };
      expect(isMainProviderEligible(p)).toBe(true);
    });

    test('should allow NPs as main providers', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1', qualification: [{ code: { coding: [{ code: 'NP' }] } }] };
      expect(isMainProviderEligible(p)).toBe(true);
    });

    test('should allow MDs as main providers', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1', qualification: [{ code: { coding: [{ code: 'MD' }] } }] };
      expect(isMainProviderEligible(p)).toBe(true);
    });

    test('should allow PAs as main providers', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1', qualification: [{ code: { coding: [{ code: 'PA' }] } }] };
      expect(isMainProviderEligible(p)).toBe(true);
    });

    test('should allow providers with medspa-role=provider extension', () => {
      const p: Practitioner = {
        resourceType: 'Practitioner',
        id: 'p1',
        extension: [{ url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role', valueString: 'provider' }],
      };
      expect(isMainProviderEligible(p)).toBe(true);
    });

    test('should exclude coordinators', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1', qualification: [{ code: { coding: [{ code: 'coordinator' }] } }] };
      expect(isMainProviderEligible(p)).toBe(false);
    });

    test('should exclude assistants', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1', qualification: [{ code: { coding: [{ code: 'assistant' }] } }] };
      expect(isMainProviderEligible(p)).toBe(false);
    });

    test('should exclude admins', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1', qualification: [{ code: { coding: [{ code: 'admin' }] } }] };
      expect(isMainProviderEligible(p)).toBe(false);
    });

    test('should default to false for unknown practitioners', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1' };
      expect(isMainProviderEligible(p)).toBe(false);
    });
  });

  describe('isAssistantEligible', () => {
    test('should allow assistants', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1', qualification: [{ code: { coding: [{ code: 'assistant' }] } }] };
      expect(isAssistantEligible(p)).toBe(true);
    });

    test('should allow RNs as assistants', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1', qualification: [{ code: { coding: [{ code: 'RN' }] } }] };
      expect(isAssistantEligible(p)).toBe(true);
    });

    test('should exclude coordinators', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1', qualification: [{ code: { coding: [{ code: 'coordinator' }] } }] };
      expect(isAssistantEligible(p)).toBe(false);
    });

    test('should exclude admins', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1', qualification: [{ code: { coding: [{ code: 'admin' }] } }] };
      expect(isAssistantEligible(p)).toBe(false);
    });

    test('should check medspa-role extension for assistant', () => {
      const p: Practitioner = {
        resourceType: 'Practitioner',
        id: 'p1',
        extension: [{ url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role', valueString: 'assistant' }],
      };
      expect(isAssistantEligible(p)).toBe(true);
    });

    test('should check medspa-role extension for provider', () => {
      const p: Practitioner = {
        resourceType: 'Practitioner',
        id: 'p1',
        extension: [{ url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role', valueString: 'provider' }],
      };
      expect(isAssistantEligible(p)).toBe(true);
    });

    test('should exclude medspa-role admin from assistants', () => {
      const p: Practitioner = {
        resourceType: 'Practitioner',
        id: 'p1',
        extension: [{ url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role', valueString: 'admin' }],
      };
      expect(isAssistantEligible(p)).toBe(false);
    });

    test('should default to false for no qualifications', () => {
      const p: Practitioner = { resourceType: 'Practitioner', id: 'p1' };
      expect(isAssistantEligible(p)).toBe(false);
    });
  });

  describe('canAccess', () => {
    test('should allow super-admin access to all features', () => {
      expect(canAccess('super-admin', 'labs')).toBe(true);
      expect(canAccess('super-admin', 'clinical-docs')).toBe(true);
      expect(canAccess('super-admin', 'billing-edit')).toBe(true);
    });

    test('should allow project-admin access to all features', () => {
      expect(canAccess('project-admin', 'labs')).toBe(true);
      expect(canAccess('project-admin', 'clinical-docs')).toBe(true);
    });

    test('should allow provider access to clinical features', () => {
      expect(canAccess('provider', 'clinical-docs')).toBe(true);
    });

    test('should allow assistant access to clinical features', () => {
      expect(canAccess('assistant', 'clinical-docs')).toBe(true);
    });

    test('should restrict coordinator from clinical features', () => {
      expect(canAccess('coordinator', 'clinical-docs')).toBe(false);
    });

    test('should allow coordinator billing access', () => {
      expect(canAccess('coordinator', 'billing-edit')).toBe(true);
    });

    test('should deny provider billing access', () => {
      expect(canAccess('provider', 'billing-edit')).toBe(false);
    });
  });

  describe('isRouteAccessible', () => {
    test('should block admin routes for non-admins', () => {
      expect(isRouteAccessible('/admin/sites', 'coordinator')).toBe(false);
      expect(isRouteAccessible('/admin/sites', 'provider')).toBe(false);
    });

    test('should allow admin routes for super-admins', () => {
      expect(isRouteAccessible('/admin/sites', 'super-admin')).toBe(true);
    });

    test('should allow admin routes for project-admins', () => {
      expect(isRouteAccessible('/admin/sites', 'project-admin')).toBe(true);
    });

    test('should block lab routes for non-admins', () => {
      expect(isRouteAccessible('/lab/assays', 'coordinator')).toBe(false);
    });

    test('should allow general routes for all users', () => {
      expect(isRouteAccessible('/Patient', 'coordinator')).toBe(true);
      expect(isRouteAccessible('/calendar', 'provider')).toBe(true);
    });
  });

  describe('filterMenuLinks', () => {
    const links = [
      { href: '/Patient', label: 'Patients' },
      { href: '/admin/project', label: 'Project' },
      { href: '/lab/assays', label: 'Assays' },
      { href: '/DiagnosticReport', label: 'Reports' },
      { href: '/ServiceRequest', label: 'Requests' },
      { href: '/Organization', label: 'Org' },
      { href: '/calendar', label: 'Calendar' },
    ];

    test('should show all links to admins', () => {
      expect(filterMenuLinks(links, 'super-admin')).toHaveLength(7);
      expect(filterMenuLinks(links, 'project-admin')).toHaveLength(7);
    });

    test('should hide lab links from providers', () => {
      const filtered = filterMenuLinks(links, 'provider');
      expect(filtered.find((l) => l.href.startsWith('/lab/'))).toBeUndefined();
    });

    test('should hide lab links from coordinators', () => {
      const filtered = filterMenuLinks(links, 'coordinator');
      expect(filtered.find((l) => l.href.startsWith('/lab/'))).toBeUndefined();
    });

    test('should hide admin links from non-admins', () => {
      const filtered = filterMenuLinks(links, 'provider');
      expect(filtered.find((l) => l.href.startsWith('/admin/'))).toBeUndefined();
    });

    test('should hide DiagnosticReport links', () => {
      const filtered = filterMenuLinks(links, 'provider');
      expect(filtered.find((l) => l.href.startsWith('/DiagnosticReport'))).toBeUndefined();
    });

    test('should hide ServiceRequest links', () => {
      const filtered = filterMenuLinks(links, 'provider');
      expect(filtered.find((l) => l.href.startsWith('/ServiceRequest'))).toBeUndefined();
    });

    test('should hide Organization links', () => {
      const filtered = filterMenuLinks(links, 'provider');
      expect(filtered.find((l) => l.href.startsWith('/Organization'))).toBeUndefined();
    });

    test('should keep non-restricted links for non-admins', () => {
      const filtered = filterMenuLinks(links, 'provider');
      expect(filtered.find((l) => l.href === '/Patient')).toBeDefined();
      expect(filtered.find((l) => l.href === '/calendar')).toBeDefined();
    });
  });

  describe('filterPatientTabs', () => {
    const allTabs = ['Timeline', 'Details', 'Edit', 'History', 'Event', 'Blame', 'JSON', 'Apps', 'Profiles', 'Export', 'Accounts'];

    test('should show all tabs to admins', () => {
      expect(filterPatientTabs(allTabs, 'super-admin')).toEqual(allTabs);
      expect(filterPatientTabs(allTabs, 'project-admin')).toEqual(allTabs);
    });

    test('should hide admin-only tabs (Event, Blame, JSON, etc)', () => {
      const filtered = filterPatientTabs(allTabs, 'provider');
      expect(filtered).not.toContain('Event');
      expect(filtered).not.toContain('Blame');
      expect(filtered).not.toContain('JSON');
      expect(filtered).not.toContain('Apps');
      expect(filtered).not.toContain('Export');
    });

    test('should hide Edit tab for coordinators', () => {
      const filtered = filterPatientTabs(allTabs, 'coordinator');
      expect(filtered).not.toContain('Edit');
    });

    test('should show Edit tab for providers', () => {
      const filtered = filterPatientTabs(allTabs, 'provider');
      expect(filtered).toContain('Edit');
    });
  });

  describe('canEditPatient', () => {
    test('should allow super-admin to edit', () => {
      expect(canEditPatient('super-admin')).toBe(true);
    });

    test('should allow project-admin to edit', () => {
      expect(canEditPatient('project-admin')).toBe(true);
    });

    test('should allow provider to edit', () => {
      expect(canEditPatient('provider')).toBe(true);
    });

    test('should deny coordinator from editing', () => {
      expect(canEditPatient('coordinator')).toBe(false);
    });
  });

  describe('canCreateClinicalDocs', () => {
    test('should allow super-admin', () => {
      expect(canCreateClinicalDocs('super-admin')).toBe(true);
    });

    test('should allow project-admin', () => {
      expect(canCreateClinicalDocs('project-admin')).toBe(true);
    });

    test('should allow provider', () => {
      expect(canCreateClinicalDocs('provider')).toBe(true);
    });

    test('should deny coordinator', () => {
      expect(canCreateClinicalDocs('coordinator')).toBe(false);
    });
  });

  describe('canManageBilling', () => {
    test('should allow super-admin', () => {
      expect(canManageBilling('super-admin')).toBe(true);
    });

    test('should allow project-admin', () => {
      expect(canManageBilling('project-admin')).toBe(true);
    });

    test('should allow coordinator', () => {
      expect(canManageBilling('coordinator')).toBe(true);
    });

    test('should deny provider', () => {
      expect(canManageBilling('provider')).toBe(false);
    });
  });
});
