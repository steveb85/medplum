// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { Attachment, Reference } from '@medplum/fhirtypes';

/**
 * Body regions for treatment mapping
 * Extensible for future regions
 */
export type BodyRegion = 'face' | 'torso' | 'lower';

/**
 * View angles for each body region
 */
export type ViewAngle = 'front' | 'back' | 'left' | 'right' | 'profile';

/**
 * Side of the body (for bilateral structures)
 */
export type BodySide = 'left' | 'center' | 'right';

/**
 * Product brands for neurotoxin treatments
 */
export type ProductBrand =
  | 'botox_cosmetic'
  | 'dysport'
  | 'xeomin'
  | 'jeuveau'
  | 'custom';

/**
 * Individual injection marker placed on the photo
 */
export interface InjectionMarker {
  /** Unique marker ID */
  id: string;

  /** Reference to zone definition */
  zoneId: string;

  /** Human-readable zone name */
  zoneName: string;

  /** Position on photo (0-1 normalized coordinates) */
  position: {
    /** 0 = left, 1 = right */
    x: number;
    /** 0 = top, 1 = bottom */
    y: number;
  };

  /** Product brand used */
  productBrand: ProductBrand;

  /** Units injected */
  units: number;

  /** Clinical notes (angle, depth, technique, etc.) */
  notes?: string;

  /** Whether this marker was snapped to a predefined zone */
  isPredefinedZone: boolean;
}

/**
 * Complete injection map for a treatment
 */
export interface InjectionMap {
  /** Resource ID (for existing treatments) */
  id?: string;

  /** Body region being treated */
  bodyRegion: BodyRegion;

  /** View angle of the photo */
  view: ViewAngle;

  /** Patient photo attachment */
  patientPhoto: Attachment;

  /** All injection markers */
  markers: InjectionMarker[];

  /** Creation timestamp */
  createdAt: string;

  /** Provider who documented the treatment */
  createdBy?: Reference;
}

/**
 * Zone definition for predefined treatment areas
 */
export interface ZoneDefinition {
  /** Unique zone ID */
  id: string;

  /** Human-readable zone name */
  name: string;

  /** Body region */
  bodyRegion: BodyRegion;

  /** View angle */
  view: ViewAngle;

  /** Zone boundaries for snapping */
  bounds: {
    /** Center X (0-1) */
    x: number;
    /** Center Y (0-1) */
    y: number;
    /** Snap radius (0-1) */
    radius: number;
  };

  /** Muscle group (optional) */
  muscleGroup?: string;

  /** Side of body (for bilateral structures) */
  side?: BodySide;
}

/**
 * Props for the main TreatmentMap component
 */
export interface TreatmentMapProps {
  /** Patient ID being treated */
  patientId: string;

  /** Mode: create new or view existing */
  mode?: 'create' | 'view';

  /** Existing procedure (for view mode) */
  existingProcedure?: {
    id: string;
    injectionMap: InjectionMap;
  };

  /** Initial injection map for editing/viewing */
  initialMap?: InjectionMap;

  /** Callback when treatment is saved */
  onSave?: (injectionMap: InjectionMap) => void;

  /** Callback when cancelled */
  onCancel?: () => void;

  /** Whether the view is read-only (for coordinators) */
  readOnly?: boolean;

  /** Whether treatment is currently being saved */
  isSaving?: boolean;
}

/**
 * Props for the PhotoCanvas component
 */
export interface PhotoCanvasProps {
  /** Photo URL to display */
  photoUrl: string;

  /** Current markers */
  markers: InjectionMarker[];

  /** Available zones for snapping */
  zones: ZoneDefinition[];

  /** Selected marker (for editing) */
  selectedMarker?: InjectionMarker | null;

  /** Callback when canvas is clicked */
  onCanvasClick: (x: number, y: number) => void;

  /** Callback when a marker is clicked */
  onMarkerClick: (marker: InjectionMarker) => void;

  /** Whether the canvas is read-only */
  readOnly?: boolean;

  /** Color mode for markers */
  markerColorMode?: 'product' | 'units';
}

/**
 * Props for the ZoneEntryPopup component
 */
export interface ZoneEntryPopupProps {
  /** Whether the popup is open */
  isOpen: boolean;

  /** Marker being edited (null for new marker) */
  marker: InjectionMarker | null;

  /** Callback when marker is saved */
  onSave: (marker: InjectionMarker) => void;

  /** Callback when marker is deleted */
  onDelete: (markerId: string) => void;

  /** Callback when popup is closed */
  onClose: () => void;
}

/**
 * Props for the ZoneList component
 */
export interface ZoneListProps {
  /** Current markers */
  markers: InjectionMarker[];

  /** Selected marker */
  selectedMarker?: InjectionMarker | null;

  /** Callback when marker is selected */
  onMarkerSelect: (marker: InjectionMarker) => void;

  /** Callback when marker is deleted */
  onMarkerDelete: (markerId: string) => void;

  /** Whether the list is read-only */
  readOnly?: boolean;
}

/**
 * Summary data for a treatment
 */
export interface TreatmentSummaryData {
  /** Total markers */
  totalMarkers: number;

  /** Total units per product */
  unitsByProduct: Record<ProductBrand, number>;

  /** Grand total units */
  totalUnits: number;
}

/**
 * FHIR Extension structure for storing injection map
 */
export interface InjectionMapExtension {
  /** Extension URL */
  url: string;

  /** Extension values */
  extension: {
    url: string;
    valueString?: string;
    valueInteger?: number;
    valueDecimal?: number;
    valueAttachment?: Attachment;
    extension?: {
      url: string;
      valueString?: string;
      valueInteger?: number;
      valueDecimal?: number;
    }[];
  }[];
}

/**
 * Color configuration for products
 */
export const PRODUCT_COLORS: Record<ProductBrand, string> = {
  botox_cosmetic: '#3b82f6', // Blue
  dysport: '#10b981',        // Green
  xeomin: '#8b5cf6',         // Purple
  jeuveau: '#f59e0b',        // Amber
  custom: '#6b7280',         // Gray
};

/**
 * Product display names
 */
export const PRODUCT_NAMES: Record<ProductBrand, string> = {
  botox_cosmetic: 'Botox Cosmetic',
  dysport: 'Dysport',
  xeomin: 'Xeomin',
  jeuveau: 'Jeuveau',
  custom: 'Custom',
};

/**
 * Get color by units (gradient from green to red)
 * @param units - number of units for the marker
 * @returns hex color string
 */
export function getColorByUnits(units: number): string {
  if (units <= 5) {return '#22c55e';}      // Green (low)
  if (units <= 15) {return '#eab308';}     // Yellow (medium)
  return '#ef4444';                       // Red (high)
}

/**
 * Generate a unique marker ID
 * @returns unique marker ID string
 * Note: In a real application, consider using a more robust ID generation strategy (e.g. UUID)
 */
export function generateMarkerId(): string {
  return `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate total units per product
 * @param markers - array of injection markers
 * @returns record of product brand to total units
 */
export function calculateUnitsByProduct(markers: InjectionMarker[]): Record<ProductBrand, number> {
  const result: Record<string, number> = {};

  markers.forEach((marker) => {
    const product = marker.productBrand;
    result[product] = (result[product] || 0) + marker.units;
  });

  return result;
}

/**
 * Calculate grand total units
 * @param markers - array of injection markers
 * @returns total units across all markers
 * Note: This is a simple sum, but could be extended to apply business rules (e.g. discounts for certain combinations)
 */
export function calculateTotalUnits(markers: InjectionMarker[]): number {
  return markers.reduce((sum, marker) => sum + marker.units, 0);
}

/**
 * Find the nearest zone to a given coordinate
 * @param x - X coordinate of the click (0-1)
 * @param y - Y coordinate of the click (0-1)
 * @param zones - array of predefined zone definitions
 * @returns the nearest zone definition or null if no zone is within snapping distance
 * Note: This uses simple Euclidean distance, but could be enhanced with weighted factors (e.g. prioritize zones in the same view angle)
 */
export function findNearestZone(
  x: number,
  y: number,
  zones: ZoneDefinition[]
): ZoneDefinition | null {
  let nearest: ZoneDefinition | null = null;
  let minDistance = Infinity;

  zones.forEach((zone) => {
    const dx = x - zone.bounds.x;
    const dy = y - zone.bounds.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < zone.bounds.radius && distance < minDistance) {
      minDistance = distance;
      nearest = zone;
    }
  });

  return nearest;
}
