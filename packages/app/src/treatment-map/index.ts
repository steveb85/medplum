// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

// Main components
export { TreatmentMap } from './components/TreatmentMap';
export { PhotoCanvas } from './components/PhotoCanvas';
export { PhotoUploadZone } from './components/PhotoUploadZone';
export { ZoneEntryPopup } from './components/ZoneEntryPopup';
export { ZoneList } from './components/ZoneList';
export { FaceTemplate } from './components/FaceTemplate';
export { SvgCanvas } from './components/SvgCanvas';

// Hooks
export { useInjectionMap } from './hooks/useInjectionMap';

// Types
export type {
  InjectionMap,
  InjectionMarker,
  ZoneDefinition,
  TreatmentMapProps,
  PhotoCanvasProps,
  ZoneEntryPopupProps,
  ZoneListProps,
  BodyRegion,
  ViewAngle,
  ProductBrand,
} from './types/injection';

// Config
export {
  FACE_ZONES_FRONT,
  FACE_ZONES_PROFILE,
  getZones,
  getZoneById,
  groupZonesByMuscle,
  getAvailableBodyRegions,
  getAvailableViews,
} from './config/zones';

// Utils
export {
  PRODUCT_COLORS,
  PRODUCT_NAMES,
  getColorByUnits,
  generateMarkerId,
  calculateUnitsByProduct,
  calculateTotalUnits,
  findNearestZone,
} from './types/injection';
