// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Zone definitions for treatment mapping
 * Coordinates are normalized (0-1) with origin at top-left
 * x: 0 = left, 1 = right
 * y: 0 = top, 1 = bottom
 */

import type { ZoneDefinition, BodyRegion, ViewAngle } from '../types/injection';

/**
 * Face zones - Front view
 * Detailed breakdown for neurotoxin treatments
 */
export const FACE_ZONES_FRONT: ZoneDefinition[] = [
  // FOREHEAD
  {
    id: 'forehead_left',
    name: 'Forehead (Left)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.35, y: 0.20, radius: 0.08 },
    muscleGroup: 'frontalis',
    side: 'left',
  },
  {
    id: 'forehead_center',
    name: 'Forehead (Center)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.50, y: 0.20, radius: 0.08 },
    muscleGroup: 'frontalis',
    side: 'center',
  },
  {
    id: 'forehead_right',
    name: 'Forehead (Right)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.65, y: 0.20, radius: 0.08 },
    muscleGroup: 'frontalis',
    side: 'right',
  },

  // GLABELLA (11s) - Detailed breakdown
  {
    id: 'glabella_left',
    name: "Glabella Left (Corrugator)",
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.45, y: 0.35, radius: 0.05 },
    muscleGroup: 'corrugator',
    side: 'left',
  },
  {
    id: 'glabella_center',
    name: "Glabella Center (Procerus)",
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.50, y: 0.35, radius: 0.04 },
    muscleGroup: 'procerus',
    side: 'center',
  },
  {
    id: 'glabella_right',
    name: "Glabella Right (Corrugator)",
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.55, y: 0.35, radius: 0.05 },
    muscleGroup: 'corrugator',
    side: 'right',
  },

  // CROW'S FEET - Very detailed (3 zones per side)
  {
    id: 'crow_feet_left_outer',
    name: "Crow's Feet (Left Outer)",
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.15, y: 0.42, radius: 0.04 },
    muscleGroup: 'orbicularis_oculi',
    side: 'left',
  },
  {
    id: 'crow_feet_left_middle',
    name: "Crow's Feet (Left Middle)",
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.20, y: 0.40, radius: 0.04 },
    muscleGroup: 'orbicularis_oculi',
    side: 'left',
  },
  {
    id: 'crow_feet_left_inner',
    name: "Crow's Feet (Left Inner)",
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.25, y: 0.38, radius: 0.04 },
    muscleGroup: 'orbicularis_oculi',
    side: 'left',
  },
  {
    id: 'crow_feet_right_outer',
    name: "Crow's Feet (Right Outer)",
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.85, y: 0.42, radius: 0.04 },
    muscleGroup: 'orbicularis_oculi',
    side: 'right',
  },
  {
    id: 'crow_feet_right_middle',
    name: "Crow's Feet (Right Middle)",
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.80, y: 0.40, radius: 0.04 },
    muscleGroup: 'orbicularis_oculi',
    side: 'right',
  },
  {
    id: 'crow_feet_right_inner',
    name: "Crow's Feet (Right Inner)",
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.75, y: 0.38, radius: 0.04 },
    muscleGroup: 'orbicularis_oculi',
    side: 'right',
  },

  // BROW LIFT
  {
    id: 'brow_lift_left',
    name: 'Brow Lift (Left)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.25, y: 0.35, radius: 0.04 },
    muscleGroup: 'frontalis',
    side: 'left',
  },
  {
    id: 'brow_lift_right',
    name: 'Brow Lift (Right)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.75, y: 0.35, radius: 0.04 },
    muscleGroup: 'frontalis',
    side: 'right',
  },

  // BUNNY LINES
  {
    id: 'bunny_lines_left',
    name: 'Bunny Lines (Left)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.44, y: 0.48, radius: 0.03 },
    muscleGroup: 'nasalis',
    side: 'left',
  },
  {
    id: 'bunny_lines_right',
    name: 'Bunny Lines (Right)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.56, y: 0.48, radius: 0.03 },
    muscleGroup: 'nasalis',
    side: 'right',
  },

  // LIP FLIP
  {
    id: 'lip_flip_upper_left',
    name: 'Lip Flip Upper (Left)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.45, y: 0.65, radius: 0.03 },
    muscleGroup: 'orbicularis_oris',
    side: 'left',
  },
  {
    id: 'lip_flip_upper_center',
    name: 'Lip Flip Upper (Center)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.50, y: 0.65, radius: 0.03 },
    muscleGroup: 'orbicularis_oris',
    side: 'center',
  },
  {
    id: 'lip_flip_upper_right',
    name: 'Lip Flip Upper (Right)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.55, y: 0.65, radius: 0.03 },
    muscleGroup: 'orbicularis_oris',
    side: 'right',
  },
  {
    id: 'lip_flip_lower_left',
    name: 'Lip Flip Lower (Left)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.45, y: 0.72, radius: 0.03 },
    muscleGroup: 'orbicularis_oris',
    side: 'left',
  },
  {
    id: 'lip_flip_lower_center',
    name: 'Lip Flip Lower (Center)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.50, y: 0.72, radius: 0.03 },
    muscleGroup: 'orbicularis_oris',
    side: 'center',
  },
  {
    id: 'lip_flip_lower_right',
    name: 'Lip Flip Lower (Right)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.55, y: 0.72, radius: 0.03 },
    muscleGroup: 'orbicularis_oris',
    side: 'right',
  },

  // MASSETER (TMJ/Jaw slimming)
  {
    id: 'masseter_left',
    name: 'Masseter (Left)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.25, y: 0.60, radius: 0.07 },
    muscleGroup: 'masseter',
    side: 'left',
  },
  {
    id: 'masseter_right',
    name: 'Masseter (Right)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.75, y: 0.60, radius: 0.07 },
    muscleGroup: 'masseter',
    side: 'right',
  },

  // DAO (Depressor Anguli Oris) - Marionette lines
  {
    id: 'dao_left',
    name: 'DAO - Marionette (Left)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.38, y: 0.75, radius: 0.04 },
    muscleGroup: 'depressor_anguli_oris',
    side: 'left',
  },
  {
    id: 'dao_right',
    name: 'DAO - Marionette (Right)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.62, y: 0.75, radius: 0.04 },
    muscleGroup: 'depressor_anguli_oris',
    side: 'right',
  },

  // MENTALIS (Chin dimple)
  {
    id: 'mentalis_center',
    name: 'Mentalis - Chin Dimple',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.50, y: 0.82, radius: 0.05 },
    muscleGroup: 'mentalis',
    side: 'center',
  },
  {
    id: 'mentalis_left',
    name: 'Mentalis - Chin (Left)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.45, y: 0.82, radius: 0.04 },
    muscleGroup: 'mentalis',
    side: 'left',
  },
  {
    id: 'mentalis_right',
    name: 'Mentalis - Chin (Right)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.55, y: 0.82, radius: 0.04 },
    muscleGroup: 'mentalis',
    side: 'right',
  },

  // PLATYSMA (Neck bands - visible on face view)
  {
    id: 'platysma_bands_left',
    name: 'Platysma Bands (Left)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.35, y: 0.90, radius: 0.05 },
    muscleGroup: 'platysma',
    side: 'left',
  },
  {
    id: 'platysma_bands_center',
    name: 'Platysma Bands (Center)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.50, y: 0.90, radius: 0.04 },
    muscleGroup: 'platysma',
    side: 'center',
  },
  {
    id: 'platysma_bands_right',
    name: 'Platysma Bands (Right)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.65, y: 0.90, radius: 0.05 },
    muscleGroup: 'platysma',
    side: 'right',
  },

  // TEMPLES
  {
    id: 'temple_left',
    name: 'Temple (Left)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.20, y: 0.30, radius: 0.06 },
    muscleGroup: 'temporalis',
    side: 'left',
  },
  {
    id: 'temple_right',
    name: 'Temple (Right)',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.80, y: 0.30, radius: 0.06 },
    muscleGroup: 'temporalis',
    side: 'right',
  },

  // Custom zone for free-form placement
  {
    id: 'custom',
    name: 'Custom Location',
    bodyRegion: 'face' as BodyRegion,
    view: 'front' as ViewAngle,
    bounds: { x: 0.5, y: 0.5, radius: 1.0 },
    muscleGroup: 'custom',
    side: 'center',
  },
];

/**
 * Face zones - Profile view
 * For fillers and profile-specific treatments
 */
export const FACE_ZONES_PROFILE: ZoneDefinition[] = [
  {
    id: 'profile_cheek_upper',
    name: 'Cheek (Upper)',
    bodyRegion: 'face' as BodyRegion,
    view: 'profile' as ViewAngle,
    bounds: { x: 0.70, y: 0.45, radius: 0.08 },
    muscleGroup: 'zygomaticus',
    side: 'center',
  },
  {
    id: 'profile_cheek_lower',
    name: 'Cheek (Lower)',
    bodyRegion: 'face' as BodyRegion,
    view: 'profile' as ViewAngle,
    bounds: { x: 0.65, y: 0.55, radius: 0.08 },
    muscleGroup: 'zygomaticus',
    side: 'center',
  },
  {
    id: 'profile_jawline',
    name: 'Jawline Angle',
    bodyRegion: 'face' as BodyRegion,
    view: 'profile' as ViewAngle,
    bounds: { x: 0.75, y: 0.70, radius: 0.06 },
    muscleGroup: 'masseter',
    side: 'center',
  },
  {
    id: 'profile_chin',
    name: 'Chin (Profile)',
    bodyRegion: 'face' as BodyRegion,
    view: 'profile' as ViewAngle,
    bounds: { x: 0.85, y: 0.78, radius: 0.06 },
    muscleGroup: 'mentalis',
    side: 'center',
  },
  {
    id: 'profile_temple',
    name: 'Temple Hollow',
    bodyRegion: 'face' as BodyRegion,
    view: 'profile' as ViewAngle,
    bounds: { x: 0.45, y: 0.25, radius: 0.06 },
    muscleGroup: 'temporalis',
    side: 'center',
  },
  {
    id: 'profile_nasolabial',
    name: 'Nasolabial Fold',
    bodyRegion: 'face' as BodyRegion,
    view: 'profile' as ViewAngle,
    bounds: { x: 0.55, y: 0.60, radius: 0.05 },
    muscleGroup: 'levator_labii',
    side: 'center',
  },
];

/**
 * Get zones for a specific body region and view
 * @param bodyRegion - e.g. 'face'
 * @param view - e.g. 'front'
 * @returns ZoneDefinition[] 
 */
export function getZones(bodyRegion: BodyRegion, view: ViewAngle): ZoneDefinition[] {
  if (bodyRegion === 'face') {
    if (view === 'front') {
      return FACE_ZONES_FRONT;
    }
    if (view === 'profile') {
      return FACE_ZONES_PROFILE;
    }
    // For other views, return front zones (fallback)
    return FACE_ZONES_FRONT;
  }

  // For other body regions (not yet implemented)
  return [];
}

/**
 * Get zone by ID
 * @param zoneId - The unique ID of the zone
 * @param zones - The list of zones to search within
 * @returns The ZoneDefinition object with the matching ID, or undefined if not found
 */
export function getZoneById(zoneId: string, zones: ZoneDefinition[]): ZoneDefinition | undefined {
  return zones.find((zone) => zone.id === zoneId);
}

/**
 * Group zones by muscle group
 * @param zones - The list of zones to group
 * @returns An object where keys are muscle groups and values are arrays of zones that belong to that muscle group
 */
export function groupZonesByMuscle(zones: ZoneDefinition[]): Record<string, ZoneDefinition[]> {
  const groups: Record<string, ZoneDefinition[]> = {};

  zones.forEach((zone) => {
    const muscle = zone.muscleGroup || 'other';
    if (!groups[muscle]) {
      groups[muscle] = [];
    }
    groups[muscle].push(zone);
  });

  return groups;
}

/**
 * Get all available body regions
 * @returns An array of unique body regions with their display names
 */
export function getAvailableBodyRegions(): { id: BodyRegion; name: string }[] {
  return [
    { id: 'face', name: 'Face' },
    // Future: { id: 'torso', name: 'Torso' },
    // Future: { id: 'lower', name: 'Lower Body' },
  ];
}

/**
 * Get available views for a body region
 * @param bodyRegion - The body region to get views for
 * @returns An array of view angles with their display names
 */
export function getAvailableViews(bodyRegion: BodyRegion): { id: ViewAngle; name: string }[] {
  if (bodyRegion === 'face') {
    return [
      { id: 'front', name: 'Front' },
      { id: 'profile', name: 'Profile' },
    ];
  }
  return [{ id: 'front', name: 'Front' }];
}
