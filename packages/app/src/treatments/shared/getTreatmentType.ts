import type { Procedure } from '@medplum/fhirtypes';

export type TreatmentType = 'botox' | 'filler' | 'laser' | 'consultation' | 'other';

// Service catalog categories mapped to treatment types
const CATEGORY_ROUTES: Record<string, TreatmentType> = {
  neurotoxin: 'botox',
  'injectable-filler': 'filler',
  'laser-ipl': 'laser',
  'laser-resurfacing': 'laser',
  'rf-skin-tightening': 'laser',
  ultrasound: 'laser',
  microneedling: 'laser',
  consultation: 'consultation',
};

/**
 * Determine treatment type from procedure data
 * Checks category codes first, then falls back to keyword matching on text
 */
export function getTreatmentType(procedure: Procedure): TreatmentType {
  // Check for category code in coding
  const coding = procedure.code?.coding?.[0]?.code?.toLowerCase();
  if (coding && CATEGORY_ROUTES[coding]) {
    return CATEGORY_ROUTES[coding];
  }

  // Fallback: keyword matching on text
  const serviceName = procedure.code?.text?.toLowerCase() || '';

  if (serviceName.includes('botox') || serviceName.includes('neurotoxin') || serviceName.includes('dysport') || serviceName.includes('xeomin')) {
    return 'botox';
  }
  if (serviceName.includes('filler') || serviceName.includes('sculptra') || serviceName.includes('sculptra') || serviceName.includes('skinVive') || serviceName.includes('radiesse') || serviceName.includes('belotero')) {
    return 'filler';
  }
  if (serviceName.includes('laser') || serviceName.includes('lumecca') || serviceName.includes('fraxel') || serviceName.includes('thermage') || serviceName.includes('ulтера') || serviceName.includes('microneedling') || serviceName.includes('skin pen')) {
    return 'laser';
  }
  if (serviceName.includes('consultation') || serviceName.includes('consult')) {
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
