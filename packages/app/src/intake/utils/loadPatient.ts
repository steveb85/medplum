// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Load Patient utility
 * Converts FHIR Patient and related resources back into form data
 */

import type { MedplumClient } from '@medplum/core';
import type {
  AllergyIntolerance,
  Condition,
  Consent,
  Flag,
  MedicationStatement,
  Observation,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
} from '@medplum/fhirtypes';
import { getDefaultFormData } from './validation';
import type { IntakeFormData, MedicalCondition } from '../types/intake';
import {
  MEDICAL_CONDITIONS,
  EMERGENCY_RELATIONSHIPS,
  REFERRAL_SOURCES,
  PRONOUNS,
  GENDER_IDENTITY,
  PREGNANCY_STATUS,
  SUN_EXPOSURE,
  AESTHETIC_PROCEDURES,
  AESTHETIC_CONCERNS,
  TREATMENT_AREAS,
} from '../types/intake';

const MEDICAL_CONDITION_URL = 'http://melissaknudson.com/fhir/StructureDefinition/medical-condition';
const AESTHETIC_TREATMENT_URL = 'http://melissaknudson.com/fhir/StructureDefinition/aesthetic-treatment-history';
const SURGICAL_HISTORY_URL = 'http://melissaknudson.com/fhir/StructureDefinition/surgical-history';
const PHOTO_RELEASE_URL = 'http://melissaknudson.com/fhir/StructureDefinition/photo-release-accepted';
const REFERRAL_SOURCE_URL = 'http://melissaknudson.com/fhir/StructureDefinition/referral-source';
const SKINCARE_URL = 'http://melissaknudson.com/fhir/StructureDefinition/skincare-routine';
const CONTRAINDICATION_URL = 'http://melissaknudson.com/fhir/StructureDefinition/contraindications';

/**
 * Load patient data from FHIR resources into form data
 */
export async function loadPatientIntoForm(
  medplum: MedplumClient,
  patientId: string
): Promise<IntakeFormData | null> {
  // Fetch patient
  const patient = await medplum.readResource('Patient', patientId).catch(() => null);
  if (!patient) return null;

  const formData = getDefaultFormData();

  // Load basic demographics
  loadDemographics(patient, formData);

  // Load extensions
  loadExtensions(patient, formData);

  // Load emergency contact
  await loadEmergencyContact(medplum, patient, formData);

  // Load insurance
  await loadInsurance(medplum, patientId, formData);

  // Load medical conditions
  await loadMedicalConditions(medplum, patientId, formData);

  // Load medications
  await loadMedications(medplum, patientId, formData);

  // Load allergies
  await loadAllergies(medplum, patientId, formData);

  // Load aesthetic treatments
  await loadAestheticTreatments(medplum, patientId, formData);

  // Load surgical history
  await loadSurgicalHistory(medplum, patientId, formData);

  // Load treatment goals
  await loadTreatmentGoals(medplum, patientId, formData);

  // Load contraindications
  await loadContraindications(medplum, patientId, formData);

  // Load consent
  await loadConsent(medplum, patientId, formData);

  // Load questionnaire response for signature
  await loadQuestionnaireResponse(medplum, patientId, formData);

  return formData;
}

/**
 * Load basic demographics from Patient resource
 */
function loadDemographics(patient: Patient, formData: IntakeFormData): void {
  // Names
  const officialName = patient.name?.find((n) => n.use === 'official') || patient.name?.[0];
  if (officialName) {
    formData.firstName = officialName.given?.[0] || '';
    formData.lastName = officialName.family || '';
  }

  // Preferred name
  const usualName = patient.name?.find((n) => n.use === 'usual');
  formData.preferredName = usualName?.given?.[0] || '';

  // DOB
  if (patient.birthDate) {
    formData.dateOfBirth = patient.birthDate;
  }

  // Gender
  if (patient.gender) {
    const genderMap: Record<string, string> = {
      male: 'male',
      female: 'female',
      other: 'non-binary',
      unknown: 'prefer-not-to-say',
    };
    const mapped = genderMap[patient.gender];
    if (mapped && GENDER_IDENTITY.includes(mapped as typeof GENDER_IDENTITY[number])) {
      formData.genderIdentity = mapped as typeof formData.genderIdentity;
    }
  }

  // Phone
  const phone = patient.telecom?.find((t) => t.system === 'phone' && t.use === 'mobile');
  formData.phone = phone?.value || patient.telecom?.find((t) => t.system === 'phone')?.value || '';

  // Email
  const email = patient.telecom?.find((t) => t.system === 'email');
  formData.email = email?.value || '';

  // Address
  const address = patient.address?.[0];
  if (address) {
    formData.address = {
      street: address.line?.join(', ') || '',
      city: address.city || '',
      state: address.state || '',
      zip: address.postalCode || '',
    };
  }
}

/**
 * Load extensions from Patient resource
 */
function loadExtensions(patient: Patient, formData: IntakeFormData): void {
  if (!patient.extension) return;

  for (const ext of patient.extension) {
    switch (ext.url) {
      // Pronouns
      case 'http://hl7.org/fhir/StructureDefinition/patient-pronouns': {
        const value = ext.valueCode || ext.valueString;
        if (value && PRONOUNS.includes(value as typeof PRONOUNS[number])) {
          formData.pronouns = value as typeof formData.pronouns;
        }
        break;
      }

      // Referral source
      case REFERRAL_SOURCE_URL: {
        const value = ext.valueString;
        if (value && REFERRAL_SOURCES.includes(value as typeof REFERRAL_SOURCES[number])) {
          formData.referralSource = value as typeof formData.referralSource;
        }
        break;
      }

      // Photo release
      case PHOTO_RELEASE_URL: {
        formData.photoRelease = ext.valueBoolean === true;
        break;
      }
    }
  }
}

/**
 * Load emergency contact from RelatedPerson
 */
async function loadEmergencyContact(
  medplum: MedplumClient,
  patient: Patient,
  formData: IntakeFormData
): Promise<void> {
  // Search for emergency contact
  const contacts = await medplum
    .searchResources('RelatedPerson', `patient=Patient/${patient.id}&relationship=emergency`)
    .catch(() => []);

  const contact = contacts[0];
  if (!contact) return;

  const name = contact.name?.[0];
  if (name) {
    formData.emergencyContact.name = name.given?.[0] || '';
  }

  const phone = contact.telecom?.find((t) => t.system === 'phone');
  formData.emergencyContact.phone = phone?.value || '';

  // Try to map relationship
  const relationship = contact.relationship?.[0]?.coding?.[0]?.code;
  if (relationship) {
    const relMap: Record<string, string> = {
      spouse: 'spouse',
      parent: 'parent',
      child: 'child',
      sibling: 'sibling',
      friend: 'friend',
    };
    const mapped = relMap[relationship.toLowerCase()];
    if (mapped && EMERGENCY_RELATIONSHIPS.includes(mapped as typeof EMERGENCY_RELATIONSHIPS[number])) {
      formData.emergencyContact.relationship = mapped as typeof formData.emergencyContact.relationship;
    }
  }
}

/**
 * Load insurance information
 */
async function loadInsurance(
  medplum: MedplumClient,
  patientId: string,
  formData: IntakeFormData
): Promise<void> {
  // Coverage search
  const coverages = await medplum
    .searchResources('Coverage', `beneficiary=Patient/${patientId}`)
    .catch(() => []);

  const coverage = coverages[0];
  if (!coverage) {
    formData.insurance.hasInsurance = false;
    return;
  }

  formData.insurance.hasInsurance = true;
  formData.insurance.provider = coverage.payor?.[0]?.display || '';
  formData.insurance.policyNumber = coverage.subscriberId || '';

  // Group number from class
  const group = coverage.class?.find((c) => c.type?.coding?.[0]?.code === 'group');
  formData.insurance.groupNumber = group?.value || '';

  // Policyholder info
  formData.insurance.policyholderSameAsPatient = coverage.subscriber?.reference === `Patient/${patientId}`;

  if (!formData.insurance.policyholderSameAsPatient && coverage.subscriber) {
    // Load subscriber details
    const subscriber = await medplum.readReference(coverage.subscriber).catch(() => null);
    if (subscriber && subscriber.resourceType === 'Patient') {
      const subPatient = subscriber as Patient;
      const name = subPatient.name?.[0];
      formData.insurance.policyholderName = name ? `${name.given?.[0] || ''} ${name.family || ''}`.trim() : '';
      formData.insurance.policyholderDOB = subPatient.birthDate || '';

      // Relationship
      const rel = coverage.relationship?.coding?.[0]?.code;
      if (rel) {
        formData.insurance.policyholderRelationship = rel;
      }
    }
  }
}

/**
 * Load medical conditions from Condition resources
 */
async function loadMedicalConditions(
  medplum: MedplumClient,
  patientId: string,
  formData: IntakeFormData
): Promise<void> {
  const conditions = await medplum
    .searchResources('Condition', `patient=Patient/${patientId}&category=problem-list-item`)
    .catch(() => []);

  const medicalConditions: string[] = [];

  for (const condition of conditions) {
    // Check for extension
    const ext = condition.extension?.find((e) => e.url === MEDICAL_CONDITION_URL);
    const conditionCode = ext?.valueString;

    if (conditionCode && MEDICAL_CONDITIONS.includes(conditionCode as MedicalCondition)) {
      medicalConditions.push(conditionCode);
    }
  }

  formData.medicalConditions = medicalConditions as MedicalCondition[];
}

/**
 * Load medications from MedicationStatement resources
 */
async function loadMedications(
  medplum: MedplumClient,
  patientId: string,
  formData: IntakeFormData
): Promise<void> {
  const statements = await medplum
    .searchResources('MedicationStatement', `subject=Patient/${patientId}`)
    .catch(() => []);

  formData.medications = statements
    .filter((s) => s.status === 'active')
    .map((statement, index) => {
      const medName =
        statement.medicationCodeableConcept?.text ||
        statement.medicationCodeableConcept?.coding?.[0]?.display ||
        'Unknown Medication';

      // Parse dosage from note or dosage
      const dosageText = statement.dosage?.[0]?.text || '';
      const frequency = statement.dosage?.[0]?.timing?.code?.text || '';

      // Check for flag extensions
      const extensions = statement.extension || [];
      const isAccutane =
        extensions.some(
          (e) => e.url?.includes('isotretinoin') && e.valueBoolean === true
        ) || medName.toLowerCase().includes('isotretinoin') || medName.toLowerCase().includes('accutane');
      const isBloodThinner =
        extensions.some(
          (e) => e.url?.includes('blood-thinner') && e.valueBoolean === true
        );
      const isPhotosensitizing =
        extensions.some(
          (e) => e.url?.includes('photosensitizing') && e.valueBoolean === true
        );

      return {
        id: `med-${index}`,
        name: medName,
        dosage: dosageText,
        frequency: frequency,
        isAccutane,
        isBloodThinner: isBloodThinner || false,
        isPhotosensitizing: isPhotosensitizing || false,
      };
    });
}

/**
 * Load allergies from AllergyIntolerance resources
 */
async function loadAllergies(
  medplum: MedplumClient,
  patientId: string,
  formData: IntakeFormData
): Promise<void> {
  const allergies = await medplum
    .searchResources('AllergyIntolerance', `patient=Patient/${patientId}`)
    .catch(() => []);

  formData.allergies = allergies.map((allergy, index) => {
    const substance =
      allergy.code?.text ||
      allergy.code?.coding?.[0]?.display ||
      'Unknown Allergen';

    // Map severity
    const severityMap: Record<string, 'mild' | 'moderate' | 'severe'> = {
      mild: 'mild',
      moderate: 'moderate',
      severe: 'severe',
    };
    const severity = severityMap[allergy.reaction?.[0]?.severity || ''] || 'mild';

    return {
      id: `allergy-${index}`,
      substance,
      severity,
    };
  });
}

/**
 * Load aesthetic treatment history
 */
async function loadAestheticTreatments(
  medplum: MedplumClient,
  patientId: string,
  formData: IntakeFormData
): Promise<void> {
  const observations = await medplum
    .searchResources('Observation', `subject=Patient/${patientId}&category=aesthetic-history`)
    .catch(() => []);

  const treatments: typeof formData.previousAestheticTreatments = [];

  for (const obs of observations) {
    const ext = obs.extension?.find((e) => e.url === AESTHETIC_TREATMENT_URL);
    if (!ext) continue;

    const procedure = ext.extension?.find((e) => e.url === 'procedure')?.valueString;
    if (!procedure) continue;

    if (AESTHETIC_PROCEDURES.includes(procedure as typeof AESTHETIC_PROCEDURES[number])) {
      treatments.push({
        id: obs.id || `treatment-${treatments.length}`,
        procedure: procedure as typeof formData.previousAestheticTreatments[0]['procedure'],
        when: obs.effectiveDateTime || obs.issued?.split('T')[0] || '',
        where: ext.extension?.find((e) => e.url === 'provider')?.valueString || '',
        results: ext.extension?.find((e) => e.url === 'results')?.valueString || '',
        complications: ext.extension?.find((e) => e.url === 'complications')?.valueString,
      });
    }
  }

  formData.previousAestheticTreatments = treatments;
}

/**
 * Load surgical history
 */
async function loadSurgicalHistory(
  medplum: MedplumClient,
  patientId: string,
  formData: IntakeFormData
): Promise<void> {
  const observations = await medplum
    .searchResources('Observation', `subject=Patient/${patientId}&category=surgical-history`)
    .catch(() => []);

  const history: typeof formData.surgicalHistory = [];

  for (const obs of observations) {
    const ext = obs.extension?.find((e) => e.url === SURGICAL_HISTORY_URL);
    if (!ext) continue;

    const procedure = ext.extension?.find((e) => e.url === 'procedure')?.valueString;
    if (!procedure) continue;

    const isCosmetic = ext.extension?.find((e) => e.url === 'isCosmetic')?.valueBoolean ?? false;

    history.push({
      id: obs.id || `surgery-${history.length}`,
      procedure,
      date: obs.effectiveDateTime || '',
      isCosmetic,
    });
  }

  formData.surgicalHistory = history;
}

/**
 * Load treatment goals from Flag resources
 */
async function loadTreatmentGoals(
  medplum: MedplumClient,
  patientId: string,
  formData: IntakeFormData
): Promise<void> {
  const flags = await medplum
    .searchResources('Flag', `patient=Patient/${patientId}&category=treatment-goals`)
    .catch(() => []);

  const primaryConcerns: string[] = [];
  const treatmentAreas: string[] = [];

  for (const flag of flags) {
    // Check for aesthetic concern
    const concern = flag.code?.text;
    if (concern && AESTHETIC_CONCERNS.includes(concern as typeof AESTHETIC_CONCERNS[number])) {
      primaryConcerns.push(concern);
    }

    // Check extension for treatment areas
    const ext = flag.extension?.find((e) => e.url?.includes('treatment-areas'));
    const area = ext?.valueString;
    if (area && TREATMENT_AREAS.includes(area as typeof TREATMENT_AREAS[number])) {
      treatmentAreas.push(area);
    }
  }

  formData.primaryConcerns = [...new Set(primaryConcerns)] as typeof formData.primaryConcerns;
  formData.treatmentAreas = [...new Set(treatmentAreas)] as typeof formData.treatmentAreas;

  // Load skincare info
  const skincareObs = await medplum
    .searchResources('Observation', `subject=Patient/${patientId}&code=${SKINCARE_URL}`)
    .catch(() => []);

  if (skincareObs[0]) {
    formData.skincareRoutine = skincareObs[0].valueString || '';

    // Check extensions
    const usesRetinoid = skincareObs[0].extension?.find((e) =>
      e.url?.includes('uses-retinoid')
    )?.valueBoolean;
    const usesAcids = skincareObs[0].extension?.find((e) =>
      e.url?.includes('uses-acids')
    )?.valueBoolean;

    formData.usesRetinoid = usesRetinoid ?? null;
    formData.usesAcids = usesAcids ?? null;
  }
}

/**
 * Load contraindications from Condition resources
 */
async function loadContraindications(
  medplum: MedplumClient,
  patientId: string,
  formData: IntakeFormData
): Promise<void> {
  const conditions = await medplum
    .searchResources('Condition', `patient=Patient/${patientId}&category=contraindication`)
    .catch(() => []);

  for (const condition of conditions) {
    // Check for pregnancy
    const pregnancyCode = condition.code?.coding?.find((c) =>
      ['pregnant', 'breastfeeding', 'trying-to-conceive'].includes(c.code || '')
    );
    if (pregnancyCode) {
      const status = pregnancyCode.code;
      if (status && PREGNANCY_STATUS.includes(status as typeof PREGNANCY_STATUS[number])) {
        formData.pregnancyStatus = status as typeof formData.pregnancyStatus;
      }
    }

    // Check for active infection
    if (condition.code?.text?.toLowerCase().includes('infection')) {
      formData.hasActiveInfection = true;
      formData.infectionType = condition.code.text;
    }

    // Check extensions
    const ext = condition.extension?.find((e) => e.url === CONTRAINDICATION_URL);
    if (ext) {
      const sunExp = ext.extension?.find((e) => e.url === 'sunExposure')?.valueString;
      if (sunExp && SUN_EXPOSURE.includes(sunExp as typeof SUN_EXPOSURE[number])) {
        formData.sunExposure = sunExp as typeof formData.sunExposure;
      }
    }
  }

  // If no conditions found, set defaults
  if (formData.pregnancyStatus === '') {
    formData.pregnancyStatus = 'none';
  }
  if (formData.sunExposure === '') {
    formData.sunExposure = 'none-recent';
  }
  if (formData.hasActiveInfection === null) {
    formData.hasActiveInfection = false;
  }
}

/**
 * Load consent status
 */
async function loadConsent(
  medplum: MedplumClient,
  patientId: string,
  formData: IntakeFormData
): Promise<void> {
  const consents = await medplum
    .searchResources('Consent', `patient=Patient/${patientId}`)
    .catch(() => []);

  for (const consent of consents) {
    const category = consent.category?.[0]?.coding?.[0]?.code;

    if (category === 'HIPAA' || consent.policyRule?.coding?.[0]?.code === 'hipaa') {
      formData.hipaaAcknowledged = consent.status === 'active';
    }

    if (category === 'terms-of-service' || consent.scope?.coding?.[0]?.code === 'treatment') {
      formData.termsAccepted = consent.status === 'active';
    }
  }
}

/**
 * Load signature from QuestionnaireResponse
 */
async function loadQuestionnaireResponse(
  medplum: MedplumClient,
  patientId: string,
  formData: IntakeFormData
): Promise<void> {
  const responses = await medplum
    .searchResources('QuestionnaireResponse', `subject=Patient/${patientId}&status=completed`)
    .catch(() => []);

  // Sort by date descending to get latest
  const sorted = responses.sort(
    (a, b) => new Date(b.authored || 0).getTime() - new Date(a.authored || 0).getTime()
  );

  const latest = sorted[0];
  if (!latest) return;

  // Find signature in items
  const signatureItem = latest.item?.find((item) => item.linkId === 'signature');
  if (signatureItem?.answer?.[0]?.valueString) {
    formData.signatureData = signatureItem.answer[0].valueString;
  }

  // Submission date
  if (latest.authored) {
    formData.submissionDate = latest.authored.split('T')[0];
  }
}
