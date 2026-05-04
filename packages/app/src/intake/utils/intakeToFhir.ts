// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Intake to FHIR Transformation Utilities
 * Converts intake form data to FHIR resources
 */

import { createReference } from '@medplum/core';
import type {
  AllergyIntolerance,
  Condition,
  Consent,
  ContactPoint,
  Coverage,
  Flag,
  MedicationStatement,
  Observation,
  Patient,
  Practitioner,
  QuestionnaireResponse,
} from '@medplum/fhirtypes';
import type { IntakeFormData, IntakeMode } from '../types/intake';

// ============================================================================
// Patient Resource Creation
// ============================================================================

export function createPatientFromIntake(data: IntakeFormData, submittedBy?: Practitioner): Patient {
  const telecom: ContactPoint[] = [
    { system: 'phone', value: data.phone, use: 'mobile', rank: 1 },
    { system: 'email', value: data.email, use: 'work', rank: 1 },
  ];

  // ... rest of createPatientFromIntake implementation
  return buildPatientObject(data, telecom, submittedBy);
}

/**
 * Update existing Patient from intake data
 */
export function updatePatientFromIntake(
  existingPatient: Patient,
  data: IntakeFormData,
  submittedBy?: Practitioner
): Patient {
  const telecom: ContactPoint[] = [
    { system: 'phone', value: data.phone, use: 'mobile', rank: 1 },
    { system: 'email', value: data.email, use: 'work', rank: 1 },
  ];

  // Build new patient object preserving existing ID and metadata
  const updatedPatient = buildPatientObject(data, telecom, submittedBy);

  return {
    ...updatedPatient,
    id: existingPatient.id,
    meta: existingPatient.meta,
    // Preserve any existing extensions that aren't being updated
    extension: [
      ...(existingPatient.extension?.filter(
        (e) => !e.url?.includes('pronouns') && !e.url?.includes('preferred-name') && !e.url?.includes('referral-source')
      ) ?? []),
      ...(updatedPatient.extension ?? []),
    ],
  };
}

/**
 * Build patient object from form data (shared between create and update)
 */
function buildPatientObject(
  data: IntakeFormData,
  telecom: ContactPoint[],
  submittedBy?: Practitioner
): Patient {
  const patient: Patient = {
    resourceType: 'Patient',
    name: [
      {
        use: 'official',
        family: data.lastName,
        given: [data.firstName],
      },
    ],
    telecom,
    birthDate: data.dateOfBirth,
    gender: data.genderIdentity as 'male' | 'female' | 'other' | 'unknown',
    address: [
      {
        use: 'home',
        line: [data.address.street],
        city: data.address.city,
        state: data.address.state,
        postalCode: data.address.zip,
        country: 'US',
      },
    ],
    contact: [
      {
        relationship: [
          {
            coding: [
              { system: 'http://hl7.org/fhir/patient-contactrelationship', code: data.emergencyContact.relationship },
            ],
          },
        ],
        name: { text: data.emergencyContact.name },
        telecom: [{ system: 'phone', value: data.emergencyContact.phone, use: 'mobile' }],
      },
    ],
    extension: [
      // Pronouns - required
      ...(data.pronouns
        ? [
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/pronouns',
              valueString: data.pronouns,
            },
          ]
        : []),
      // Preferred name - optional, only add if provided
      ...(data.preferredName?.trim()
        ? [
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/preferred-name',
              valueString: data.preferredName.trim(),
            },
          ]
        : []),
      // Referral source - required
      ...(data.referralSource
        ? [
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/referral-source',
              valueString: data.referralSource,
            },
          ]
        : []),
    ],
    generalPractitioner: submittedBy ? [createReference(submittedBy)] : undefined,
  };

  // Add usual name if preferred name exists
  if (data.preferredName?.trim()) {
    patient.name?.push({
      use: 'usual',
      given: [data.preferredName.trim()],
    });
  }

  return patient;
}

// ============================================================================
// Consent Resources Creation
// ============================================================================

export function createConsentsFromIntake(patientId: string, data: IntakeFormData): Consent[] {
  const baseDate = data.submissionDate || new Date().toISOString();

  const consents: Consent[] = [
    // HIPAA Privacy Notice
    {
      resourceType: 'Consent',
      status: 'active',
      scope: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }],
      },
      category: [
        {
          coding: [{ system: 'http://loinc.org', code: '59284-0', display: 'Consent Document' }],
        },
      ],
      patient: { reference: `Patient/${patientId}` },
      dateTime: baseDate,
      policy: [
        {
          authority: 'http://melissaknudson.com/policies',
          uri: 'http://melissaknudson.com/policies/hipaa-privacy',
        },
      ],
      provision: {
        type: 'permit',
      },
      extension: [
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/consent-type',
          valueString: 'hipaa-privacy',
        },
      ],
    },
    // Terms of Service
    {
      resourceType: 'Consent',
      status: 'active',
      scope: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'terms-of-service' }],
      },
      category: [
        {
          coding: [{ system: 'http://loinc.org', code: '57017-6', display: 'Terms of Service' }],
        },
      ],
      patient: { reference: `Patient/${patientId}` },
      dateTime: baseDate,
      policy: [
        {
          authority: 'http://melissaknudson.com/policies',
          uri: 'http://melissaknudson.com/policies/terms-of-service',
        },
      ],
      provision: {
        type: 'permit',
      },
      extension: [
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/consent-type',
          valueString: 'terms-of-service',
        },
      ],
    },
    // Photo Release
    {
      resourceType: 'Consent',
      status: 'active',
      scope: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }],
      },
      category: [
        {
          coding: [{ system: 'http://loinc.org', code: '57016-8', display: 'Photographic/Video Consent' }],
        },
      ],
      patient: { reference: `Patient/${patientId}` },
      dateTime: baseDate,
      policy: [
        {
          authority: 'http://melissaknudson.com/policies',
          uri: 'http://melissaknudson.com/policies/photo-release',
        },
      ],
      provision: {
        type: 'permit',
      },
      extension: [
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/consent-type',
          valueString: 'photo-release',
        },
      ],
    },
  ];

  return consents;
}

// ============================================================================
// Coverage Resource Creation (Insurance)
// ============================================================================

export function createCoverageFromIntake(patientId: string, data: IntakeFormData): Coverage | null {
  if (!data.insurance.hasInsurance) {
    return null;
  }

  const coverage: Coverage = {
    resourceType: 'Coverage',
    status: 'active',
    type: {
      coding: [
        { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'MEDSP', display: 'Medical Spa Coverage' },
      ],
    },
    beneficiary: { reference: `Patient/${patientId}` },
    subscriber: data.insurance.policyholderSameAsPatient ? { reference: `Patient/${patientId}` } : undefined,
    subscriberId: data.insurance.policyNumber,
    payor: [{ display: data.insurance.provider || 'Unknown' }],
    identifier: [
      {
        system: 'http://melissaknudson.com/insurance-policy',
        value: data.insurance.policyNumber,
      },
    ],
    extension: [
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/insurance-provider',
        valueString: data.insurance.provider,
      },
      ...(data.insurance.groupNumber
        ? [
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/insurance-group',
              valueString: data.insurance.groupNumber,
            },
          ]
        : []),
    ],
  };

  return coverage;
}

// ============================================================================
// Condition Resources Creation
// ============================================================================

const CONDITION_SNOMED_MAP: Record<string, string> = {
  diabetes: '73211009',
  'heart-condition': '56265001',
  'autoimmune-disorder': '85828009',
  'bleeding-disorder': '64779008',
  'seizure-disorder': '128613002',
  'cold-sores': '88551008',
  'keloid-tendency': '255227001',
};

export function createConditionsFromIntake(patientId: string, data: IntakeFormData): Condition[] {
  return (data.medicalConditions || [])
    .filter((condition) => condition !== 'none')
    .map((condition) => ({
      resourceType: 'Condition',
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
      },
      verificationStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }],
      },
      category: [
        { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item' }] },
      ],
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: CONDITION_SNOMED_MAP[condition] || '439401001',
            display: condition.replace(/-/g, ' '),
          },
        ],
        text: condition.replace(/-/g, ' '),
      },
      subject: { reference: `Patient/${patientId}` },
      onsetDateTime: new Date().toISOString(),
    }));
}

// ============================================================================
// MedicationStatement Resources Creation
// ============================================================================

export function createMedicationStatementsFromIntake(patientId: string, data: IntakeFormData): MedicationStatement[] {
  return (data.medications || []).map((med) => ({
    resourceType: 'MedicationStatement',
    status: 'active',
    medicationCodeableConcept: {
      text: med.name,
    },
    subject: { reference: `Patient/${patientId}` },
    dosage: [
      {
        text: `${med.dosage}, ${med.frequency}`,
      },
    ],
    note: [
      ...(med.isAccutane
        ? [{ text: 'Accutane/Isotretinoin - contraindicated for laser treatments within 6 months' }]
        : []),
      ...(med.isBloodThinner ? [{ text: 'Blood thinner - increased bruising risk' }] : []),
      ...(med.isPhotosensitizing ? [{ text: 'Photosensitizing medication - caution with laser treatments' }] : []),
    ],
    extension: [
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/medication-flags',
        extension: [
          { url: 'isAccutane', valueBoolean: med.isAccutane },
          { url: 'isBloodThinner', valueBoolean: med.isBloodThinner },
          { url: 'isPhotosensitizing', valueBoolean: med.isPhotosensitizing },
        ],
      },
    ],
  }));
}

// ============================================================================
// AllergyIntolerance Resources Creation
// ============================================================================

export function createAllergiesFromIntake(patientId: string, data: IntakeFormData): AllergyIntolerance[] {
  return (data.allergies || []).map((allergy) => ({
    resourceType: 'AllergyIntolerance',
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }],
    },
    verificationStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }],
    },
    type: 'allergy',
    category: ['medication'],
    code: {
      text: allergy.substance,
    },
    patient: { reference: `Patient/${patientId}` },
    reaction: [
      {
        manifestation: [{ text: `Allergic reaction to ${allergy.substance}` }],
        severity: allergy.severity,
      },
    ],
  }));
}

// ============================================================================
// Observation Resources Creation
// ============================================================================

export function createObservationsFromIntake(patientId: string, data: IntakeFormData): Observation[] {
  const observations: Observation[] = [];

  // Pregnancy status
  if (data.pregnancyStatus) {
    observations.push({
      resourceType: 'Observation',
      status: 'final',
      category: [
        { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'social-history' }] },
      ],
      code: { coding: [{ system: 'http://loinc.org', code: '82810-3', display: 'Pregnancy status' }] },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueString: data.pregnancyStatus,
    });
  }

  // Recent sun exposure
  if (data.sunExposure) {
    observations.push({
      resourceType: 'Observation',
      status: 'final',
      category: [
        { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'social-history' }] },
      ],
      code: {
        coding: [
          {
            system: 'http://melissaknudson.com/fhir/CodeSystem/observation',
            code: 'sun-exposure',
            display: 'Recent Sun Exposure',
          },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueString: data.sunExposure,
    });
  }

  // Active infection
  if (data.hasActiveInfection !== null) {
    observations.push({
      resourceType: 'Observation',
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam' }] }],
      code: { coding: [{ system: 'http://snomed.info/sct', code: '40733004', display: 'Infectious disease' }] },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueBoolean: data.hasActiveInfection,
      note: data.infectionType ? [{ text: data.infectionType }] : undefined,
    });
  }

  // Aesthetic history - previous treatments
  (data.previousAestheticTreatments || []).forEach((treatment) => {
    observations.push({
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            { system: 'http://melissaknudson.com/fhir/CodeSystem/observation-category', code: 'aesthetic-history' },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://melissaknudson.com/fhir/CodeSystem/procedure',
            code: treatment.procedure,
            display: treatment.procedure,
          },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueString: `${treatment.when} at ${treatment.where}`,
      note: [
        { text: `Results: ${treatment.results}` },
        ...(treatment.complications ? [{ text: `Complications: ${treatment.complications}` }] : []),
      ],
    });
  });

  // Skincare routine
  if (data.skincareRoutine) {
    observations.push({
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            { system: 'http://melissaknudson.com/fhir/CodeSystem/observation-category', code: 'skincare-routine' },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://melissaknudson.com/fhir/CodeSystem/observation',
            code: 'skincare-routine',
            display: 'Skincare Routine',
          },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueString: data.skincareRoutine,
    });
  }

  // Retinoid use
  if (data.usesRetinoid !== null) {
    observations.push({
      resourceType: 'Observation',
      status: 'final',
      category: [
        { coding: [{ system: 'http://melissaknudson.com/fhir/CodeSystem/observation-category', code: 'skincare' }] },
      ],
      code: {
        coding: [
          {
            system: 'http://melissaknudson.com/fhir/CodeSystem/observation',
            code: 'retinoid-use',
            display: 'Retinoid/Retinol Use',
          },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueBoolean: data.usesRetinoid,
    });
  }

  // Acids use
  if (data.usesAcids !== null) {
    observations.push({
      resourceType: 'Observation',
      status: 'final',
      category: [
        { coding: [{ system: 'http://melissaknudson.com/fhir/CodeSystem/observation-category', code: 'skincare' }] },
      ],
      code: {
        coding: [
          {
            system: 'http://melissaknudson.com/fhir/CodeSystem/observation',
            code: 'acids-use',
            display: 'AHA/BHA Use',
          },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueBoolean: data.usesAcids,
    });
  }

  // Treatment goals
  if (data.primaryConcerns?.length) {
    observations.push({
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            { system: 'http://melissaknudson.com/fhir/CodeSystem/observation-category', code: 'treatment-goals' },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://melissaknudson.com/fhir/CodeSystem/observation',
            code: 'primary-concerns',
            display: 'Primary Aesthetic Concerns',
          },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueString: data.primaryConcerns.join(', '),
    });
  }

  if (data.treatmentAreas?.length) {
    observations.push({
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            { system: 'http://melissaknudson.com/fhir/CodeSystem/observation-category', code: 'treatment-goals' },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://melissaknudson.com/fhir/CodeSystem/observation',
            code: 'treatment-areas',
            display: 'Areas of Interest',
          },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueString: data.treatmentAreas.join(', '),
    });
  }

  return observations;
}

// ============================================================================
// Flag Resources Creation (Blockers)
// ============================================================================

export function createFlagsFromIntake(patientId: string, data: IntakeFormData): Flag[] {
  const flags: Flag[] = [];

  // Pregnancy flag
  if (data.pregnancyStatus === 'pregnant') {
    flags.push({
      resourceType: 'Flag',
      status: 'active',
      code: {
        coding: [{ system: 'http://melissaknudson.com/fhir/CodeSystem/flag', code: 'pregnancy', display: 'Pregnant' }],
      },
      subject: { reference: `Patient/${patientId}` },
    });
  }

  // Accutane flag
  const hasAccutane = data.medications?.some((m) => m.isAccutane);
  if (hasAccutane) {
    flags.push({
      resourceType: 'Flag',
      status: 'active',
      code: {
        coding: [
          { system: 'http://melissaknudson.com/fhir/CodeSystem/flag', code: 'accutane', display: 'Accutane Use' },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
    });
  }

  // Active infection flag
  if (data.hasActiveInfection) {
    flags.push({
      resourceType: 'Flag',
      status: 'active',
      code: {
        coding: [
          {
            system: 'http://melissaknudson.com/fhir/CodeSystem/flag',
            code: 'active-infection',
            display: 'Active Infection',
          },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
    });
  }

  // Recent sun exposure flag
  if (data.sunExposure === 'last-2-weeks') {
    flags.push({
      resourceType: 'Flag',
      status: 'active',
      code: {
        coding: [
          {
            system: 'http://melissaknudson.com/fhir/CodeSystem/flag',
            code: 'recent-sun',
            display: 'Recent Sun Exposure',
          },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
    });
  }

  // Blood thinner flag
  const hasBloodThinner = data.medications?.some((m) => m.isBloodThinner);
  if (hasBloodThinner) {
    flags.push({
      resourceType: 'Flag',
      status: 'active',
      code: {
        coding: [
          { system: 'http://melissaknudson.com/fhir/CodeSystem/flag', code: 'blood-thinner', display: 'Blood Thinner' },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
    });
  }

  return flags;
}

// ============================================================================
// QuestionnaireResponse Creation (Raw Data Storage)
// ============================================================================

export function createQuestionnaireResponseFromIntake(
  patientId: string,
  data: IntakeFormData,
  mode: IntakeMode
): QuestionnaireResponse {
  // Helper to create answer only if value exists
  const createAnswer = (value: unknown, type: 'string' | 'boolean' | 'date' = 'string') => {
    if (value === null || value === undefined) return [];
    if (type === 'string' && (value === '' || (typeof value === 'string' && value.trim() === ''))) return [];

    if (type === 'boolean') {
      return [{ valueBoolean: value as boolean }];
    }
    if (type === 'date') {
      return [{ valueDate: value as string }];
    }
    return [{ valueString: String(value) }];
  };

  // Helper to create string answer array for non-empty values
  const createStringAnswers = (values: string[]): { valueString: string }[] => {
    return values.filter(v => v && v.trim() !== '').map(v => ({ valueString: v }));
  };

  const response: QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    subject: { reference: `Patient/${patientId}` },
    authored: data.submissionDate || new Date().toISOString(),
    item: [
      {
        linkId: 'demographics',
        text: 'Demographics',
        item: [
          { linkId: 'firstName', text: 'First Name', answer: createAnswer(data.firstName) },
          { linkId: 'lastName', text: 'Last Name', answer: createAnswer(data.lastName) },
          ...(data.preferredName?.trim() ? [{ linkId: 'preferredName', text: 'Preferred Name', answer: createAnswer(data.preferredName) }] : []),
          { linkId: 'pronouns', text: 'Pronouns', answer: createAnswer(data.pronouns) },
          { linkId: 'dateOfBirth', text: 'Date of Birth', answer: createAnswer(data.dateOfBirth, 'date') },
          { linkId: 'genderIdentity', text: 'Gender Identity', answer: createAnswer(data.genderIdentity) },
          { linkId: 'phone', text: 'Phone', answer: createAnswer(data.phone) },
          { linkId: 'email', text: 'Email', answer: createAnswer(data.email) },
          { linkId: 'address', text: 'Address', answer: createAnswer(JSON.stringify(data.address)) },
          { linkId: 'referralSource', text: 'Referral Source', answer: createAnswer(data.referralSource) },
        ].filter(item => item.answer && item.answer.length > 0),
      },
      {
        linkId: 'emergency-contact',
        text: 'Emergency Contact',
        item: [
          { linkId: 'emergencyName', text: 'Name', answer: createAnswer(data.emergencyContact.name) },
          { linkId: 'emergencyRelationship', text: 'Relationship', answer: createAnswer(data.emergencyContact.relationship) },
          { linkId: 'emergencyPhone', text: 'Phone', answer: createAnswer(data.emergencyContact.phone) },
        ].filter(item => item.answer && item.answer.length > 0),
      },
      {
        linkId: 'insurance',
        text: 'Insurance',
        item: [
          ...(data.insurance.hasInsurance !== null
            ? [{ linkId: 'hasInsurance', text: 'Has Insurance', answer: createAnswer(data.insurance.hasInsurance, 'boolean') }]
            : []),
          ...(data.insurance.hasInsurance && data.insurance.provider?.trim()
            ? [{ linkId: 'provider', text: 'Provider', answer: createAnswer(data.insurance.provider) }]
            : []),
          ...(data.insurance.hasInsurance && data.insurance.policyNumber?.trim()
            ? [{ linkId: 'policyNumber', text: 'Policy Number', answer: createAnswer(data.insurance.policyNumber) }]
            : []),
        ],
      },
      {
        linkId: 'medical-history',
        text: 'Medical History',
        item: [
          ...(data.medicalConditions?.length > 0
            ? [{ linkId: 'medicalConditions', text: 'Medical Conditions', answer: createStringAnswers(data.medicalConditions) }]
            : []),
          ...(data.medications?.length > 0
            ? [{ linkId: 'medications', text: 'Medications', answer: createAnswer(JSON.stringify(data.medications)) }]
            : []),
          ...(data.allergies?.length > 0
            ? [{ linkId: 'allergies', text: 'Allergies', answer: createAnswer(JSON.stringify(data.allergies)) }]
            : []),
        ],
      },
      {
        linkId: 'treatment-goals',
        text: 'Treatment Goals',
        item: [
          ...(data.primaryConcerns?.length > 0
            ? [{ linkId: 'primaryConcerns', text: 'Primary Concerns', answer: createStringAnswers(data.primaryConcerns) }]
            : []),
          ...(data.treatmentAreas?.length > 0
            ? [{ linkId: 'treatmentAreas', text: 'Treatment Areas', answer: createStringAnswers(data.treatmentAreas) }]
            : []),
          ...(data.skincareRoutine?.trim()
            ? [{ linkId: 'skincareRoutine', text: 'Skincare Routine', answer: createAnswer(data.skincareRoutine) }]
            : []),
          ...(data.usesRetinoid !== null
            ? [{ linkId: 'usesRetinoid', text: 'Uses Retinoid', answer: createAnswer(data.usesRetinoid, 'boolean') }]
            : []),
          ...(data.usesAcids !== null
            ? [{ linkId: 'usesAcids', text: 'Uses Acids', answer: createAnswer(data.usesAcids, 'boolean') }]
            : []),
        ],
      },
      {
        linkId: 'contraindications',
        text: 'Contraindications',
        item: [
          ...(data.pregnancyStatus ? [{ linkId: 'pregnancyStatus', text: 'Pregnancy Status', answer: createAnswer(data.pregnancyStatus) }] : []),
          ...(data.sunExposure ? [{ linkId: 'sunExposure', text: 'Sun Exposure', answer: createAnswer(data.sunExposure) }] : []),
          ...(data.hasActiveInfection !== null
            ? [{ linkId: 'hasActiveInfection', text: 'Active Infection', answer: createAnswer(data.hasActiveInfection, 'boolean') }]
            : []),
          ...(data.hasActiveInfection && data.infectionType?.trim()
            ? [{ linkId: 'infectionType', text: 'Infection Type', answer: createAnswer(data.infectionType) }]
            : []),
        ],
      },
      {
        linkId: 'consents',
        text: 'Consents',
        item: [
          { linkId: 'hipaaAcknowledged', text: 'HIPAA Acknowledged', answer: createAnswer(data.hipaaAcknowledged, 'boolean') },
          { linkId: 'termsAccepted', text: 'Terms Accepted', answer: createAnswer(data.termsAccepted, 'boolean') },
          { linkId: 'photoRelease', text: 'Photo Release', answer: createAnswer(data.photoRelease, 'boolean') },
        ].filter(item => item.answer && item.answer.length > 0),
      },
      {
        linkId: 'submission',
        text: 'Submission',
        item: [
          { linkId: 'mode', text: 'Intake Mode', answer: createAnswer(mode) },
          { linkId: 'signature', text: 'Signature Provided', answer: createAnswer(!!data.signatureData, 'boolean') },
          { linkId: 'informationConfirmed', text: 'Information Confirmed', answer: createAnswer(data.informationConfirmed, 'boolean') },
        ].filter(item => item.answer && item.answer.length > 0),
      },
    ].filter(item => item.item && item.item.length > 0),
  };

  return response;
}
