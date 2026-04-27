// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Hardcoded equipment type categories.
 * These are the broad categories/types of equipment that can be managed.
 * Each physical equipment item has one of these types.
 */

export interface EquipmentType {
  code: string;
  label: string;
  category: 'laser' | 'injection' | 'prep' | 'documentation' | 'safety' | 'other';
}

export const EQUIPMENT_TYPES: EquipmentType[] = [
  // Laser & Energy Devices
  { code: 'laser-hair-removal', label: 'Laser Hair Removal Device', category: 'laser' },
  { code: 'ipl-device', label: 'IPL/Photofacial Device', category: 'laser' },
  { code: 'rf-microneedle', label: 'RF Microneedling Device', category: 'laser' },
  { code: 'co2-laser', label: 'CO2 Laser', category: 'laser' },
  { code: 'diode-laser', label: 'Diode Laser (Facial Veins)', category: 'laser' },
  { code: 'fractional-laser', label: 'Fractional Laser', category: 'laser' },

  // Injection & Procedure Equipment
  { code: 'botox-station', label: 'Botox/Dysport Supply Station', category: 'injection' },
  { code: 'filler-cart', label: 'Dermal Filler Cart', category: 'injection' },
  { code: 'microcannula-set', label: 'Microcannula Set', category: 'injection' },
  { code: 'injection-syringes', label: 'Injection Syringe Set', category: 'injection' },
  { code: 'micro-needling-pen', label: 'Microneedling Pen', category: 'injection' },

  // Patient Comfort & Prep
  { code: 'numbing-station', label: 'Numbing Cream Station', category: 'prep' },
  { code: 'cooling-device', label: 'Cooling/Ice Device', category: 'prep' },
  { code: 'facial-cleansing', label: 'Facial Cleansing Station', category: 'prep' },
  { code: 'healing-lamp', label: 'LED Healing Lamp', category: 'prep' },

  // Documentation & Photography
  { code: 'photo-setup', label: 'Photography Setup', category: 'documentation' },
  { code: 'ring-light', label: 'Ring Light', category: 'documentation' },
  { code: 'ipad-station', label: 'iPad/Documentation Station', category: 'documentation' },
  { code: 'photo-backdrop', label: 'Photo Backdrop', category: 'documentation' },

  // Medical & Safety
  { code: 'emergency-kit', label: 'Emergency Response Kit', category: 'safety' },
  { code: 'sharps-container', label: 'Sharps Container', category: 'safety' },
  { code: 'autoclave', label: 'Autoclave/Sterilizer', category: 'safety' },
  { code: 'emergency-oxygen', label: 'Emergency Oxygen', category: 'safety' },

  // Other/Misc
  { code: 'stool-chair', label: 'Stool/Treatment Chair', category: 'other' },
  { code: 'trolley-cart', label: 'Supply Trolley/Cart', category: 'other' },
  { code: 'storage-unit', label: 'Storage Unit', category: 'other' },
  { code: 'uv-sanitizer', label: 'UV Sanitizer', category: 'other' },
];

// Get equipment type by code
export function getEquipmentType(code: string): EquipmentType | undefined {
  return EQUIPMENT_TYPES.find((t) => t.code === code);
}

// Get human-readable label
export function getEquipmentLabel(code: string): string {
  return getEquipmentType(code)?.label || code;
}
