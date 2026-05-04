// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Formatters Utility
 * Helper functions for formatting intake data
 */

import type { Patient, HumanName } from '@medplum/fhirtypes';

/**
 * Format patient name from FHIR HumanName array
 */
export function formatPatientName(patient: Patient): string {
  const name = patient.name?.[0];
  if (!name) return 'Unknown';

  const given = name.given?.join(' ') || '';
  const family = name.family || '';

  return `${given} ${family}`.trim() || 'Unknown';
}

/**
 * Format date of birth for display
 */
export function formatDateOfBirth(birthDate?: string): string {
  if (!birthDate) return 'Unknown';

  try {
    const date = new Date(birthDate);
    if (isNaN(date.getTime())) return 'Invalid date';

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return birthDate;
  }
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return phone;
}

/**
 * Format address for display
 */
export function formatAddress(
  street: string,
  city: string,
  state: string,
  zip: string
): string {
  return `${street}, ${city}, ${state} ${zip}`;
}

/**
 * Format referral source for display
 */
export function formatReferralSource(source: string): string {
  const sources: Record<string, string> = {
    google: 'Google Search',
    instagram: 'Instagram',
    facebook: 'Facebook',
    friend: 'Friend/Family Referral',
    'returning-patient': 'Returning Patient',
    other: 'Other',
  };

  return sources[source] || source;
}

/**
 * Format medical condition for display
 */
export function formatMedicalCondition(condition: string): string {
  const conditions: Record<string, string> = {
    diabetes: 'Diabetes',
    'heart-condition': 'Heart Condition',
    'autoimmune-disorder': 'Autoimmune Disorder',
    'bleeding-disorder': 'Bleeding Disorder',
    'seizure-disorder': 'Seizure Disorder',
    'cold-sores': 'Cold Sores (HSV-1)',
    'keloid-tendency': 'Keloid Tendency',
    none: 'None',
  };

  return conditions[condition] || condition;
}

/**
 * Format aesthetic concern for display
 */
export function formatAestheticConcern(concern: string): string {
  const concerns: Record<string, string> = {
    'fine-lines': 'Fine Lines',
    wrinkles: 'Wrinkles',
    'volume-loss': 'Volume Loss',
    'skin-texture': 'Skin Texture',
    pigmentation: 'Pigmentation/Sun Spots',
    'acne-scars': 'Acne/Acne Scars',
    'pore-size': 'Pore Size',
    'skin-laxity': 'Skin Laxity',
    'under-eye-darkness': 'Under Eye Darkness',
    'lip-enhancement': 'Lip Enhancement',
    'jawline-definition': 'Jawline Definition',
    'neck-lines': 'Neck Lines',
    other: 'Other',
  };

  return concerns[concern] || concern;
}

/**
 * Format treatment area for display
 */
export function formatTreatmentArea(area: string): string {
  const areas: Record<string, string> = {
    forehead: 'Forehead',
    'between-brows': 'Between Brows',
    'crows-feet': "Crow's Feet",
    'under-eyes': 'Under Eyes',
    cheeks: 'Cheeks',
    'nasolabial-folds': 'Nasolabial Folds',
    lips: 'Lips',
    chin: 'Chin',
    jawline: 'Jawline',
    neck: 'Neck',
    hands: 'Hands',
    other: 'Other',
  };

  return areas[area] || area;
}

/**
 * Format pregnancy status for display
 */
export function formatPregnancyStatus(status: string): string {
  const statuses: Record<string, string> = {
    pregnant: 'Currently Pregnant',
    'trying-to-conceive': 'Trying to Conceive',
    breastfeeding: 'Breastfeeding',
    none: 'None of the Above',
  };

  return statuses[status] || status;
}

/**
 * Format procedure type for display
 */
export function formatProcedureType(procedure: string): string {
  const procedures: Record<string, string> = {
    botox: 'Botox',
    dysport: 'Dysport',
    fillers: 'Dermal Fillers',
    laser: 'Laser Treatment',
    peels: 'Chemical Peel',
    microneedling: 'Microneedling',
    none: 'None',
  };

  return procedures[procedure] || procedure;
}

/**
 * Format severity level for display
 */
export function formatSeverity(severity: string): string {
  const severities: Record<string, string> = {
    mild: 'Mild (localized reaction)',
    moderate: 'Moderate (requires medication)',
    severe: 'Severe (anaphylaxis risk)',
  };

  return severities[severity] || severity;
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
