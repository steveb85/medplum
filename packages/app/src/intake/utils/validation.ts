// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Patient Intake Form Validation
 * Simple validation functions for each step of the intake form
 */

import type { IntakeFormData, IntakeStep, ValidationError, ValidationResult } from '../types/intake';

// ============================================================================
// Field-Level Validation Helpers
// ============================================================================

/**
 * Validate email format
 * @param email - Email to validate
 * @returns True if valid
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate phone format
 * @param phone - Phone to validate
 * @returns True if valid
 */
export function isValidPhone(phone: string): boolean {
  return /^[\d\s\-()]{10,}$/.test(phone);
}

/**
 * Validate ZIP code
 * @param zip - ZIP code to validate
 * @returns True if valid
 */
export function isValidZip(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip);
}

/**
 * Check if patient is 18+
 * @param dateOfBirth - Birth date string
 * @returns True if adult
 */
export function isAdult(dateOfBirth: string): boolean {
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 18;
}

// ============================================================================
// Step Validation Functions
// ============================================================================

/**
 * Validate welcome step
 * @param data - Form data
 * @returns Validation result
 */
function validateWelcomeStep(data: Partial<IntakeFormData>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.hipaaAcknowledged) {
    errors.push({ field: 'hipaaAcknowledged', message: 'HIPAA acknowledgment is required' });
  }
  if (!data.termsAccepted) {
    errors.push({ field: 'termsAccepted', message: 'Terms of service acceptance is required' });
  }
  if (!data.photoRelease) {
    errors.push({ field: 'photoRelease', message: 'Photo release consent is required' });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate demographics step
 * @param data - Form data
 * @returns Validation result
 */
function validateDemographicsStep(data: Partial<IntakeFormData>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.firstName || data.firstName.length < 2) {
    errors.push({ field: 'firstName', message: 'First name must be at least 2 characters' });
  }
  if (!data.lastName || data.lastName.length < 2) {
    errors.push({ field: 'lastName', message: 'Last name must be at least 2 characters' });
  }
  if (!data.pronouns) {
    errors.push({ field: 'pronouns', message: 'Pronouns are required' });
  }
  if (!data.dateOfBirth) {
    errors.push({ field: 'dateOfBirth', message: 'Date of birth is required' });
  } else {
    const birthDate = new Date(data.dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) {
      errors.push({ field: 'dateOfBirth', message: 'Please enter a valid date' });
    } else if (birthDate > new Date()) {
      errors.push({ field: 'dateOfBirth', message: 'Date of birth cannot be in the future' });
    } else if (!isAdult(data.dateOfBirth)) {
      errors.push({ field: 'dateOfBirth', message: 'Patient must be 18 or older' });
    }
  }
  if (!data.genderIdentity) {
    errors.push({ field: 'genderIdentity', message: 'Gender identity is required' });
  }
  if (!data.phone || !isValidPhone(data.phone)) {
    errors.push({ field: 'phone', message: 'Please enter a valid phone number' });
  }
  if (!data.email || !isValidEmail(data.email)) {
    errors.push({ field: 'email', message: 'Please enter a valid email address' });
  }
  if (!data.address?.street) {
    errors.push({ field: 'address.street', message: 'Street address is required' });
  }
  if (!data.address?.city) {
    errors.push({ field: 'address.city', message: 'City is required' });
  }
  if (!data.address?.state) {
    errors.push({ field: 'address.state', message: 'State is required' });
  }
  if (!data.address?.zip || !isValidZip(data.address.zip)) {
    errors.push({ field: 'address.zip', message: 'Please enter a valid ZIP code' });
  }
  if (!data.referralSource) {
    errors.push({ field: 'referralSource', message: 'Please select how you heard about us' });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate emergency contact step
 * @param data - Form data
 * @returns Validation result
 */
function validateEmergencyContactStep(data: Partial<IntakeFormData>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.emergencyContact?.name || data.emergencyContact.name.length < 2) {
    errors.push({ field: 'emergencyContact.name', message: 'Emergency contact name is required' });
  }
  if (!data.emergencyContact?.relationship) {
    errors.push({ field: 'emergencyContact.relationship', message: 'Relationship is required' });
  }
  if (!data.emergencyContact?.phone || !isValidPhone(data.emergencyContact.phone)) {
    errors.push({ field: 'emergencyContact.phone', message: 'Please enter a valid phone number' });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate insurance step
 * @param data - Form data
 * @returns Validation result
 */
function validateInsuranceStep(data: Partial<IntakeFormData>): ValidationResult {
  const errors: ValidationError[] = [];

  if (data.insurance?.hasInsurance === true) {
    if (!data.insurance.provider) {
      errors.push({ field: 'insurance.provider', message: 'Insurance provider is required' });
    }
    if (!data.insurance.policyNumber) {
      errors.push({ field: 'insurance.policyNumber', message: 'Policy number is required' });
    }
    if (data.insurance.policyholderSameAsPatient === false) {
      if (!data.insurance.policyholderName) {
        errors.push({ field: 'insurance.policyholderName', message: 'Policyholder name is required' });
      }
      if (!data.insurance.policyholderDOB) {
        errors.push({ field: 'insurance.policyholderDOB', message: 'Policyholder DOB is required' });
      }
      if (!data.insurance.policyholderRelationship) {
        errors.push({ field: 'insurance.policyholderRelationship', message: 'Relationship is required' });
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate medical history step
 * @param data - Form data
 * @returns Validation result
 */
function validateMedicalHistoryStep(data: Partial<IntakeFormData>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.medicalConditions || data.medicalConditions.length === 0) {
    errors.push({ field: 'medicalConditions', message: 'Please select at least one option' });
  }

  // Validate medications
  if (data.medications && data.medications.length > 0) {
    data.medications.forEach((med, index) => {
      if (!med.name) {
        errors.push({ field: `medications[${index}].name`, message: 'Medication name is required' });
      }
      if (!med.dosage) {
        errors.push({ field: `medications[${index}].dosage`, message: 'Dosage is required' });
      }
      if (!med.frequency) {
        errors.push({ field: `medications[${index}].frequency`, message: 'Frequency is required' });
      }
    });
  }

  // Validate allergies
  if (data.allergies && data.allergies.length > 0) {
    data.allergies.forEach((allergy, index) => {
      if (!allergy.substance) {
        errors.push({ field: `allergies[${index}].substance`, message: 'Substance is required' });
      }
    });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate aesthetic history step
 * @param data - Form data
 * @returns Validation result
 */
function validateAestheticHistoryStep(): ValidationResult {
  // Previous treatments are optional - no validation required
  // Users can add treatments without filling all fields
  return { isValid: true, errors: [] };
}

/**
 * Validate treatment goals step
 * @param data - Form data
 * @returns Validation result
 */
function validateTreatmentGoalsStep(data: Partial<IntakeFormData>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.primaryConcerns || data.primaryConcerns.length === 0) {
    errors.push({ field: 'primaryConcerns', message: 'Please select at least one concern' });
  }
  if (data.primaryConcerns && data.primaryConcerns.length > 3) {
    errors.push({ field: 'primaryConcerns', message: 'Please select up to 3 primary concerns' });
  }
  if (!data.treatmentAreas || data.treatmentAreas.length === 0) {
    errors.push({ field: 'treatmentAreas', message: 'Please select at least one treatment area' });
  }
  if (data.usesRetinoid === null || data.usesRetinoid === undefined) {
    errors.push({ field: 'usesRetinoid', message: 'Please indicate retinoid use' });
  }
  if (data.usesAcids === null || data.usesAcids === undefined) {
    errors.push({ field: 'usesAcids', message: 'Please indicate acid use' });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate contraindications step
 * @param data - Form data
 * @returns Validation result
 */
function validateContraindicationsStep(data: Partial<IntakeFormData>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.pregnancyStatus) {
    errors.push({ field: 'pregnancyStatus', message: 'Please select your pregnancy status' });
  }
  if (!data.sunExposure) {
    errors.push({ field: 'sunExposure', message: 'Please select recent sun exposure' });
  }
  if (data.hasActiveInfection === null || data.hasActiveInfection === undefined) {
    errors.push({ field: 'hasActiveInfection', message: 'Please indicate if you have any active infections' });
  }
  if (data.hasActiveInfection && !data.infectionType) {
    errors.push({ field: 'infectionType', message: 'Please specify the type of infection' });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate review step
 * @param data - Form data
 * @returns Validation result
 */
function validateReviewStep(data: Partial<IntakeFormData>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.informationConfirmed) {
    errors.push({ field: 'informationConfirmed', message: 'Please confirm all information is accurate' });
  }
  if (!data.signatureData || data.signatureData.length < 100) {
    errors.push({ field: 'signatureData', message: 'Digital signature is required' });
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================================
// Step Validation Map
// ============================================================================

const stepValidationMap: Record<IntakeStep, (data: Partial<IntakeFormData>) => ValidationResult> = {
  welcome: validateWelcomeStep,
  demographics: validateDemographicsStep,
  'emergency-contact': validateEmergencyContactStep,
  insurance: validateInsuranceStep,
  'medical-history': validateMedicalHistoryStep,
  'aesthetic-history': validateAestheticHistoryStep,
  'treatment-goals': validateTreatmentGoalsStep,
  contraindications: validateContraindicationsStep,
  review: validateReviewStep,
};

// ============================================================================
// Public Validation Functions
// ============================================================================

/**
 * Validate a specific step of the intake form
 * @param step - Step to validate
 * @param data - Form data
 * @returns Validation result
 */
export function validateStep(step: IntakeStep, data: Partial<IntakeFormData>): ValidationResult {
  const validator = stepValidationMap[step];
  if (!validator) {
    return { isValid: true, errors: [] };
  }
  return validator(data);
}

/**
 * Check if navigation to a step is allowed
 * @param targetStepIndex - Step index to navigate to
 * @param currentStepIndex - Current step index
 * @param formData - Form data
 * @returns True if navigation allowed
 */
export function canNavigateToStep(
  targetStepIndex: number,
  currentStepIndex: number,
  formData: Partial<IntakeFormData>
): boolean {
  // Can always go backwards
  if (targetStepIndex <= currentStepIndex) {
    return true;
  }
  // Can only go to next step if current is valid
  return targetStepIndex === currentStepIndex + 1;
}

/**
 * Validate the entire form
 * @param formData - Complete form data
 * @returns Validation result
 */
export function validateFullForm(formData: IntakeFormData): ValidationResult {
  const allErrors: ValidationError[] = [];

  // Use STEPS array for consistency
  for (const step of STEPS) {
    const result = validateStep(step, formData);
    allErrors.push(...result.errors);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

// ============================================================================
// Default Form Data
// ============================================================================

/**
 * Get default form data
 * @returns Default IntakeFormData
 */
export function getDefaultFormData(): IntakeFormData {
  return {
    // Welcome
    hipaaAcknowledged: false,
    termsAccepted: false,
    photoRelease: false,

    // Demographics
    firstName: '',
    lastName: '',
    preferredName: '',
    pronouns: '',
    dateOfBirth: '',
    genderIdentity: '',
    phone: '',
    email: '',
    address: {
      street: '',
      city: '',
      state: 'NY',
      zip: '',
    },
    referralSource: '',

    // Emergency Contact
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
    },

    // Insurance
    insurance: {
      hasInsurance: null,
    },

    // Medical History
    medicalConditions: [],
    medications: [],
    allergies: [],
    previousAestheticTreatments: [],
    surgicalHistory: [],

    // Treatment Goals
    primaryConcerns: [],
    treatmentAreas: [],
    skincareRoutine: '',
    usesRetinoid: null,
    usesAcids: null,

    // Contraindications
    pregnancyStatus: '',
    sunExposure: '',
    hasActiveInfection: null,

    // Review
    informationConfirmed: false,
    signatureData: '',
    submissionDate: '',
  };
}

// ============================================================================
// Steps Array
// ============================================================================

/**
 * Form steps in order
 * Note: aesthetic-history and treatment-goals are combined into one step
 */
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
