// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react';
import { useMedplum } from '@medplum/react';
import type { Patient, Media, Bundle } from '@medplum/fhirtypes';
import { getReferenceString } from '@medplum/core';

export type PatientGender = 'male' | 'female' | 'unknown' | 'other';

export interface TreatmentPhoto {
  id: string;
  resource: Media;
  type: 'before' | 'after';
  date: string;
  title: string;
  url: string;
}

export interface UsePatientAssetsReturn {
  gender: PatientGender | null;
  photos: TreatmentPhoto[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook to fetch patient gender and treatment photos
 * @param patientId - The patient ID
 * @param procedureId - Optional procedure ID to filter photos by treatment
 * @returns Patient gender and available photos
 */
export function usePatientAssets(
  patientId: string,
  procedureId?: string
): UsePatientAssetsReturn {
  const medplum = useMedplum();
  const [gender, setGender] = useState<PatientGender | null>(null);
  const [photos, setPhotos] = useState<TreatmentPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch patient for gender
      const patient = await medplum.readResource('Patient', patientId);
      const patientGender = patient.gender as PatientGender;
      setGender(patientGender || 'unknown');

      // Fetch Media resources for this patient
      const patientRef = getReferenceString(patient);
      const mediaBundle = await medplum.search('Media', {
        subject: patientRef,
        _sort: '-created',
        _count: '100',
      });

      const treatmentPhotos: TreatmentPhoto[] = [];

      for (const entry of mediaBundle.entry || []) {
        const media = entry.resource as Media;
        const content = media.content;
        if (!content || !content.url) continue;

        // Determine if this is a before or after photo
        const photoType = media.type?.coding?.[0]?.code as 'before' | 'after' | undefined;
        if (!photoType || (photoType !== 'before' && photoType !== 'after')) continue;

        // If procedureId is provided, filter by related procedure
        if (procedureId) {
          const relatedProcedure = media.extension?.find(
            (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure'
          )?.valueReference?.reference;

          // Include photos that are either:
          // 1. Related to this specific procedure, OR
          // 2. Not related to any procedure (general patient photos)
          if (relatedProcedure && !relatedProcedure.includes(procedureId)) {
            continue;
          }
        }

        treatmentPhotos.push({
          id: media.id || '',
          resource: media,
          type: photoType,
          date: media.issued || media.meta?.lastUpdated || '',
          title: content.title || `${photoType} photo`,
          url: content.url,
        });
      }

      setPhotos(treatmentPhotos);
    } catch (err) {
      console.error('Error fetching patient assets:', err);
      setError('Failed to load patient data');
    } finally {
      setLoading(false);
    }
  }, [medplum, patientId, procedureId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  return {
    gender,
    photos,
    loading,
    error,
    refresh: fetchAssets,
  };
}
