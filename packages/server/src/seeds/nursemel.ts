// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { createReference, getReferenceString } from '@medplum/core';
import type {
  AccessPolicy,
  ActivityDefinition,
  Appointment,
  Binary,
  Bot,
  Device,
  Location,
  Organization,
  Patient,
  Practitioner,
  Project,
  ProjectMembership,
  ProjectMembershipAccess,
  Questionnaire,
  QuestionnaireResponse,
  Subscription,
  User,
  UserConfiguration,
} from '@medplum/fhirtypes';
import { Readable } from 'node:stream';
import { bcryptHashPassword, createProfile, createProjectMembership } from '../auth/utils';
import type { SystemRepository } from '../fhir/repo';
import { globalLogger } from '../logger';
import { getBinaryStorage } from '../storage/loader';

// Nurse Mel - Provider
const NURSE_MEL_DATA = {
  firstName: 'Melissa',
  lastName: 'Knudson',
  email: 'melissa@melissaknudson.com',
  password: 'medplum_provider',
};

// Coordinator - Front desk staff
const COORDINATOR_DATA = {
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'coordinator@melissaknudson.com',
  password: 'medplum_coord',
};

// Project Admin - Administrator within Nurse Mel project
const PROJECT_ADMIN_DATA = {
  firstName: 'Boss boss',
  lastName: 'Administrator',
  email: 'admin@nursemel.com',
  password: 'medplum_admin',
};

// Assistant - Clinical assistant (same permissions as provider, separate role for future customization)
const ASSISTANT_DATA = {
  firstName: 'Lauren',
  lastName: 'Chen',
  email: 'assistant@nursemel.com',
  password: 'medplum_assistant',
};

// Organization
const ORGANIZATION_DATA = {
  name: 'Nurse Mel Aesthetics',
  alias: ['Nurse Mel MedSpa'],
  phone: '+1-212-555-0147',
  address: {
    line: ['116 Chambers St'],
    city: 'New York',
    state: 'NY',
    postalCode: '10007',
  },
};

const PATIENTS = [
  {
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah.chen@email.com',
    phone: '+1-212-555-0101',
    birthDate: '1988-03-15',
    gender: 'female' as const,
    address: { line: ['123 Greenwich St'], city: 'New York', state: 'NY', postalCode: '10013' },
    hasPreviousBotox: true,
    concerns: ['forehead lines', 'crows_feet'],
  },
  {
    firstName: 'Jessica',
    lastName: 'Rodriguez',
    email: 'jessica.r@email.com',
    phone: '+1-646-555-0202',
    birthDate: '1992-07-22',
    gender: 'female' as const,
    address: { line: ['456 Broadway'], city: 'New York', state: 'NY', postalCode: '10012' },
    hasPreviousBotox: false,
    concerns: ['elevens', 'forehead_wrinkles'],
  },
  {
    firstName: 'Amanda',
    lastName: 'Thompson',
    email: 'amanda.t@email.com',
    phone: '+1-917-555-0303',
    birthDate: '1985-11-08',
    gender: 'female' as const,
    address: { line: ['789 Canal St'], city: 'New York', state: 'NY', postalCode: '10013' },
    hasPreviousBotox: true,
    concerns: ['crows_feet', 'brow_lift'],
  },
];

export async function seedNurseMelData(systemRepo: SystemRepository, project: Project): Promise<void> {
  globalLogger.info('Seeding Nurse Mel test data...');

  // Create Organization
  const organization = await createOrganization(systemRepo, project);

  // Create Locations (Rooms)
  const room1 = await createTreatmentRoom(systemRepo, project, 'room-1', 'Treatment Room 1');
  const room2 = await createTreatmentRoom(systemRepo, project, 'room-2', 'Treatment Room 2');
  globalLogger.info(`Created treatment rooms: Room 1 (id: ${room1.id}), Room 2 (id: ${room2.id})`);

  // Create Service Catalog (ActivityDefinitions)
  await createServiceCatalog(systemRepo, project);
  globalLogger.info('Created service catalog (ActivityDefinitions)');

  // Create AccessPolicies
  const providerPolicy = await createProviderAccessPolicy(systemRepo, project);
  const coordinatorPolicy = await createCoordinatorAccessPolicy(systemRepo, project);
  const adminPolicy = await createProjectAdminAccessPolicy(systemRepo, project);
  const assistantPolicy = await createAssistantAccessPolicy(systemRepo, project);

  // Create Nurse Mel with login credentials
  const nurseMel = await createNurseMelPractitioner(systemRepo, project, providerPolicy);

  // Create Coordinator with login credentials
  await createCoordinator(systemRepo, project, coordinatorPolicy);

  // Create Project Admin with login credentials (admin: true, within Nurse Mel project)
  await createProjectAdmin(systemRepo, project, adminPolicy);

  // Create Assistant with login credentials (same permissions as provider, separate role)
  const assistant = await createAssistant(systemRepo, project, assistantPolicy);

  // Create test patients
  const createdPatients: { id: string; data: (typeof PATIENTS)[0] }[] = [];
  for (let i = 0; i < PATIENTS.length; i++) {
    const patient = await createPatient(systemRepo, project, PATIENTS[i], i, organization);
    createdPatients.push({ id: patient.id as string, data: PATIENTS[i] });
  }

  // Create Botox intake questionnaire
  const questionnaire = await createBotoxQuestionnaire(systemRepo, project);

  // Create appointments (for Nurse Mel and Assistant)
  await createSampleAppointments(systemRepo, project, [nurseMel, assistant], createdPatients);

  // Create questionnaire responses
  if (questionnaire.id) {
    await createQuestionnaireResponses(systemRepo, project, questionnaire, createdPatients);
  }

  // Create push notification bot and subscription (auto-deployed)
  const pushBot = await createPushNotificationBot(systemRepo, project);
  if (pushBot.id) {
    await createPushNotificationSubscription(systemRepo, project, pushBot);
  }

  globalLogger.info('Nurse Mel test data seeding complete');
  globalLogger.info('');
  globalLogger.info('==============================================================');
  globalLogger.info('SEEDED LOGIN CREDENTIALS:');
  globalLogger.info(' Super Admin: admin@example.com / medplum_admin');
  globalLogger.info(` Project Admin: ${PROJECT_ADMIN_DATA.email} / ${PROJECT_ADMIN_DATA.password}`);
  globalLogger.info(` Provider: ${NURSE_MEL_DATA.email} / ${NURSE_MEL_DATA.password}`);
  globalLogger.info(` Assistant: ${ASSISTANT_DATA.email} / ${ASSISTANT_DATA.password}`);
  globalLogger.info(` Coordinator: ${COORDINATOR_DATA.email} / ${COORDINATOR_DATA.password}`);
  globalLogger.info('==============================================================');
  globalLogger.info('SEEDED LOGIN CREDENTIALS:');
  globalLogger.info(' Super Admin: admin@example.com / medplum_admin');
  globalLogger.info(` Project Admin: ${PROJECT_ADMIN_DATA.email} / ${PROJECT_ADMIN_DATA.password}`);
  globalLogger.info(` Provider: ${NURSE_MEL_DATA.email} / ${NURSE_MEL_DATA.password}`);
  globalLogger.info(` Coordinator: ${COORDINATOR_DATA.email} / ${COORDINATOR_DATA.password}`);
  globalLogger.info('==============================================================');
  globalLogger.info('SEEDED LOGIN CREDENTIALS:');
  globalLogger.info('  Super Admin: admin@example.com / medplum_admin');
  globalLogger.info(`  Provider: ${NURSE_MEL_DATA.email} / ${NURSE_MEL_DATA.password}`);
  globalLogger.info(`  Coordinator: ${COORDINATOR_DATA.email} / ${COORDINATOR_DATA.password}`);
  globalLogger.info('==============================================================');
}

async function createOrganization(systemRepo: SystemRepository, project: Project): Promise<Organization> {
  const existing = await systemRepo.searchOne<Organization>({
    resourceType: 'Organization',
    filters: [{ code: 'name', operator: 'eq', value: ORGANIZATION_DATA.name }],
  });

  if (existing) {
    globalLogger.info('Organization already exists');
    return existing;
  }

  const organization = await systemRepo.createResource<Organization>({
    resourceType: 'Organization',
    meta: { project: project.id },
    name: ORGANIZATION_DATA.name,
    alias: ORGANIZATION_DATA.alias,
    telecom: [{ system: 'phone', value: ORGANIZATION_DATA.phone, use: 'work' }],
    address: [
      {
        use: 'work',
        type: 'both',
        line: ORGANIZATION_DATA.address.line,
        city: ORGANIZATION_DATA.address.city,
        state: ORGANIZATION_DATA.address.state,
        postalCode: ORGANIZATION_DATA.address.postalCode,
        country: 'US',
      },
    ],
  });

  globalLogger.info(`Created Organization: ${organization.name} (${organization.id})`);
  return organization;
}

async function createProviderAccessPolicy(systemRepo: SystemRepository, project: Project): Promise<AccessPolicy> {
  const existing = await systemRepo.searchOne<AccessPolicy>({
    resourceType: 'AccessPolicy',
    filters: [{ code: 'name', operator: 'eq', value: 'MedSpa Provider Policy' }],
  });

  if (existing) {
    return existing;
  }

  const policy = await systemRepo.createResource<AccessPolicy>({
    resourceType: 'AccessPolicy',
    meta: { project: project.id },
    name: 'MedSpa Provider Policy',
    resource: [
      { resourceType: 'Patient', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      // Can see all practitioners, but only update own profile
      { resourceType: 'Practitioner', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Practitioner', criteria: 'Practitioner?_id=%profile.id', interaction: ['update'] },
      { resourceType: 'Appointment', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Encounter', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Procedure', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Observation', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Media', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Binary', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'DocumentReference', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Questionnaire', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'QuestionnaireResponse', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'Consent', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Invoice', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Organization', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Bundle', interaction: ['read', 'create'] },
      { resourceType: 'Communication', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      // Additional resources for Patient view
      { resourceType: 'RelatedPerson', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'CareTeam', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Coverage', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Account', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Subscription', interaction: ['read', 'create', 'delete'] },
      // Clinical resources that may be queried
      { resourceType: 'ServiceRequest', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'DiagnosticReport', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'MedicationRequest', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'AllergyIntolerance', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Condition', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Immunization', interaction: ['read', 'vread', 'search'] },
      // Service catalog (ActivityDefinitions)
      { resourceType: 'ActivityDefinition', interaction: ['read', 'vread', 'search'] },
      // Equipment management
      { resourceType: 'Device', interaction: ['read', 'vread', 'search'] },
      // Numbing tasks and audit events
      { resourceType: 'Task', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'AuditEvent', interaction: ['read', 'vread', 'create', 'search'] },
    ],
  });

  globalLogger.info(`Created Provider AccessPolicy: ${policy.id}`);
  return policy;
}

async function createCoordinatorAccessPolicy(systemRepo: SystemRepository, project: Project): Promise<AccessPolicy> {
  const existing = await systemRepo.searchOne<AccessPolicy>({
    resourceType: 'AccessPolicy',
    filters: [{ code: 'name', operator: 'eq', value: 'MedSpa Coordinator Policy' }],
  });

  if (existing) {
    return existing;
  }

  const policy = await systemRepo.createResource<AccessPolicy>({
    resourceType: 'AccessPolicy',
    meta: { project: project.id },
    name: 'MedSpa Coordinator Policy',
    resource: [
      { resourceType: 'Patient', interaction: ['read', 'vread', 'create', 'search'] },
      // Can see all practitioners, but only update own profile
      { resourceType: 'Practitioner', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Practitioner', criteria: 'Practitioner?_id=%profile.id', interaction: ['update'] },
      { resourceType: 'Appointment', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Encounter', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Procedure', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Observation', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Media', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'Binary', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'DocumentReference', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Questionnaire', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'QuestionnaireResponse', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Consent', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Invoice', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'PaymentReconciliation', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Organization', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Bundle', interaction: ['read', 'create'] },
      { resourceType: 'Communication', interaction: ['read', 'vread', 'create', 'search'] },
      // Additional resources for Patient view (read-only for coordinators)
      { resourceType: 'RelatedPerson', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'CareTeam', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Coverage', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Account', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Subscription', interaction: ['read', 'create', 'delete'] },
      // Clinical resources that may be queried (read-only for coordinators)
      { resourceType: 'ServiceRequest', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'DiagnosticReport', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'MedicationRequest', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'AllergyIntolerance', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Condition', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Immunization', interaction: ['read', 'vread', 'search'] },
      // Service catalog (ActivityDefinitions) - needed for booking
      { resourceType: 'ActivityDefinition', interaction: ['read', 'vread', 'search'] },
      // Equipment management
      { resourceType: 'Device', interaction: ['read', 'vread', 'search'] },
      // Numbing tasks and audit events
      { resourceType: 'Task', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'AuditEvent', interaction: ['read', 'vread', 'search'] },
    ],
  });

  globalLogger.info(`Created Coordinator AccessPolicy: ${policy.id}`);
  return policy;
}

async function createProjectAdminAccessPolicy(systemRepo: SystemRepository, project: Project): Promise<AccessPolicy> {
  const existing = await systemRepo.searchOne<AccessPolicy>({
    resourceType: 'AccessPolicy',
    filters: [{ code: 'name', operator: 'eq', value: 'MedSpa Project Admin Policy' }],
  });

  if (existing) {
    return existing;
  }

  const policy = await systemRepo.createResource<AccessPolicy>({
    resourceType: 'AccessPolicy',
    meta: { project: project.id },
    name: 'MedSpa Project Admin Policy',
    resource: [
      // All Provider permissions (full CRUD on clinical data)
      { resourceType: 'Patient', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Practitioner', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Appointment', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Encounter', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Procedure', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Observation', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Media', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Binary', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'DocumentReference', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Questionnaire', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'QuestionnaireResponse', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Consent', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Invoice', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'PaymentReconciliation', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Organization', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Bundle', interaction: ['read', 'create'] },
      { resourceType: 'Communication', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'RelatedPerson', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'CareTeam', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Coverage', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Account', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Subscription', interaction: ['read', 'create', 'delete'] },
      { resourceType: 'ServiceRequest', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'DiagnosticReport', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'MedicationRequest', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'AllergyIntolerance', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Condition', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Immunization', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      // Admin-specific permissions
      { resourceType: 'AccessPolicy', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'User', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'ProjectMembership', interaction: ['read', 'vread', 'create', 'update', 'delete', 'search'] },
      { resourceType: 'UserConfiguration', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      // Equipment management (admin full access)
      { resourceType: 'Device', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      // Numbing tasks and audit events
      { resourceType: 'Task', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'AuditEvent', interaction: ['read', 'vread', 'create', 'search'] },
    ],
  });

  globalLogger.info(`Created Project Admin AccessPolicy: ${policy.id}`);
  return policy;
}

async function createAssistantAccessPolicy(systemRepo: SystemRepository, project: Project): Promise<AccessPolicy> {
  const existing = await systemRepo.searchOne<AccessPolicy>({
    resourceType: 'AccessPolicy',
    filters: [{ code: 'name', operator: 'eq', value: 'MedSpa Assistant Policy' }],
  });

  if (existing) {
    return existing;
  }

  // Same permissions as Provider - can be customized later
  const policy = await systemRepo.createResource<AccessPolicy>({
    resourceType: 'AccessPolicy',
    meta: { project: project.id },
    name: 'MedSpa Assistant Policy',
    resource: [
      { resourceType: 'Patient', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Practitioner', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Practitioner', criteria: 'Practitioner?_id=%profile.id', interaction: ['update'] },
      { resourceType: 'Appointment', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Encounter', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Procedure', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Observation', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Media', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Binary', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'DocumentReference', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Questionnaire', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'QuestionnaireResponse', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'Consent', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Invoice', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Organization', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Bundle', interaction: ['read', 'create'] },
      { resourceType: 'Communication', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'RelatedPerson', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'CareTeam', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Coverage', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Account', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Subscription', interaction: ['read', 'create', 'delete'] },
      { resourceType: 'ServiceRequest', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'DiagnosticReport', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'MedicationRequest', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'AllergyIntolerance', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Condition', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Immunization', interaction: ['read', 'vread', 'search'] },
      // Service catalog (ActivityDefinitions) - needed for booking
      { resourceType: 'ActivityDefinition', interaction: ['read', 'vread', 'search'] },
      // Numbing tasks and audit events
      { resourceType: 'Task', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'AuditEvent', interaction: ['read', 'vread', 'create', 'search'] },
    ],
  });

  globalLogger.info(`Created Assistant AccessPolicy: ${policy.id}`);
  return policy;
}

async function createNurseMelPractitioner(
  systemRepo: SystemRepository,
  project: Project,
  accessPolicy: AccessPolicy
): Promise<Practitioner> {
  const existing = await systemRepo.searchOne<Practitioner>({
    resourceType: 'Practitioner',
    filters: [{ code: 'email', operator: 'eq', value: NURSE_MEL_DATA.email }],
  });

  if (existing) {
    globalLogger.info('Nurse Mel practitioner already exists');
    return existing;
  }

  // Create User with password
  const passwordHash = await bcryptHashPassword(NURSE_MEL_DATA.password);
  const user = await systemRepo.createResource<User>({
    resourceType: 'User',
    firstName: NURSE_MEL_DATA.firstName,
    lastName: NURSE_MEL_DATA.lastName,
    email: NURSE_MEL_DATA.email,
    passwordHash,
  });

  const profile = await createProfile(
    systemRepo,
    project,
    'Practitioner',
    NURSE_MEL_DATA.firstName,
    NURSE_MEL_DATA.lastName,
    NURSE_MEL_DATA.email
  );

  // Add qualification code for Provider and medspa-role extension
  const practitioner = await systemRepo.updateResource<Practitioner>({
    ...(profile as Practitioner),
    extension: [
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
        valueString: 'provider',
      },
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
        valueString: '#1a73e8', // Blue for Melissa
      },
    ],
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'http://hl7.org/fhir/v2/0360',
              code: 'RN',
              display: 'Registered Nurse',
            },
          ],
        },
      },
    ],
  });

  // Create UserConfiguration to set userType='provider' for frontend role detection
  const userConfiguration = await systemRepo.createResource<UserConfiguration>({
    resourceType: 'UserConfiguration',
    meta: { project: project.id },
    option: [
      {
        id: 'userType',
        valueString: 'provider',
      },
    ],
  });

  // Create project membership with access policy and userConfiguration
  const access: ProjectMembershipAccess[] | undefined = accessPolicy.id
    ? [{ policy: createReference(accessPolicy) }]
    : undefined;

  await createProjectMembership(systemRepo, user, project, practitioner, {
    admin: false,
    access,
    userConfiguration: createReference(userConfiguration),
  });

  globalLogger.info(`Created Nurse Mel practitioner: ${practitioner.id}`);
  globalLogger.info(`  Login: ${NURSE_MEL_DATA.email} / ${NURSE_MEL_DATA.password}`);
  return practitioner;
}

async function createCoordinator(
  systemRepo: SystemRepository,
  project: Project,
  accessPolicy: AccessPolicy
): Promise<void> {
  const existing = await systemRepo.searchOne<User>({
    resourceType: 'User',
    filters: [{ code: 'email', operator: 'eq', value: COORDINATOR_DATA.email }],
  });

  if (existing) {
    globalLogger.info('Coordinator user already exists');
    return;
  }

  // Create User with password
  const passwordHash = await bcryptHashPassword(COORDINATOR_DATA.password);
  const user = await systemRepo.createResource<User>({
    resourceType: 'User',
    firstName: COORDINATOR_DATA.firstName,
    lastName: COORDINATOR_DATA.lastName,
    email: COORDINATOR_DATA.email,
    passwordHash,
  });

  // Create a Practitioner profile for coordinator with coordinator role
  const coordinatorPractitioner = await systemRepo.createResource<Practitioner>({
    resourceType: 'Practitioner',
    meta: { project: project.id },
    name: [{ use: 'official', family: COORDINATOR_DATA.lastName, given: [COORDINATOR_DATA.firstName] }],
    telecom: [{ system: 'email', value: COORDINATOR_DATA.email, use: 'work' }],
    extension: [
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
        valueString: 'coordinator',
      },
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
        valueString: '#d9325', // Red for Coordinator
      },
    ],
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'http://melissaknudson.com/roles',
              code: 'coordinator',
              display: 'Patient Coordinator',
            },
          ],
        },
      },
    ],
  });

  // Create UserConfiguration to set userType='coordinator' for frontend role detection
  const userConfiguration = await systemRepo.createResource<UserConfiguration>({
    resourceType: 'UserConfiguration',
    meta: { project: project.id },
    option: [
      {
        id: 'userType',
        valueString: 'coordinator',
      },
    ],
  });

  // Create project membership with access policy and userConfiguration
  const access: ProjectMembershipAccess[] | undefined = accessPolicy.id
    ? [{ policy: createReference(accessPolicy) }]
    : undefined;

  await createProjectMembership(systemRepo, user, project, coordinatorPractitioner, {
    admin: false,
    access,
    userConfiguration: createReference(userConfiguration),
  });

  globalLogger.info(`Created Coordinator: ${user.id}`);
  globalLogger.info(` Login: ${COORDINATOR_DATA.email} / ${COORDINATOR_DATA.password}`);
}

async function createProjectAdmin(
  systemRepo: SystemRepository,
  project: Project,
  accessPolicy: AccessPolicy
): Promise<Practitioner> {
  const existing = await systemRepo.searchOne<User>({
    resourceType: 'User',
    filters: [{ code: 'email', operator: 'eq', value: PROJECT_ADMIN_DATA.email }],
  });

  if (existing) {
    globalLogger.info('Project Admin user already exists');
    const existingPractitioner = await systemRepo.searchOne<Practitioner>({
      resourceType: 'Practitioner',
      filters: [{ code: 'email', operator: 'eq', value: PROJECT_ADMIN_DATA.email }],
    });
    return existingPractitioner as Practitioner;
  }

  // Create User with password
  const passwordHash = await bcryptHashPassword(PROJECT_ADMIN_DATA.password);
  const user = await systemRepo.createResource<User>({
    resourceType: 'User',
    firstName: PROJECT_ADMIN_DATA.firstName,
    lastName: PROJECT_ADMIN_DATA.lastName,
    email: PROJECT_ADMIN_DATA.email,
    passwordHash,
  });

  // Create a Practitioner profile for project admin
  const adminPractitioner = await systemRepo.createResource<Practitioner>({
    resourceType: 'Practitioner',
    meta: { project: project.id },
    name: [{ use: 'official', family: PROJECT_ADMIN_DATA.lastName, given: [PROJECT_ADMIN_DATA.firstName] }],
    telecom: [{ system: 'email', value: PROJECT_ADMIN_DATA.email, use: 'work' }],
    extension: [
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
        valueString: 'project-admin',
      },
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
        valueString: '#188038', // Green for Admin
      },
    ],
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'http://melissaknudson.com/roles',
              code: 'admin',
              display: 'Project Administrator',
            },
          ],
        },
      },
    ],
  });

  // Create UserConfiguration to set userType='project-admin' for frontend role detection
  const userConfiguration = await systemRepo.createResource<UserConfiguration>({
    resourceType: 'UserConfiguration',
    meta: { project: project.id },
    option: [
      {
        id: 'userType',
        valueString: 'project-admin',
      },
    ],
  });

  // Create project membership with admin: true and access policy
  const access: ProjectMembershipAccess[] | undefined = accessPolicy.id
    ? [{ policy: createReference(accessPolicy) }]
    : undefined;

  await createProjectMembership(systemRepo, user, project, adminPractitioner, {
    admin: true,
    access,
    userConfiguration: createReference(userConfiguration),
  });

  globalLogger.info(`Created Project Admin: ${user.id}`);
  globalLogger.info(` Login: ${PROJECT_ADMIN_DATA.email} / ${PROJECT_ADMIN_DATA.password}`);

  return adminPractitioner;
}

async function createAssistant(
  systemRepo: SystemRepository,
  project: Project,
  accessPolicy: AccessPolicy
): Promise<Practitioner> {
  const existing = await systemRepo.searchOne<User>({
    resourceType: 'User',
    filters: [{ code: 'email', operator: 'eq', value: ASSISTANT_DATA.email }],
  });

  if (existing) {
    globalLogger.info('Assistant user already exists');
    const existingPractitioner = await systemRepo.searchOne<Practitioner>({
      resourceType: 'Practitioner',
      filters: [{ code: 'email', operator: 'eq', value: ASSISTANT_DATA.email }],
    });
    return existingPractitioner as Practitioner;
  }

  // Create User with password
  const passwordHash = await bcryptHashPassword(ASSISTANT_DATA.password);
  const user = await systemRepo.createResource<User>({
    resourceType: 'User',
    firstName: ASSISTANT_DATA.firstName,
    lastName: ASSISTANT_DATA.lastName,
    email: ASSISTANT_DATA.email,
    passwordHash,
  });

  // Create a Practitioner profile for assistant
  const assistantPractitioner = await systemRepo.createResource<Practitioner>({
    resourceType: 'Practitioner',
    meta: { project: project.id },
    name: [{ use: 'official', family: ASSISTANT_DATA.lastName, given: [ASSISTANT_DATA.firstName] }],
    telecom: [{ system: 'email', value: ASSISTANT_DATA.email, use: 'work' }],
    extension: [
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
        valueString: 'assistant',
      },
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
        valueString: '#a142f4', // Purple for Assistant
      },
    ],
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'http://melissaknudson.com/roles',
              code: 'assistant',
              display: 'Clinical Assistant',
            },
          ],
        },
      },
    ],
  });

  // Create UserConfiguration to set userType='assistant' for frontend role detection
  const userConfiguration = await systemRepo.createResource<UserConfiguration>({
    resourceType: 'UserConfiguration',
    meta: { project: project.id },
    option: [
      {
        id: 'userType',
        valueString: 'assistant',
      },
    ],
  });

  // Create project membership with access policy and userConfiguration
  const access: ProjectMembershipAccess[] | undefined = accessPolicy.id
    ? [{ policy: createReference(accessPolicy) }]
    : undefined;

  await createProjectMembership(systemRepo, user, project, assistantPractitioner, {
    admin: false,
    access,
    userConfiguration: createReference(userConfiguration),
  });

  globalLogger.info(`Created Assistant: ${user.id}`);
  globalLogger.info(` Login: ${ASSISTANT_DATA.email} / ${ASSISTANT_DATA.password}`);

  return assistantPractitioner;
}

async function createPatient(
  systemRepo: SystemRepository,
  project: Project,
  data: (typeof PATIENTS)[0],
  index: number,
  organization: Organization
): Promise<Patient> {
  const existing = await systemRepo.searchOne<Patient>({
    resourceType: 'Patient',
    filters: [{ code: 'email', operator: 'eq', value: data.email }],
  });

  if (existing) {
    globalLogger.info(`Patient ${data.firstName} ${data.lastName} already exists`);
    return existing;
  }

  const patient = await systemRepo.createResource<Patient>({
    resourceType: 'Patient',
    meta: { project: project.id },
    identifier: [
      {
        system: 'http://melissaknudson.com/patient-id',
        value: `NM${String(index + 1).padStart(3, '0')}`,
      },
    ],
    name: [{ use: 'official', family: data.lastName, given: [data.firstName] }],
    telecom: [
      { system: 'email', value: data.email, use: 'home' },
      { system: 'phone', value: data.phone, use: 'mobile' },
    ],
    gender: data.gender,
    birthDate: data.birthDate,
    address: [{ use: 'home', ...data.address, country: 'US' }],
    managingOrganization: organization.id ? createReference(organization) : undefined,
  });

  globalLogger.info(`Created patient: ${data.firstName} ${data.lastName} (${patient.id})`);
  return patient;
}

async function createBotoxQuestionnaire(systemRepo: SystemRepository, project: Project): Promise<Questionnaire> {
  const existing = await systemRepo.searchOne<Questionnaire>({
    resourceType: 'Questionnaire',
    filters: [{ code: 'name', operator: 'eq', value: 'Aesthetic Treatment Intake - Botox' }],
  });

  if (existing) {
    globalLogger.info('Botox intake questionnaire already exists');
    return existing;
  }

  const questionnaire = await systemRepo.createResource<Questionnaire>({
    resourceType: 'Questionnaire',
    meta: { project: project.id },
    name: 'Aesthetic Treatment Intake - Botox',
    title: 'Botox Treatment Intake Form',
    status: 'active',
    description: 'Intake questionnaire for Botox cosmetic treatments',
    item: [
      {
        linkId: 'previous-treatment',
        text: 'Have you received Botox or other neuromodulator treatments before?',
        type: 'boolean',
        required: true,
      },
      {
        linkId: 'previous-details',
        text: 'If yes, please describe (when, where, results):',
        type: 'text',
        enableWhen: [{ question: 'previous-treatment', operator: '=', answerBoolean: true }],
      },
      {
        linkId: 'concerns',
        text: 'What areas are you concerned about?',
        type: 'choice',
        required: true,
        repeats: true,
        answerOption: [
          { valueCoding: { code: 'forehead', display: 'Forehead lines' } },
          { valueCoding: { code: 'elevens', display: "'11' lines between brows" } },
          { valueCoding: { code: 'crows_feet', display: "Crow's feet" } },
        ],
      },
      {
        linkId: 'goals',
        text: 'Tell us about your aesthetic goals:',
        type: 'text',
        required: true,
      },
    ],
  });

  globalLogger.info(`Created Botox intake questionnaire: ${questionnaire.id}`);
  return questionnaire;
}

async function createSampleAppointments(
  systemRepo: SystemRepository,
  project: Project,
  practitioners: Practitioner[],
  patients: { id: string; data: (typeof PATIENTS)[0] }[]
): Promise<void> {
  // Get tomorrow's date in NYC timezone
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  // Define appointments with proper ISO dates
  const appointments = [
    {
      patientIdx: 0,
      practitionerIdx: 0,
      date: '2025-03-15',
      time: '14:00',
      status: 'fulfilled',
      service: 'Botox - Forehead & Crows Feet',
    },
    { patientIdx: 0, practitionerIdx: 1, date: dateStr, time: '10:00', status: 'booked', service: 'Botox Touch-up' },
    {
      patientIdx: 1,
      practitionerIdx: 0,
      date: dateStr,
      time: '15:30',
      status: 'booked',
      service: 'Botox Consultation',
    },
    {
      patientIdx: 2,
      practitionerIdx: 1,
      date: '2025-04-25',
      time: '11:00',
      status: 'booked',
      service: 'Botox - Crows Feet & Brow Lift',
    },
  ];

  for (const appt of appointments) {
    const p = patients[appt.patientIdx];
    const practitioner = practitioners[appt.practitionerIdx];
    if (!p || !practitioner) {
      continue;
    }

    // Create proper ISO 8601 dates with timezone
    const startDate = new Date(`${appt.date}T${appt.time}:00-04:00`);
    const endDate = new Date(startDate.getTime() + 30 * 60000);
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    await systemRepo.createResource<Appointment>({
      resourceType: 'Appointment',
      meta: { project: project.id },
      status: appt.status as 'fulfilled' | 'booked',
      serviceType: [{ text: appt.service }],
      start,
      end,
      participant: [
        { actor: createReference({ resourceType: 'Patient', id: p.id } as Patient), status: 'accepted' },
        { actor: createReference(practitioner), status: 'accepted' },
      ],
    });

    globalLogger.info(
      `Created appointment: ${appt.service} for ${p.data.firstName} ${p.data.lastName} with ${practitioner.name?.[0]?.given?.[0] || 'provider'}`
    );
  }
}

async function createQuestionnaireResponses(
  systemRepo: SystemRepository,
  project: Project,
  questionnaire: Questionnaire,
  patients: { id: string; data: (typeof PATIENTS)[0] }[]
): Promise<void> {
  for (const p of patients) {
    await systemRepo.createResource<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      meta: { project: project.id },
      questionnaire: `Questionnaire/${questionnaire.id}`,
      status: 'completed',
      subject: createReference({ resourceType: 'Patient', id: p.id } as Patient),
      item: [
        { linkId: 'previous-treatment', answer: [{ valueBoolean: p.data.hasPreviousBotox }] },
        {
          linkId: 'concerns',
          answer: p.data.concerns.map((c) => ({ valueCoding: { code: c, display: c } })),
        },
        { linkId: 'goals', answer: [{ valueString: 'Natural look' }] },
      ],
    });
  }
}

// Push Notification Bot - Sends browser push notifications to staff
// Using CommonJS syntax for vmcontext runtime compatibility
// No require() needed - medplum client and event are passed as parameters
const PUSH_NOTIFICATION_BOT_CODE = `
exports.handler = async function(medplum, event) {
  console.log('[Push Bot] ===== BOT EXECUTING =====');
  console.log('[Push Bot] Event type:', event.type);
  console.log('[Push Bot] Event resourceType:', event.resourceType);

  const communication = event.input;

  if (!communication || communication.resourceType !== 'Communication') {
    console.log('[Push Bot] Not a Communication resource, skipping');
    return;
  }

  console.log('[Push Bot] Processing Communication:', communication.id);
  console.log('[Push Bot] Communication status:', communication.status);
  console.log('[Push Bot] Communication recipient:', JSON.stringify(communication.recipient));

  // Only process notification-type Communications
  const isNotification = communication.category?.some(
    (cat) => cat.coding?.some(
      (coding) => coding.system === 'http://melissaknudson.com/notification-type'
    )
  );

  if (!isNotification) {
    console.log('[Push Bot] Not a notification-type Communication, skipping');
    return;
  }

  console.log('[Push Bot] Valid notification Communication found');

  // Check if this is a broadcast notification
  const isBroadcast = communication.category?.some(
    (cat) => cat.coding?.some(
      (coding) => coding.code === 'broadcast'
    )
  );

  if (isBroadcast) {
    console.log('[Push Bot] BROADCAST MODE - Will send to all active push subscriptions');
  }

  const title = communication.category?.[0]?.coding?.[0]?.display || 'Nurse Mel';
  const body = communication.payload?.[0]?.contentString || 'New notification';
  const url = getNotificationUrl(communication);
  const notificationId = communication.id || '';

  console.log('[Push Bot] Notification details:');
  console.log(' - Title:', title);
  console.log(' - Body:', body);
  console.log(' - URL:', url);
  console.log(' - NotificationId:', notificationId);
  console.log(' - Is Broadcast:', isBroadcast);

  // Check VAPID configuration (vmcontext sandbox may not have process.env, skip check)
  // VAPID keys should be configured on the server for web-push to work
  console.log('[Push Bot] Starting push notification processing');

  // Send to each recipient
  let recipientCount = 0;
  let subscriptionCount = 0;
  let sentCount = 0;

  // Query ALL push subscriptions from FHIR (for both broadcast and targeted)
  // This allows us to find subscriptions for any practitioner, not just the creator
  console.log('[Push Bot] Querying all push subscriptions from FHIR...');
  const allPushSubscriptions = await getAllPushSubscriptions(medplum);
  console.log('[Push Bot] Found', Object.keys(allPushSubscriptions).length, 'practitioners with push subscriptions');

  // Determine which practitioners to notify
  let targetPractitionerIds = [];
  if (isBroadcast) {
    // For broadcasts, send to ALL practitioners who have push subscriptions
    targetPractitionerIds = Object.keys(allPushSubscriptions);
    console.log('[Push Bot] BROADCAST MODE - Sending to all', targetPractitionerIds.length, 'practitioners with subscriptions');
  } else {
    // For targeted notifications, send only to Communication recipients who have subscriptions
    for (const recipient of communication.recipient || []) {
      if (recipient.reference?.startsWith('Practitioner/')) {
        const practitionerId = recipient.reference.split('/')[1];
        targetPractitionerIds.push(practitionerId);
      }
    }
    console.log('[Push Bot] TARGETED MODE - Sending to', targetPractitionerIds.length, 'recipients');
  }

  // Send to each target practitioner
  for (const practitionerId of targetPractitionerIds) {
    recipientCount++;
    console.log('[Push Bot] Processing recipient:', recipientCount, '- Practitioner/' + practitionerId);

    try {
      const subscriptions = allPushSubscriptions[practitionerId] || [];
      console.log('[Push Bot] Found', subscriptions.length, 'subscription(s) for this practitioner');

      if (subscriptions.length === 0) {
        console.log('[Push Bot] No push subscriptions found for this practitioner');
        continue;
      }

      for (let i = 0; i < subscriptions.length; i++) {
        const subscription = subscriptions[i];
        subscriptionCount++;
        console.log('[Push Bot] Sending to subscription', i + 1, 'of', subscriptions.length);
        console.log('[Push Bot] Endpoint:', subscription.endpoint?.substring(0, 50) + '...');

        try {
          await sendPushNotification(subscription, {
            title,
            body,
            url,
            notificationId,
          });
          sentCount++;
          console.log('[Push Bot] ✓ Sent successfully');
        } catch (sendErr) {
          console.log('[Push Bot] ✗ Failed to send:', sendErr.message);
          if (sendErr.statusCode === 404 || sendErr.statusCode === 410) {
            console.log('[Push Bot] Subscription expired/invalid (', sendErr.statusCode, ')');
          }
        }
      }
    } catch (err) {
      console.log('[Push Bot] Error processing recipient:', err);
    }
  }

  console.log('[Push Bot] ===== SUMMARY =====');
  console.log('[Push Bot] Recipients processed:', recipientCount);
  console.log('[Push Bot] Subscriptions found:', subscriptionCount);
  console.log('[Push Bot] Notifications sent:', sentCount);
  console.log('[Push Bot] ===================');
};

// Cache for push subscriptions to avoid querying on every notification
let pushSubscriptionsCache = null;
let pushSubscriptionsCacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

async function getAllPushSubscriptions(medplum) {
  console.log('[Push Bot] Querying all push registrations from FHIR...');

  // Check cache
  const now = Date.now();
  if (pushSubscriptionsCache && (now - pushSubscriptionsCacheTime) < CACHE_TTL_MS) {
    console.log('[Push Bot] Using cached push subscriptions');
    return pushSubscriptionsCache;
  }

  const subscriptionsByPractitioner = {};

  try {
    // Query for Communication resources with push-registration category
    // These are "push registration" records created when users enable push notifications
    const bundle = await medplum.search('Communication', {
      category: 'push-registration',
      status: 'completed',
      _count: '100',
    });

    console.log('[Push Bot] Found', bundle.entry?.length || 0, 'total push registration Communications');

    for (const entry of bundle.entry || []) {
      const comm = entry.resource;
      if (!comm) continue;

      console.log('[Push Bot] Checking push registration:', comm.id);
      console.log('[Push Bot] Sender:', comm.sender?.reference);

      // Get the practitioner ID from the Communication sender
      const senderRef = comm.sender?.reference || '';
      console.log('[Push Bot] Sender reference:', senderRef);

      // Extract practitioner ID using string operations (vmcontext-safe)
      let practitionerId = null;
      if (senderRef.startsWith('Practitioner/')) {
        practitionerId = senderRef.substring('Practitioner/'.length);
      }
      if (!practitionerId) {
        console.log('[Push Bot] Skipping - sender is not a Practitioner');
        continue;
      }

      console.log('[Push Bot] Found practitioner ID:', practitionerId);

      // Parse the push subscription data from the payload
      const payload = comm.payload?.[0]?.contentString;
      if (payload) {
        console.log('[Push Bot] Payload present, parsing...');
        try {
          const pushData = JSON.parse(payload);
          console.log('[Push Bot] Parsed push data for practitioner', practitionerId);
          if (pushData.endpoint && pushData.keys) {
            if (!subscriptionsByPractitioner[practitionerId]) {
              subscriptionsByPractitioner[practitionerId] = [];
            }
            subscriptionsByPractitioner[practitionerId].push(pushData);
            console.log('[Push Bot] Found push subscription for practitioner:', practitionerId);
          } else {
            console.log('[Push Bot] Push data missing endpoint or keys');
          }
        } catch (parseErr) {
          console.log('[Push Bot] Failed to parse push data for:', comm.id, parseErr.message);
        }
      } else {
        console.log('[Push Bot] No payload found for registration:', comm.id);
      }
    }

    // Update cache
    pushSubscriptionsCache = subscriptionsByPractitioner;
    pushSubscriptionsCacheTime = now;

    console.log('[Push Bot] Total practitioners with push subscriptions:', Object.keys(subscriptionsByPractitioner).length);
    return subscriptionsByPractitioner;

  } catch (err) {
    console.log('[Push Bot] Error querying push registrations:', err.message);
    return {};
  }
}

async function sendPushNotification(subscription, payload) {
  console.log('[Push Bot] sendPushNotification called');

  const webpush = require('web-push');
  console.log('[Push Bot] web-push library loaded');

  // VAPID keys from server environment - passed via medplum bot execution context
  // These should be configured in the server environment
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

  console.log('[Push Bot] VAPID public key present:', !!vapidPublicKey);
  console.log('[Push Bot] VAPID private key present:', !!vapidPrivateKey);

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.log('[Push Bot] VAPID keys not configured - skipping push notification');
    return;
  }

  console.log('[Push Bot] Sending push notification...');
  console.log('[Push Bot] Payload:', JSON.stringify(payload));

  try {
    const result = await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: 'mailto:support@melissaknudson.com',
          publicKey: vapidPublicKey,
          privateKey: vapidPrivateKey,
        },
        TTL: 60,
      }
    );
    console.log('[Push Bot] Push sent successfully, status:', result.statusCode);
  } catch (err) {
    console.log('[Push Bot] Push send failed:', err.message);
    console.log('[Push Bot] Error status code:', err.statusCode);
    console.log('[Push Bot] Error body:', err.body);
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.log('[Push Bot] Subscription expired/invalid, should remove:', subscription.endpoint.substring(0, 50) + '...');
    } else {
      throw err;
    }
  }
}

function getNotificationUrl(communication) {
  const apptRef = communication.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-appointment'
  )?.valueReference?.reference;

  if (apptRef) return '/calendar';

  const procRef = communication.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure'
  )?.valueReference?.reference;

  if (procRef && communication.subject?.reference) {
    const patientId = communication.subject.reference.split('/')[1];
    const procedureId = procRef.split('/')[1];
    return '/Patient/' + patientId + '/botox-treatment?procedureId=' + procedureId;
  }

  return '/notifications';
}
`;

async function createPushBotAccessPolicy(systemRepo: SystemRepository, project: Project): Promise<AccessPolicy> {
  const existing = await systemRepo.searchOne<AccessPolicy>({
    resourceType: 'AccessPolicy',
    filters: [{ code: 'name', operator: 'eq', value: 'Push Notification Bot Policy' }],
  });

  if (existing) {
    return existing;
  }

  const policy = await systemRepo.createResource<AccessPolicy>({
    resourceType: 'AccessPolicy',
    meta: { project: project.id },
    name: 'Push Notification Bot Policy',
    resource: [
      // Read Subscriptions to find user push subscriptions
      { resourceType: 'Subscription', interaction: ['read', 'search'] },
      // Read Communications to get notification details
      { resourceType: 'Communication', interaction: ['read', 'search'] },
      // Read Practitioners to identify recipients
      { resourceType: 'Practitioner', interaction: ['read', 'search'] },
    ],
  });

  globalLogger.info(`Created Push Notification Bot AccessPolicy: ${policy.id}`);
  return policy;
}

async function createPushNotificationBot(systemRepo: SystemRepository, project: Project): Promise<Bot> {
  // Create AccessPolicy for the Bot first
  const accessPolicy = await createPushBotAccessPolicy(systemRepo, project);

  // Search for existing bot by looking at all Bots (name is not a searchable field)
  const existingBots = await systemRepo.search<Bot>({
    resourceType: 'Bot',
    count: 100,
  });

  const existing = existingBots.entry?.find((entry) => entry.resource?.name === 'Push Notification Sender')?.resource;

  if (existing) {
    // Check if the existing bot has executable code
    if (existing.executableCode?.url) {
      globalLogger.info('Push notification bot already exists with executable code');
      return existing;
    }
    // Bot exists but doesn't have executable code - we need to update it
    globalLogger.info('Push notification bot exists but missing executable code, updating...');

    // Create Binary with the code
    const binary = await systemRepo.createResource<Binary>({
      resourceType: 'Binary',
      meta: { project: project.id },
      contentType: 'text/typescript',
    });

    // Write the code to binary storage
    await getBinaryStorage().writeBinary(
      binary,
      'push-notification-sender.ts',
      'text/typescript',
      Readable.from(PUSH_NOTIFICATION_BOT_CODE)
    );

    // Update bot with executable code reference
    const updatedBot = await systemRepo.updateResource<Bot>({
      ...existing,
      runtimeVersion: 'vmcontext',
      executableCode: {
        contentType: 'text/typescript',
        title: 'push-notification-sender.ts',
        url: getReferenceString(binary),
      },
    });

    globalLogger.info(`Updated push notification bot with executable code: ${updatedBot.id}`);
    return updatedBot;
  }

  // Create Binary with the code
  const binary = await systemRepo.createResource<Binary>({
    resourceType: 'Binary',
    meta: { project: project.id },
    contentType: 'text/typescript',
  });

  // Write the code to binary storage
  await getBinaryStorage().writeBinary(
    binary,
    'push-notification-sender.ts',
    'text/typescript',
    Readable.from(PUSH_NOTIFICATION_BOT_CODE)
  );

  // Create Bot with executable code reference
  const bot = await systemRepo.createResource<Bot>({
    resourceType: 'Bot',
    meta: { project: project.id },
    name: 'Push Notification Sender',
    description: 'Sends browser push notifications to staff when notifications are created',
    runtimeVersion: 'vmcontext',
    executableCode: {
      contentType: 'text/typescript',
      title: 'push-notification-sender.ts',
      url: getReferenceString(binary),
    },
  });

  globalLogger.info(`Created push notification bot: ${bot.id}`);

  // Create ProjectMembership for the Bot so it can be executed
  // Assign the AccessPolicy and set admin: true to allow reading all resources
  await systemRepo.createResource<ProjectMembership>({
    resourceType: 'ProjectMembership',
    meta: { project: project.id },
    project: createReference(project),
    user: createReference(bot),
    profile: createReference(bot),
    admin: true, // Allows Bot to read all resources including user-created Subscriptions
    access: [{ policy: createReference(accessPolicy) }],
  });

  globalLogger.info(`Created project membership for push notification bot`);

  return bot;
}

async function createPushNotificationSubscription(
  systemRepo: SystemRepository,
  project: Project,
  bot: Bot
): Promise<Subscription> {
  // Search for existing subscription by looking at all Subscriptions (reason is not a searchable field)
  const existingSubs = await systemRepo.search<Subscription>({
    resourceType: 'Subscription',
    count: 100,
  });

  const existing = existingSubs.entry?.find(
    (entry) =>
      entry.resource?.reason === 'Trigger push notifications' &&
      entry.resource?.criteria === 'Communication?status=completed'
  )?.resource;

  if (existing) {
    globalLogger.info('Push notification subscription already exists');
    return existing;
  }

  const subscription = await systemRepo.createResource<Subscription>({
    resourceType: 'Subscription',
    meta: { project: project.id, author: createReference(bot) },
    status: 'active',
    reason: 'Trigger push notifications',
    criteria: 'Communication?status=completed',
    channel: {
      type: 'rest-hook',
      endpoint: `Bot/${bot.id}/$execute`,
      payload: 'application/fhir+json',
    },
  });

  globalLogger.info(`Created push notification subscription: ${subscription.id}`);
  return subscription;
}

// ============================================================================
// PHASE 2: Service Catalog and Room Management
// ============================================================================

/**
 * Create a treatment room location
 * @param systemRepo - The system repository
 * @param project - The project
 * @param id - Room ID
 * @param name - Room name
 * @returns The created Location
 */
async function createTreatmentRoom(
  systemRepo: SystemRepository,
  project: Project,
  id: string,
  name: string
): Promise<Location> {
  const existing = await systemRepo.searchOne<Location>({
    resourceType: 'Location',
    filters: [
      { code: '_id', operator: 'eq', value: id },
      { code: '_project', operator: 'eq', value: project.id as string },
    ],
  });

  if (existing) {
    globalLogger.info(`Location ${name} already exists: ${existing.id}`);
    return existing;
  }

  return systemRepo.createResource<Location>({
    resourceType: 'Location',
    id,
    meta: { project: project.id },
    status: 'active',
    name,
    mode: 'instance',
    type: [
      {
        coding: [
          {
            system: 'http://melissaknudson.com/location-type',
            code: 'treatment-room',
            display: 'Treatment Room',
          },
        ],
      },
    ],
    physicalType: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/location-physical-type', code: 'ro', display: 'Room' }],
    },
    extension: [
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/has-laser',
        valueBoolean: id === 'room-1', // Room 1 has laser, Room 2 doesn't
      },
    ],
  });
}

/**
 * Create service catalog with ActivityDefinitions
 * @param systemRepo - The system repository
 * @param project - The project
 */
async function createServiceCatalog(systemRepo: SystemRepository, project: Project): Promise<void> {
  // Service definition with new equipment and cost tracking fields
  const services: {
    id: string;
    name: string;
    duration: number;
    // numbingTime removed - handled via recommended accompanying services
    defaultRoom: string;
    minPrice: number;
    maxPrice: number;
    pricePerUnit: boolean;
    unitType: string;
    gfeCategory: string;
    requiresConsult: boolean;
    icon: string;
    color: string;
    category: string;
    // New fields for equipment and cost tracking
    // Note: required/movable are intrinsic equipment properties, not service-level
    equipmentRequirements: { equipmentType: string; equipmentReference?: string; equipmentName?: string }[];
    recommendedAccompanyingServices: {
      serviceCode: string;
      timing: 'before' | 'after' | 'concurrent';
      offsetMinutes: number;
    }[];
    internalCost: { productCost: number; notes?: string };
    // Provider requirements - NEW
    mainProviderRequired: boolean;
    assistantRequired: boolean;
    // Consent - NEW
    consentRequired: boolean;
  }[] = [
    {
      id: 'topical-numbing',
      name: 'Topical Numbing',
      duration: 15,
      defaultRoom: 'room-2', // Numbing room
      minPrice: 0, // Free to patient
      maxPrice: 0,
      pricePerUnit: false,
      unitType: 'session',
      gfeCategory: '',
      requiresConsult: false,
      icon: 'cream',
      color: 'gray',
      category: 'prep',
      equipmentRequirements: [],
      recommendedAccompanyingServices: [],
      internalCost: { productCost: 15, notes: 'Numbing cream supplies' },
      mainProviderRequired: false, // Optional - can be done by assistant
      assistantRequired: true, // Requires assistant (can be done by provider too)
      consentRequired: false, // Prep service doesn't need patient consent
    },
    {
      id: 'botox-cosmetic',
      name: 'Botox Cosmetic',
      duration: 30,
      defaultRoom: 'room-1',
      minPrice: 300,
      maxPrice: 800,
      pricePerUnit: true,
      unitType: 'unit',
      gfeCategory: 'botox',
      requiresConsult: false,
      icon: 'syringe',
      color: 'blue',
      category: 'injection',
      equipmentRequirements: [],
      recommendedAccompanyingServices: [{ serviceCode: 'topical-numbing', timing: 'before', offsetMinutes: 0 }],
      internalCost: { productCost: 120, notes: 'Botox product cost per average treatment' },
      mainProviderRequired: true, // Must have a provider
      assistantRequired: false, // Optional assistant
      consentRequired: true, // Injection requires consent
    },
    {
      id: 'filler',
      name: 'Dermal Filler',
      duration: 45,
      defaultRoom: 'room-1',
      minPrice: 600,
      maxPrice: 1200,
      pricePerUnit: false,
      unitType: 'syringe',
      gfeCategory: 'filler',
      requiresConsult: false,
      icon: 'syringe',
      color: 'violet',
      category: 'injection',
      equipmentRequirements: [],
      recommendedAccompanyingServices: [{ serviceCode: 'topical-numbing', timing: 'before', offsetMinutes: -30 }],
      internalCost: { productCost: 300, notes: 'Filler product per syringe' },
      mainProviderRequired: true,
      assistantRequired: false,
      consentRequired: true, // Injection requires consent
    },
    {
      id: 'laser',
      name: 'Laser Treatment',
      duration: 60, // 15 min numbing + 45 min treatment
      defaultRoom: 'room-2',
      minPrice: 250,
      maxPrice: 500,
      pricePerUnit: false,
      unitType: 'area',
      gfeCategory: 'laser',
      requiresConsult: false,
      consentRequired: true, // Laser requires consent
      icon: 'clipboard',
      color: 'green',
      category: 'consult',
      equipmentRequirements: [],
      recommendedAccompanyingServices: [],
      internalCost: { productCost: 0, notes: 'No consumables' },
      mainProviderRequired: true,
      assistantRequired: false,
    },
  ];

  for (const svc of services) {
    const existing = await systemRepo.searchOne<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      filters: [
        { code: '_id', operator: 'eq', value: svc.id },
        { code: '_project', operator: 'eq', value: project.id as string },
      ],
    });

    if (existing) {
      globalLogger.info(`ActivityDefinition ${svc.name} already exists: ${existing.id}`);
      continue;
    }

    // Create service config as single JSON string to avoid FHIR extension validation errors
    const serviceConfig = {
      defaultRoom: svc.defaultRoom,
      roomMovable: true,
      minPrice: svc.minPrice,
      maxPrice: svc.maxPrice,
      pricePerUnit: svc.pricePerUnit,
      unitType: svc.unitType,
      requiresConsult: svc.requiresConsult,
      icon: svc.icon || '',
      color: svc.color,
      category: svc.category,
      gfeCategory: svc.gfeCategory || '',
      equipmentRequirements: svc.equipmentRequirements || [],
      recommendedAccompanyingServices: svc.recommendedAccompanyingServices || [],
      internalCost: svc.internalCost || { productCost: 0, costPerUnit: false },
      followUpSchedule: [],
      providerRates: [],
      // Consent configuration
      consentRequired: svc.consentRequired ?? true, // Default to true for safety
      // Provider requirements - NEW
      mainProviderRequired: svc.mainProviderRequired ?? true,
      assistantRequired: svc.assistantRequired ?? false,
    };

    await systemRepo.createResource<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      id: svc.id,
      meta: { project: project.id },
      status: 'active',
      name: svc.id,
      title: svc.name,
      kind: 'ServiceRequest',
      code: {
        coding: [
          {
            system: 'http://melissaknudson.com/services',
            code: svc.id,
            display: svc.name,
          },
        ],
        text: svc.name,
      },
      timingDuration: {
        value: svc.duration,
        unit: 'min',
      },
      extension: [
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/service-config',
          valueString: JSON.stringify(serviceConfig),
        },
      ],
    });

    globalLogger.info(`Created ActivityDefinition: ${svc.name}`);
  }
}

async function createEquipment(
  systemRepo: SystemRepository,
  project: Project,
  type: string,
  name: string,
  serialNumber: string,
  assignedRoomId?: string
): Promise<Device> {
  const existing = await systemRepo.searchOne<Device>({
    resourceType: 'Device',
    filters: [{ code: 'name', operator: 'eq', value: name }],
  });

  if (existing) {
    globalLogger.info(`Equipment ${name} already exists: ${existing.id}`);
    return existing;
  }

  const equipmentTypes = [
    { code: 'laser-hair-removal', label: 'Laser Hair Removal Device' },
    { code: 'botox-station', label: 'Botox Supply Station' },
    { code: 'filler-cart', label: 'Dermal Filler Cart' },
    { code: 'photo-setup', label: 'Photography Setup' },
    { code: 'numbing-station', label: 'Numbing Cream Station' },
    { code: 'emergency-kit', label: 'Emergency Response Kit' },
  ] as const;

  const findCode = (type: string): string =>
    equipmentTypes.find((t) => t.label.toLowerCase().includes(type.toLowerCase()) || t.code === type)?.code || 'other';

  const code = findCode(type);
  const uniqueCode = `${code}-${Math.floor(Math.random() * 1000)}`;

  // Create Device with proper FHIR structure
  const device: Device = {
    resourceType: 'Device',
    meta: { project: project.id },
    status: 'active',
    deviceName: [
      {
        name,
        // type must be valid FHIR DeviceNameType
        type: 'user-friendly-name' as const,
      },
    ],
    identifier: [
      { system: 'http://melissaknudson.com/equipment-code', value: uniqueCode },
      { system: 'http://melissaknudson.com/serial-number', value: serialNumber },
    ],
  };

  if (assignedRoomId) {
    device.location = { reference: `Location/${assignedRoomId}` };
  }

  return systemRepo.createResource<Device>(device);
}

async function seedEquipment(
  systemRepo: SystemRepository,
  project: Project,
  room1: Location,
  room2: Location
): Promise<void> {
  // Seed equipment items
  await createEquipment(systemRepo, project, 'laser-hair-removal', 'Cynosure Elite+ Laser', 'SN-2024-001', room1.id);
  await createEquipment(systemRepo, project, 'laser-hair-removal', 'Lumenis Lightsheer', 'SN-2024-002', room2.id);
  await createEquipment(systemRepo, project, 'botox-station', 'Botox Supply Station #1', 'N/A'); // Floating
  await createEquipment(systemRepo, project, 'filler-cart', 'Dermal Filler Cart Primary', 'N/A', room1.id);
  await createEquipment(systemRepo, project, 'photo-setup', 'Photography Setup Kit', 'N/A'); // Floating
  await createEquipment(systemRepo, project, 'numbing-station', 'Numbing Cream Station', 'N/A', room2.id);
  await createEquipment(systemRepo, project, 'emergency-kit', 'Emergency Response Kit', 'N/A'); // Floating

  globalLogger.info('Equipment seeding completed for practice');
}

// Call seedEquipment in the main seeding flow (within seedNurseMelData)
// This is added after the rooms are created
