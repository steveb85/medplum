// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { showNotification } from '@mantine/notifications';
import { getReferenceString, normalizeErrorString, createReference } from '@medplum/core';
import { useMedplum } from '@medplum/react';
import type { Patient, Practitioner, Procedure, Media, Attachment, Reference } from '@medplum/fhirtypes';
import { getMedSpaRole } from '../../auth/role';
import { createNotification } from '../../notifications/utils';
import type { NotificationData } from '../../notifications/templates';

export interface TreatmentData {
  patient: Patient | undefined;
  procedure: Procedure | undefined;
  beforePhotos: Attachment[];
  afterPhotos: Attachment[];
  loading: boolean;
  saving: boolean;
  role: string;
  user: Practitioner | undefined;
  patientId: string;
  procedureId: string | null;
}

export interface TreatmentActions {
  loadTreatment: () => Promise<void>;
  handleBeginTreatment: () => Promise<void>;
  handleCompleteTreatment: () => Promise<void>;
  reloadPhotos: () => Promise<void>;
  handleBeforePhotoUpload: (attachment: Attachment) => Promise<void>;
  handleAfterPhotoUpload: (attachment: Attachment) => Promise<void>;
  handleBeforePhotoRemove: (index: number) => Promise<void>;
  handleAfterPhotoRemove: (index: number) => Promise<void>;
  canBeginTreatment: () => boolean;
  canCompleteTreatment: () => boolean;
  canEdit: () => boolean;
  canUploadBeforePhotos: () => boolean;
  canUploadAfterPhotos: () => boolean;
}

export function useTreatmentData(): TreatmentData & TreatmentActions {
  const { id: patientId } = useParams() as { id: string };
  const [searchParams] = useSearchParams();
  const procedureId = searchParams.get('procedureId');
  const medplum = useMedplum();
  const role = getMedSpaRole(medplum);
  const user = medplum.getProfile() as Practitioner | undefined;

  const [patient, setPatient] = useState<Patient | undefined>();
  const [procedure, setProcedure] = useState<Procedure | undefined>();
  const [beforePhotos, setBeforePhotos] = useState<Attachment[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load patient
  useEffect(() => {
    const loadPatient = async (): Promise<void> => {
      try {
        const p = await medplum.readResource('Patient', patientId);
        setPatient(p);
      } catch (err) {
        showNotification({
          title: 'Error loading patient',
          message: normalizeErrorString(err),
          color: 'red',
        });
      }
    };

    loadPatient().catch(console.error);
  }, [patientId, medplum]);

  // Load procedure and photos
  const loadTreatment = useCallback(async (): Promise<void> => {
    if (!procedureId || !patient) return;

    try {
      setLoading(true);

      // Load procedure
      const p = await medplum.readResource('Procedure', procedureId);
      setProcedure(p);

      // Load before/after photos
      await reloadPhotos();
    } catch (err) {
      showNotification({
        title: 'Error loading treatment',
        message: normalizeErrorString(err),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [procedureId, patient, medplum]);

  // Load photos
  const reloadPhotos = useCallback(async (): Promise<void> => {
    if (!procedureId || !patient) return;

    try {
      const mediaBundle = await medplum.search('Media', {
        subject: getReferenceString(patient),
        _count: '100',
      });

      const before: Attachment[] = [];
      const after: Attachment[] = [];

      for (const entry of mediaBundle.entry || []) {
        const media = entry.resource as Media;
        const relatedProcedure = media.extension?.find(
          (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure'
        )?.valueReference?.reference;

        if (relatedProcedure === `Procedure/${procedureId}`) {
          if (media.content) {
            if (media.type?.coding?.[0]?.code === 'before') {
              before.push(media.content);
            } else if (media.type?.coding?.[0]?.code === 'after') {
              after.push(media.content);
            }
          }
        }
      }

      setBeforePhotos(before);
      setAfterPhotos(after);
    } catch (err) {
      console.error('Error loading photos:', err);
    }
  }, [procedureId, patient, medplum]);

  useEffect(() => {
    loadTreatment();
  }, [loadTreatment]);

  // Begin treatment
  const handleBeginTreatment = async (): Promise<void> => {
    if (!procedure) return;

    setSaving(true);
    try {
      const updated: Procedure = {
        ...procedure,
        status: 'in-progress',
        performedPeriod: {
          start: new Date().toISOString(),
        },
      };

      const saved = await medplum.updateResource(updated);
      setProcedure(saved);

      // Fetch provider from reference for notification
      let provider: Practitioner | undefined;
      const providerRef = saved.performer?.[0]?.actor;
      if (providerRef?.reference?.startsWith('Practitioner/')) {
        try {
          provider = await medplum.readReference(providerRef as Reference<Practitioner>);
        } catch {
          // If we can't read the provider, continue without it
        }
      }

      // Create notification
      const notificationData: NotificationData = {
        patient,
        procedure: saved,
        provider,
      };
      await createNotification(medplum, 'treatment-started', notificationData, user);

      showNotification({
        title: 'Treatment Started',
        message: 'Treatment is now in progress',
        color: 'blue',
      });
    } catch (err) {
      showNotification({
        title: 'Error',
        message: normalizeErrorString(err),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  // Complete treatment
  const handleCompleteTreatment = async (): Promise<void> => {
    if (!procedure) return;

    setSaving(true);
    try {
      const updated: Procedure = {
        ...procedure,
        status: 'completed',
        performedPeriod: {
          ...procedure.performedPeriod,
          end: new Date().toISOString(),
        },
      };

      const saved = await medplum.updateResource(updated);
      setProcedure(saved);

      // Fetch provider from reference for notification
      let provider: Practitioner | undefined;
      const providerRef = saved.performer?.[0]?.actor;
      if (providerRef?.reference?.startsWith('Practitioner/')) {
        try {
          provider = await medplum.readReference(providerRef as Reference<Practitioner>);
        } catch {
          // If we can't read the provider, continue without it
        }
      }

      // Create notification
      const notificationData: NotificationData = {
        patient,
        procedure: saved,
        provider,
      };
      await createNotification(medplum, 'treatment-completed', notificationData, user);

      showNotification({
        title: 'Treatment Completed',
        message: 'Treatment has been completed successfully',
        color: 'green',
      });
    } catch (err) {
      showNotification({
        title: 'Error',
        message: normalizeErrorString(err),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  // Permission checks
  const canBeginTreatment = (): boolean => {
    if (role === 'coordinator') return false;
    return procedure?.status === 'preparation';
  };

  const canCompleteTreatment = (): boolean => {
    if (role === 'coordinator') return false;
    return procedure?.status === 'in-progress';
  };

  const canEdit = (): boolean => {
    return role !== 'coordinator' && procedure?.status !== 'completed';
  };

  const canUploadBeforePhotos = (): boolean => {
    if (!procedure) return true;
    return procedure.status === 'preparation' || procedure.status === 'in-progress';
  };

  const canUploadAfterPhotos = (): boolean => {
    if (!procedure) return true;
    const isScheduled = procedure.status === 'preparation';
    const isClosed = procedure.status === 'completed' || procedure.status === 'stopped';
    const isCancelled = procedure.status === 'entered-in-error';
    return !isScheduled && !isClosed && !isCancelled;
  };

  // Upload a before photo
  const handleBeforePhotoUpload = useCallback(
    async (attachment: Attachment): Promise<void> => {
      if (!procedure || !patient) return;

      const patientRef = createReference(patient);
      const procedureRef = createReference(procedure);

      const media: Media = {
        resourceType: 'Media',
        status: 'completed',
        type: {
          coding: [
            {
              system: 'http://melissaknudson.com/photo-type',
              code: 'before',
              display: 'Before Treatment',
            },
          ],
        },
        subject: patientRef,
        issued: new Date().toISOString(),
        content: attachment,
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure',
            valueReference: procedureRef,
          },
        ],
      };

      await medplum.createResource(media);
      await reloadPhotos();
    },
    [procedure, patient, medplum, reloadPhotos]
  );

  // Upload an after photo
  const handleAfterPhotoUpload = useCallback(
    async (attachment: Attachment): Promise<void> => {
      if (!procedure || !patient) return;

      const patientRef = createReference(patient);
      const procedureRef = createReference(procedure);

      const media: Media = {
        resourceType: 'Media',
        status: 'completed',
        type: {
          coding: [
            {
              system: 'http://melissaknudson.com/photo-type',
              code: 'after',
              display: 'After Treatment',
            },
          ],
        },
        subject: patientRef,
        issued: new Date().toISOString(),
        content: attachment,
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure',
            valueReference: procedureRef,
          },
        ],
      };

      await medplum.createResource(media);
      await reloadPhotos();
    },
    [procedure, patient, medplum, reloadPhotos]
  );

  // Remove a before photo (placeholder - would need Media ID tracking)
  const handleBeforePhotoRemove = useCallback(
    async (_index: number): Promise<void> => {
      // TODO: Implement photo removal by Media ID
      // For now, just reload to sync state
      await reloadPhotos();
    },
    [reloadPhotos]
  );

  // Remove an after photo (placeholder - would need Media ID tracking)
  const handleAfterPhotoRemove = useCallback(
    async (_index: number): Promise<void> => {
      // TODO: Implement photo removal by Media ID
      // For now, just reload to sync state
      await reloadPhotos();
    },
    [reloadPhotos]
  );

  return {
    patient,
    procedure,
    beforePhotos,
    afterPhotos,
    loading,
    saving,
    role,
    user,
    patientId,
    procedureId,
    loadTreatment,
    handleBeginTreatment,
    handleCompleteTreatment,
    reloadPhotos,
    handleBeforePhotoUpload,
    handleAfterPhotoUpload,
    handleBeforePhotoRemove,
    handleAfterPhotoRemove,
    canBeginTreatment,
    canCompleteTreatment,
    canEdit,
    canUploadBeforePhotos,
    canUploadAfterPhotos,
  };
}
