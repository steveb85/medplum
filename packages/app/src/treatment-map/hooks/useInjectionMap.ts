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
import type { BackgroundConfig } from '../components/BackgroundSelector';

export interface UseInjectionMapReturn {
  // State
  bodyRegion: BodyRegion;
  view: ViewAngle;
  templateView: 'front' | 'left' | 'right';
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
  saveTreatment: (background: BackgroundConfig, markersToSave?: InjectionMarker[]) => Promise<InjectionMap | null>;
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
        templateView: existingMap.templateView || 'front',
        patientPhoto: existingMap.patientPhoto,
        markers: existingMap.markers,
      };
    }
    return {
      bodyRegion: 'face' as BodyRegion,
      view: 'front' as ViewAngle,
      templateView: 'front' as 'front' | 'left' | 'right',
      patientPhoto: null as Attachment | null,
      markers: [] as InjectionMarker[],
    };
  }, [mode, existingMap]);

  // State
  const [bodyRegion, setBodyRegionState] = useState<BodyRegion>(initialState.bodyRegion);
  const [view, setViewState] = useState<ViewAngle>(initialState.view);
  const [templateView, setTemplateView] = useState<'front' | 'left' | 'right'>(initialState.templateView);
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
        // Use the actual click position, not the zone center
        // This preserves the exact injection location for precise mapping
        x: x,
        y: y,
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

  const saveTreatment = useCallback(async (background: BackgroundConfig, markersToSave?: InjectionMarker[]): Promise<InjectionMap | null> => {
    // Use provided markers or fall back to current state
    const markersArray = markersToSave ?? markers;

    if (markersArray.length === 0) {
      showNotification({
        title: 'No Injections',
        message: 'Please mark at least one injection point',
        color: 'red',
      });
      return null;
    }

    setIsSaving(true);

    try {
      const profile = medplum.getProfile();
      const injectionMap: InjectionMap = {
        bodyRegion,
        view: background.type === 'template' ? background.templateView : 'front',
        backgroundType: background.type,
        templateGender: background.type === 'template' ? (background.templateGender as 'male' | 'female' | 'unknown') : undefined,
        templateView: background.templateView,
        photoMediaId: background.type === 'photo' ? background.photoId : undefined,
        // Use a placeholder attachment for the SVG template
        patientPhoto: patientPhoto || {
          contentType: 'image/svg+xml',
          url: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><!-- ${background.templateView} view template --></svg>`)}`,
          title: `Face Template (${background.templateView} view)`,
        },
        markers: markersArray,
        createdAt: new Date().toISOString(),
        createdBy: profile ? { reference: `Practitioner/${profile.id}` } : undefined,
      };

      // Return the injection map for parent to handle actual save
      return injectionMap;
    } catch (err) {
      showNotification({
        title: 'Error Creating Treatment Map',
        message: normalizeErrorString(err),
        color: 'red',
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [patientPhoto, markers, bodyRegion, view, medplum]);

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
    templateView,
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
