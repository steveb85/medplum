// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Patient Intake Form Types
 * Comprehensive type definitions for the multi-step patient intake form
 */

import type { Patient } from '@medplum/fhirtypes';

// ============================================================================
// Enums & Constants
// ============================================================================

export const PRONOUNS = ['he/him', 'she/her', 'they/them', 'other'] as const;
export type Pronouns = (typeof PRONOUNS)[number];

export const GENDER_IDENTITY = ['male', 'female', 'non-binary', 'prefer-not-to-say'] as const;
export type GenderIdentity = (typeof GENDER_IDENTITY)[number];

export const REFERRAL_SOURCES = [
  'google',
  'instagram',
  'facebook',
  'friend',
  'returning-patient',
  'other',
] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

export const EMERGENCY_RELATIONSHIPS = [
  'spouse',
  'parent',
  'sibling',
  'child',
  'friend',
  'other',
] as const;
export type EmergencyRelationship = (typeof EMERGENCY_RELATIONSHIPS)[number];

export const MEDICAL_CONDITIONS = [
  'diabetes',
  'heart-condition',
  'autoimmune-disorder',
  'bleeding-disorder',
  'seizure-disorder',
  'cold-sores',
  'keloid-tendency',
  'none',
] as const;
export type MedicalCondition = (typeof MEDICAL_CONDITIONS)[number];

export const AESTHETIC_CONCERNS = [
  'fine-lines',
  'wrinkles',
  'volume-loss',
  'skin-texture',
  'pigmentation',
  'acne-scars',
  'pore-size',
  'skin-laxity',
  'under-eye-darkness',
  'lip-enhancement',
  'jawline-definition',
  'neck-lines',
  'other',
] as const;
export type AestheticConcern = (typeof AESTHETIC_CONCERNS)[number];

export const TREATMENT_AREAS = [
  'forehead',
  'between-brows',
  'crows-feet',
  'under-eyes',
  'cheeks',
  'nasolabial-folds',
  'lips',
  'chin',
  'jawline',
  'neck',
  'hands',
  'other',
] as const;
export type TreatmentArea = (typeof TREATMENT_AREAS)[number];

export const PREGNANCY_STATUS = [
  'pregnant',
  'trying-to-conceive',
  'breastfeeding',
  'none',
] as const;
export type PregnancyStatus = (typeof PREGNANCY_STATUS)[number];

export const SUN_EXPOSURE = [
  'last-2-weeks',
  'last-month',
  'none-recent',
] as const;
export type SunExposure = (typeof SUN_EXPOSURE)[number];

export const AESTHETIC_PROCEDURES = [
  'botox',
  'dysport',
  'fillers',
  'laser',
  'peels',
  'microneedling',
  'none',
] as const;
export type AestheticProcedure = (typeof AESTHETIC_PROCEDURES)[number];

// ============================================================================
// Form Data Types
// ============================================================================

export interface MedicationEntry {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  isAccutane: boolean;
  isBloodThinner: boolean;
  isPhotosensitizing: boolean;
}

export interface AllergyEntry {
  id: string;
  substance: string;
  severity: 'mild' | 'moderate' | 'severe';
}

export interface PreviousAestheticTreatment {
  id: string;
  procedure: AestheticProcedure;
  when: string; // Approximate date or timeframe
  where: string;
  results: string;
  complications?: string;
}

export interface SurgicalHistoryEntry {
  id: string;
  procedure: string;
  date: string;
  isCosmetic: boolean;
}

export interface InsuranceInfo {
  hasInsurance: boolean | null;
  provider?: string;
  policyNumber?: string;
  groupNumber?: string;
  policyholderSameAsPatient?: boolean;
  policyholderName?: string;
  policyholderDOB?: string;
  policyholderRelationship?: string;
}

export interface IntakeFormData {
  // Step 1: Welcome & Legal
  hipaaAcknowledged: boolean;
  termsAccepted: boolean;
  photoRelease: boolean;

  // Step 2: Demographics
  firstName: string;
  lastName: string;
  preferredName: string;
  pronouns: Pronouns | '';
  dateOfBirth: string;
  genderIdentity: GenderIdentity | '';
  phone: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  referralSource: ReferralSource | '';

  // Step 3: Emergency Contact
  emergencyContact: {
    name: string;
    relationship: EmergencyRelationship | '';
    phone: string;
  };

  // Step 4: Insurance
  insurance: InsuranceInfo;

  // Step 5: Medical History
  medicalConditions: MedicalCondition[];
  medications: MedicationEntry[];
  allergies: AllergyEntry[];
  previousAestheticTreatments: PreviousAestheticTreatment[];
  surgicalHistory: SurgicalHistoryEntry[];

  // Step 6: Treatment Goals
  primaryConcerns: AestheticConcern[];
  treatmentAreas: TreatmentArea[];
  skincareRoutine: string;
  usesRetinoid: boolean | null;
  usesAcids: boolean | null;

  // Step 7: Contraindications
  pregnancyStatus: PregnancyStatus | '';
  sunExposure: SunExposure | '';
  hasActiveInfection: boolean | null;
  infectionType?: string;

  // Step 8: Review & Submit
  informationConfirmed: boolean;
  signatureData: string; // Base64 canvas data
  submissionDate: string;
}

// ============================================================================
// Wizard State Types
// ============================================================================

export type IntakeStep =
  | 'welcome'
  | 'demographics'
  | 'emergency-contact'
  | 'insurance'
  | 'medical-history'
  | 'aesthetic-history'
  | 'treatment-goals'
  | 'contraindications'
  | 'review';

export const STEPS: IntakeStep[] = [
  'welcome',
  'demographics',
  'emergency-contact',
  'insurance',
  'medical-history',
  'treatment-goals',
  'contraindications',
  'review',
];

export interface WizardState {
  currentStep: IntakeStep;
  currentStepIndex: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
}

// ============================================================================
// Mode Types
// ============================================================================

export type IntakeMode = 'self-service' | 'coordinator-assisted';

export interface IntakePageProps {
  mode?: IntakeMode;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// Blocker Types
// ============================================================================

export type BlockerSeverity = 'warning' | 'blocking';

export interface TreatmentBlocker {
  id: string;
  title: string;
  message: string;
  severity: BlockerSeverity;
  affectedTreatments: string[];
  fieldPath: string;
}

// ============================================================================
// Submission Types
// ============================================================================

export interface DuplicatePatient {
  patient: Patient;
  matchScore: number;
  matchReasons: string[];
}

export interface IntakeSubmissionResult {
  success: boolean;
  patientId?: string;
  errors?: string[];
}

// ============================================================================
// Draft Types
// ============================================================================

export interface IntakeDraft {
  id: string;
  data: Partial<IntakeFormData>;
  currentStep: IntakeStep;
  timestamp: number;
  mode: IntakeMode;
  userId?: string; // For coordinator mode
}

// ============================================================================
// Notification Types
// ============================================================================

export interface IntakeNotification {
  type: 'new-patient-intake';
  patientId: string;
  patientName: string;
  blockers: TreatmentBlocker[];
  submittedAt: string;
}

// ============================================================================
// API Types (for Cloudflare Worker)
// ============================================================================

export interface IntakeApiRequest {
  data: IntakeFormData;
  mode: IntakeMode;
  draftId?: string;
}

export interface IntakeApiResponse {
  success: boolean;
  patientId?: string;
  errors?: string[];
}
