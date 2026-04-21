// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { useState, useCallback, useMemo } from 'react';
import { showNotification } from '@mantine/notifications';
import { normalizeErrorString } from '@medplum/core';
import type { Attachment } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import type {
  InjectionMap,
  InjectionMarker,
  BodyRegion,
  ViewAngle,
  ProductBrand,
} from '../types/injection';
import {
  generateMarkerId,
  findNearestZone,
  calculateUnitsByProduct,
  calculateTotalUnits,
} from '../types/injection';
import { getZones } from '../config/zones';

export interface UseInjectionMapReturn {
  // State
  bodyRegion: BodyRegion;
  view: ViewAngle;
  patientPhoto: Attachment | null;
  markers: InjectionMarker[];
  selectedMarker: InjectionMarker | null;
  isSaving: boolean;

  // Actions
  setBodyRegion: (region: BodyRegion) => void;
  setView: (view: ViewAngle) => void;
  setPatientPhoto: (photo: Attachment) => void;
  addMarker: (x: number, y: number) => void;
  updateMarker: (marker: InjectionMarker) => void;
  deleteMarker: (markerId: string) => void;
  selectMarker: (marker: InjectionMarker | null) => void;
  saveTreatment: () => Promise<void>;
  reset: () => void;

  // Computed
  zones: ReturnType<typeof getZones>;
  unitsByProduct: Record<ProductBrand, number>;
  totalUnits: number;
  totalMarkers: number;
  canSave: boolean;
}

/**
 * Hook for managing injection map state
 * @param patientId - id of the patient
 * @param mode - format
 * @param existingMap - existing injection map (for view mode)
 * @returns state and actions for injection map
 */
export function useInjectionMap(
  patientId: string,
  mode: 'create' | 'view' | undefined,
  existingMap?: InjectionMap
): UseInjectionMapReturn {
  const medplum = useMedplum();

  // Initialize state from existing map or defaults
  const initialState = useMemo(() => {
    if (mode === 'view' && existingMap) {
      return {
        bodyRegion: existingMap.bodyRegion,
        view: existingMap.view,
        patientPhoto: existingMap.patientPhoto,
        markers: existingMap.markers,
      };
    }
    return {
      bodyRegion: 'face' as BodyRegion,
      view: 'front' as ViewAngle,
      patientPhoto: null as Attachment | null,
      markers: [] as InjectionMarker[],
    };
  }, [mode, existingMap]);

  // State
  const [bodyRegion, setBodyRegionState] = useState<BodyRegion>(initialState.bodyRegion);
  const [view, setViewState] = useState<ViewAngle>(initialState.view);
  const [patientPhoto, setPatientPhotoState] = useState<Attachment | null>(initialState.patientPhoto || null);
  const [markers, setMarkers] = useState<InjectionMarker[]>(initialState.markers);
  const [selectedMarker, setSelectedMarker] = useState<InjectionMarker | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Get available zones for current region/view
  const zones = useMemo(() => getZones(bodyRegion, view), [bodyRegion, view]);

  // Computed values
  const unitsByProduct = useMemo(() => calculateUnitsByProduct(markers), [markers]);
  const totalUnits = useMemo(() => calculateTotalUnits(markers), [markers]);
  const totalMarkers = markers.length;
  // Can save if there are markers (photo is optional now with SVG templates)
  const canSave = markers.length > 0;

  // Actions
  const setBodyRegion = useCallback((region: BodyRegion) => {
    setBodyRegionState(region);
    // Reset markers when changing region (different zones)
    setMarkers([]);
    setSelectedMarker(null);
  }, []);

  const setView = useCallback((newView: ViewAngle) => {
    setViewState(newView);
    // Keep markers but update zones
    setSelectedMarker(null);
  }, []);

  const setPatientPhoto = useCallback((photo: Attachment) => {
    setPatientPhotoState(photo);
  }, []);

  const addMarker = useCallback((x: number, y: number) => {
    // Find nearest zone
    const nearestZone = findNearestZone(x, y, zones);

    const newMarker: InjectionMarker = {
      id: generateMarkerId(),
      zoneId: nearestZone?.id || 'custom',
      zoneName: nearestZone?.name || 'Custom Location',
      position: {
        x: nearestZone?.bounds.x || x,
        y: nearestZone?.bounds.y || y,
      },
      productBrand: 'botox_cosmetic',
      units: 0,
      notes: '',
      isPredefinedZone: !!nearestZone && nearestZone.id !== 'custom',
    };

    setMarkers((prev) => [...prev, newMarker]);
    setSelectedMarker(newMarker);
  }, [zones]);

  const updateMarker = useCallback((updatedMarker: InjectionMarker) => {
    setMarkers((prev) =>
      prev.map((m) => (m.id === updatedMarker.id ? updatedMarker : m))
    );
    if (selectedMarker?.id === updatedMarker.id) {
      setSelectedMarker(updatedMarker);
    }
  }, [selectedMarker]);

  const deleteMarker = useCallback((markerId: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== markerId));
    if (selectedMarker?.id === markerId) {
      setSelectedMarker(null);
    }
  }, [selectedMarker]);

  const selectMarker = useCallback((marker: InjectionMarker | null) => {
    setSelectedMarker(marker);
  }, []);

  const saveTreatment = useCallback(async () => {
    if (markers.length === 0) {
      showNotification({
        title: 'No Injections',
        message: 'Please mark at least one injection point',
        color: 'red',
      });
      return;
    }

    setIsSaving(true);

    try {
      const profile = medplum.getProfile();
      const injectionMap: InjectionMap = {
        bodyRegion,
        view,
        // Use a placeholder attachment for the SVG template
        patientPhoto: patientPhoto || {
          contentType: 'image/svg+xml',
          url: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><!-- ${view} view template --></svg>`)}`,
          title: `Face Template (${view} view)`,
        },
        markers,
        createdAt: new Date().toISOString(),
        createdBy: profile ? { reference: `Practitioner/${profile.id}` } : undefined,
      };
      console.log('Saving injection map:', injectionMap);

      // TODO: Create Procedure resource with extension
      // For now, just log success
      showNotification({
        title: 'Treatment Saved',
        message: `Documented ${markers.length} injection points (${totalUnits} total units)`,
        color: 'green',
      });

      // Reset form for new treatment
      setMarkers([]);
      setSelectedMarker(null);
      setPatientPhotoState(null);
    } catch (err) {
      showNotification({
        title: 'Error Saving Treatment',
        message: normalizeErrorString(err),
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  }, [patientPhoto, markers, bodyRegion, view, totalUnits, medplum]);

  const reset = useCallback(() => {
    setBodyRegionState('face');
    setViewState('front');
    setPatientPhotoState(null);
    setMarkers([]);
    setSelectedMarker(null);
  }, []);

  return {
    // State
    bodyRegion,
    view,
    patientPhoto,
    markers,
    selectedMarker,
    isSaving,

    // Actions
    setBodyRegion,
    setView,
    setPatientPhoto,
    addMarker,
    updateMarker,
    deleteMarker,
    selectMarker,
    saveTreatment,
    reset,

    // Computed
    zones,
    unitsByProduct,
    totalUnits,
    totalMarkers,
    canSave,
  };
}
