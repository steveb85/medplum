// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { Procedure } from '@medplum/fhirtypes';

export type TreatmentType = 'botox' | 'filler' | 'laser' | 'consultation' | 'other';

/**
 * Determine treatment type from procedure data
 */
export function getTreatmentType(procedure: Procedure): TreatmentType {
  const serviceName = procedure.code?.text?.toLowerCase() || '';
  const codeValue = procedure.code?.coding?.[0]?.code?.toLowerCase() || '';
  
  if (serviceName.includes('botox') || codeValue.includes('botox')) {
    return 'botox';
  }
  if (serviceName.includes('filler') || codeValue.includes('filler')) {
    return 'filler';
  }
  if (serviceName.includes('laser') || codeValue.includes('laser')) {
    return 'laser';
  }
  if (serviceName.includes('consultation') || codeValue.includes('consultation')) {
    return 'consultation';
  }
  
  return 'other';
}

/**
 * Get treatment page route based on type
 */
export function getTreatmentPageRoute(
  patientId: string,
  procedureId: string,
  procedure: Procedure
): string {
  const type = getTreatmentType(procedure);
  
  switch (type) {
    case 'botox':
      return `/Patient/${patientId}/botox-treatment?procedureId=${procedureId}`;
    case 'filler':
      return `/Patient/${patientId}/filler-treatment?procedureId=${procedureId}`;
    case 'laser':
      return `/Patient/${patientId}/laser-treatment?procedureId=${procedureId}`;
    case 'consultation':
      return `/Patient/${patientId}/consultation-treatment?procedureId=${procedureId}`;
    default:
      // Default to botox-treatment for unknown types
      return `/Patient/${patientId}/botox-treatment?procedureId=${procedureId}`;
  }
}
