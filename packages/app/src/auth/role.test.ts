import { MockClient } from '@medplum/mock';
import { getMedSpaRole, isMainProviderEligible, isAssistantEligible, canAccess, isRouteAccessible, filterMenuLinks, filterPatientTabs, canEditPatient, canCreateClinicalDocs, canManageBilling } from './role';
import type { Practitioner } from '@medplum/fhirtypes';

describe('Auth Role Utilities', () => {
  let medplum: MockClient;

  beforeEach(() => {
    medplum = new MockClient();
  });

  describe('getMedSpaRole', () => {
    test.todo('should return super-admin for super admin users');
    test.todo('should return project-admin for project admins');
    test.todo('should return provider for users with userType=provider');
    test.todo('should return assistant for users with userType=assistant');
    test.todo('should return coordinator for users with userType=coordinator');
    test.todo('should infer provider role from AccessPolicy name');
    test.todo('should infer assistant role from AccessPolicy reference');
    test.todo('should default to coordinator for safety');
  });

  describe('isMainProviderEligible', () => {
    test.todo('should allow RNs as main providers');
    test.todo('should allow NPs as main providers');
    test.todo('should allow MDs as main providers');
    test.todo('should allow PAs as main providers');
    test.todo('should allow providers with medspa-role=provider extension');
    test.todo('should exclude coordinators');
    test.todo('should exclude assistants');
    test.todo('should exclude admins');
    test.todo('should exclude unqualified practitioners');
    test.todo('should require explicit clinical qualification');
  });

  describe('isAssistantEligible', () => {
    test.todo('should allow assistants');
    test.todo('should allow providers (they can assist too)');
    test.todo('should allow RNs, NPs, MDs as assistants');
    test.todo('should exclude coordinators');
    test.todo('should exclude admins');
    test.todo('should check medspa-role extension for assistant');
    test.todo('should check medspa-role extension for provider');
  });

  describe('canAccess', () => {
    test.todo('should allow super-admin access to all features');
    test.todo('should allow project-admin access to all features');
    test.todo('should allow provider access to clinical features');
    test.todo('should allow assistant access to clinical features');
    test.todo('should restrict coordinator from clinical features');
    test.todo('should allow coordinator scheduling access');
  });

  describe('isRouteAccessible', () => {
    test.todo('should block admin routes for non-admins');
    test.todo('should allow admin routes for super-admins');
    test.todo('should allow admin routes for project-admins');
    test.todo('should block lab routes for non-admins');
    test.todo('should allow general routes for all users');
  });

  describe('filterMenuLinks', () => {
    test.todo('should show all links to admins');
    test.todo('should hide lab links from providers');
    test.todo('should hide lab links from coordinators');
    test.todo('should hide admin links from non-admins');
    test.todo('should hide DiagnosticReport links');
    test.todo('should hide ServiceRequest links');
    test.todo('should hide Organization links');
  });

  describe('filterPatientTabs', () => {
    test.todo('should show all tabs to admins');
    test.todo('should hide admin-only tabs (Event, Blame, JSON, etc)');
    test.todo('should hide Edit tab for coordinators');
    test.todo('should show Edit tab for providers');
  });

  describe('canEditPatient', () => {
    test.todo('should allow super-admin to edit');
    test.todo('should allow project-admin to edit');
    test.todo('should allow provider to edit');
    test.todo('should deny coordinator from editing');
  });

  describe('canCreateClinicalDocs', () => {
    test.todo('should allow super-admin');
    test.todo('should allow project-admin');
    test.todo('should allow provider');
    test.todo('should deny coordinator');
  });

  describe('canManageBilling', () => {
    test.todo('should allow super-admin');
    test.todo('should allow project-admin');
    test.todo('should allow coordinator');
    test.todo('should deny provider');
  });
});
