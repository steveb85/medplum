// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { createReference } from '@medplum/core';
import type {
  AccessPolicy,
  Appointment,
  Organization,
  Patient,
  Practitioner,
  Project,
  ProjectMembershipAccess,
  Questionnaire,
  QuestionnaireResponse,
  User,
} from '@medplum/fhirtypes';
import { bcryptHashPassword, createProfile, createProjectMembership } from '../auth/utils';
import type { SystemRepository } from '../fhir/repo';
import { globalLogger } from '../logger';

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

  // Create AccessPolicies
  const providerPolicy = await createProviderAccessPolicy(systemRepo, project);
  const coordinatorPolicy = await createCoordinatorAccessPolicy(systemRepo, project);

  // Create Nurse Mel with login credentials
  const nurseMel = await createNurseMelPractitioner(systemRepo, project, providerPolicy);

  // Create Coordinator with login credentials
  await createCoordinator(systemRepo, project, coordinatorPolicy);

  // Create test patients
  const createdPatients: { id: string; data: (typeof PATIENTS)[0] }[] = [];
  for (let i = 0; i < PATIENTS.length; i++) {
    const patient = await createPatient(systemRepo, project, PATIENTS[i], i, organization);
    createdPatients.push({ id: patient.id as string, data: PATIENTS[i] });
  }

  // Create Botox intake questionnaire
  const questionnaire = await createBotoxQuestionnaire(systemRepo, project);

  // Create appointments
  await createSampleAppointments(systemRepo, project, nurseMel, createdPatients);

  // Create questionnaire responses
  if (questionnaire.id) {
    await createQuestionnaireResponses(systemRepo, project, questionnaire, createdPatients);
  }

  globalLogger.info('Nurse Mel test data seeding complete');
  globalLogger.info('');
  globalLogger.info('==============================================================');
  globalLogger.info('SEEDED LOGIN CREDENTIALS:');
  globalLogger.info('  Super Admin: admin@example.com / medplum_admin');
  globalLogger.info(`  Provider: ${NURSE_MEL_DATA.email} / ${NURSE_MEL_DATA.password}`);
  globalLogger.info(`  Coordinator: ${COORDINATOR_DATA.email} / ${COORDINATOR_DATA.password}`);
  globalLogger.info('==============================================================');
}

async function createOrganization(
  systemRepo: SystemRepository,
  project: Project
): Promise<Organization> {
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

async function createProviderAccessPolicy(
  systemRepo: SystemRepository,
  project: Project
): Promise<AccessPolicy> {
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
      { resourceType: 'Practitioner', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Appointment', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Encounter', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Procedure', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Observation', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Media', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'DocumentReference', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Questionnaire', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'QuestionnaireResponse', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'Consent', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Invoice', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Organization', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Bundle', interaction: ['read', 'create'] },
    ],
  });

  globalLogger.info(`Created Provider AccessPolicy: ${policy.id}`);
  return policy;
}

async function createCoordinatorAccessPolicy(
  systemRepo: SystemRepository,
  project: Project
): Promise<AccessPolicy> {
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
      { resourceType: 'Patient', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Practitioner', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Appointment', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Encounter', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Procedure', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Observation', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Media', interaction: ['read', 'vread', 'create', 'search'] },
      { resourceType: 'DocumentReference', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Questionnaire', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'QuestionnaireResponse', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Consent', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Invoice', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'PaymentReconciliation', interaction: ['read', 'vread', 'create', 'update', 'search'] },
      { resourceType: 'Organization', interaction: ['read', 'vread', 'search'] },
      { resourceType: 'Bundle', interaction: ['read', 'create'] },
    ],
  });

  globalLogger.info(`Created Coordinator AccessPolicy: ${policy.id}`);
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

  // Add qualification code for Provider
  const practitioner = await systemRepo.updateResource<Practitioner>({
    ...(profile as Practitioner),
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

  // Create project membership with access policy
  const access: ProjectMembershipAccess[] | undefined = accessPolicy.id
    ? [{ policy: createReference(accessPolicy) }]
    : undefined;

  await createProjectMembership(systemRepo, user, project, practitioner, {
    admin: false,
    access,
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
    telecom: [
      { system: 'email', value: COORDINATOR_DATA.email, use: 'work' },
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

  // Create project membership with access policy
  const access: ProjectMembershipAccess[] | undefined = accessPolicy.id
    ? [{ policy: createReference(accessPolicy) }]
    : undefined;

  await createProjectMembership(systemRepo, user, project, coordinatorPractitioner, {
    admin: false,
    access,
  });

  globalLogger.info(`Created Coordinator: ${user.id}`);
  globalLogger.info(`  Login: ${COORDINATOR_DATA.email} / ${COORDINATOR_DATA.password}`);
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

async function createBotoxQuestionnaire(
  systemRepo: SystemRepository,
  project: Project
): Promise<Questionnaire> {
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
  practitioner: Practitioner,
  patients: { id: string; data: (typeof PATIENTS)[0] }[]
): Promise<void> {
  // Get tomorrow's date in NYC timezone
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  // Define appointments with proper ISO dates
  const appointments = [
    { patientIdx: 0, date: '2025-03-15', time: '14:00', status: 'fulfilled', service: 'Botox - Forehead & Crows Feet' },
    { patientIdx: 0, date: dateStr, time: '10:00', status: 'booked', service: 'Botox Touch-up' },
    { patientIdx: 1, date: dateStr, time: '15:30', status: 'booked', service: 'Botox Consultation' },
    { patientIdx: 2, date: '2025-04-25', time: '11:00', status: 'booked', service: 'Botox - Crows Feet & Brow Lift' },
  ];

  for (const appt of appointments) {
    const p = patients[appt.patientIdx];
    if (!p) {continue;}

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

    globalLogger.info(`Created appointment: ${appt.service} for ${p.data.firstName} ${p.data.lastName}`);
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
