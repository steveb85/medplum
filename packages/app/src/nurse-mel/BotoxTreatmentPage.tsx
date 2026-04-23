// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Alert, Badge, Button, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { createReference, getReferenceString, normalizeErrorString } from '@medplum/core';
import type { Appointment, Attachment, Media, Observation, Patient, Practitioner, Procedure } from '@medplum/fhirtypes';
import { Document, Loading, useMedplum } from '@medplum/react';
import { IconCircleCheck, IconEdit, IconPlayerPlay } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { getMedSpaRole } from '../auth/role';
// NOTE: CreateAppointmentModal removed - Phase 2 will implement multi-service booking
import type { NotificationData } from '../notifications/templates';
import { createNotification } from '../notifications/utils';
import type { InjectionMap } from '../treatment-map';
import { TreatmentMap } from '../treatment-map';
import { PhotoUploadSection } from './PhotoUploadSection';

// NOTIFICATION_OPPORTUNITY: When coordinator uploads photos,
// notify provider that photos are ready
// Location: After photo upload in PhotoUploadSection

interface TreatmentRecord {
  procedure: Procedure;
  observation?: Observation;
  beforePhotos: Media[];
  afterPhotos: Media[];
  injectionMap?: InjectionMap;
}

// Status configuration
const statusConfig: Record<string, { color: string; label: string; description: string }> = {
  preparation: {
    color: 'orange',
    label: 'Scheduled',
    description: 'Appointment booked, ready for before photos',
  },
  'in-progress': {
    color: 'blue',
    label: 'In Progress',
    description: 'Treatment active, injection mapping enabled',
  },
  completed: {
    color: 'green',
    label: 'Completed',
    description: 'Treatment finished, view only',
  },
  cancelled: {
    color: 'red',
    label: 'Cancelled',
    description: 'Treatment cancelled',
  },
};

// Parse FHIR extension to InjectionMap
function parseInjectionMapExtension(extension: any): InjectionMap | undefined {
  try {
    const bodyRegion = extension.extension?.find((e: any) => e.url === 'bodyRegion')?.valueString;
    const view = extension.extension?.find((e: any) => e.url === 'view')?.valueString;
    const patientPhoto = extension.extension?.find((e: any) => e.url === 'patientPhoto')?.valueAttachment;

    const markers: any[] = [];
    extension.extension?.forEach((e: any) => {
      if (e.url === 'marker' && e.extension) {
        const marker: any = {
          id: e.extension.find((m: any) => m.url === 'id')?.valueString || '',
          zoneId: e.extension.find((m: any) => m.url === 'zoneId')?.valueString || '',
          zoneName: e.extension.find((m: any) => m.url === 'zoneName')?.valueString || '',
          position: {
            x: e.extension.find((m: any) => m.url === 'x')?.valueDecimal || 0,
            y: e.extension.find((m: any) => m.url === 'y')?.valueDecimal || 0,
          },
          productBrand: e.extension.find((m: any) => m.url === 'productBrand')?.valueString || 'botox_cosmetic',
          units: e.extension.find((m: any) => m.url === 'units')?.valueInteger || 0,
          notes: e.extension.find((m: any) => m.url === 'notes')?.valueString || '',
          isPredefinedZone: e.extension.find((m: any) => m.url === 'isPredefinedZone')?.valueBoolean || false,
        };
        markers.push(marker);
      }
    });

    return {
      bodyRegion: bodyRegion || 'face',
      view: view || 'front',
      backgroundType: 'template',
      templateView: view || 'front',
      patientPhoto: patientPhoto || { contentType: 'image/jpeg' },
      markers,
      createdAt: extension.extension?.find((e: any) => e.url === 'createdAt')?.valueString || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error parsing injection map:', err);
    return undefined;
  }
}

export function BotoxTreatmentPage(): JSX.Element {
  const { id: patientId } = useParams() as { id: string };
  const [searchParams] = useSearchParams();
  const procedureId = searchParams.get('procedureId');
  const medplum = useMedplum();
  const role = getMedSpaRole(medplum);
  const user = medplum.getProfile() as Practitioner | undefined;

  // Loading states - MUST be declared before any early returns
  const [loading, setLoading] = useState(!!procedureId);
  const [saving, setSaving] = useState(false);

  // Patient data
  const [patient, setPatient] = useState<Patient | undefined>();

  // Procedure data
  const [procedure, setProcedure] = useState<Procedure | undefined>();
  const [injectionMap, setInjectionMap] = useState<InjectionMap | undefined>();
  const [beforePhotos, setBeforePhotos] = useState<Attachment[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<Attachment[]>([]);
  const [appointment, setAppointment] = useState<Appointment | undefined>();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  // Load photos
  const reloadPhotos = useCallback(async (): Promise<void> => {
    if (!procedureId || !patient) {
      return;
    }

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

  // Load existing procedure
  useEffect(() => {
    if (!procedureId || !patient) {
      return;
    }

    const loadProcedure = async (): Promise<void> => {
      try {
        setLoading(true);

        // Load procedure
        const p = await medplum.readResource('Procedure', procedureId);
        setProcedure(p);

        // Parse injection map
        const injectionMapExtension = p.extension?.find(
          (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/injection-map'
        );
        if (injectionMapExtension) {
          const map = parseInjectionMapExtension(injectionMapExtension);
          setInjectionMap(map);
        }

        // Load linked appointment from extension
        const linkedApptExtension = p.extension?.find(
          (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment'
        );
        if (linkedApptExtension?.valueReference?.reference?.startsWith('Appointment/')) {
          const appointmentId = linkedApptExtension.valueReference.reference.split('/')[1];
          const appt = await medplum.readResource('Appointment', appointmentId);
          setAppointment(appt);
        }

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
    };

    loadProcedure().catch(console.error);
  }, [procedureId, patient, medplum, reloadPhotos]);

  // Permission helpers
  // Check if current user is assigned to this treatment (in performer list)
  const isAssignedProvider = useCallback((): boolean => {
    if (!procedure || !user) {
      return false;
    }
    const performers = procedure.performer || [];
    const userRef = getReferenceString(user);
    return performers.some((p) => p.actor?.reference === userRef);
  }, [procedure, user]);

  // Check if current user is the main provider (first in performer list)
  const isMainProvider = useCallback((): boolean => {
    if (!procedure || !user) {
      return false;
    }
    const performers = procedure.performer || [];
    const mainProviderRef = performers[0]?.actor?.reference;
    const userRef = getReferenceString(user);
    return mainProviderRef === userRef;
  }, [procedure, user]);

  // Get assigned provider names for display
  const getAssignedProviders = useCallback((): { main?: string; assistant?: string } => {
    if (!procedure) {
      return {};
    }
    const performers = procedure.performer || [];
    return {
      main: performers[0]?.actor?.display,
      assistant: performers[1]?.actor?.display,
    };
  }, [procedure]);

  const canUploadBeforePhotos = useCallback((): boolean => {
    if (!procedure) {
      return true;
    } // Create mode
    return procedure.status === 'preparation' || procedure.status === 'in-progress';
  }, [procedure]);

  const canUploadAfterPhotos = useCallback((): boolean => {
    if (!procedure) {
      return true;
    } // Create mode
    // Coordinators can upload after photos when status is NOT scheduled (preparation) AND NOT completed/stopped
    const isScheduled = procedure.status === 'preparation';
    const isClosed = procedure.status === 'completed' || procedure.status === 'stopped';
    const isCancelled = procedure.status === 'entered-in-error';
    return !isScheduled && !isClosed && !isCancelled;
  }, [procedure]);

  const canEditInjections = useCallback((): boolean => {
    if (role === 'coordinator') {
      return false;
    }
    if (!procedure) {
      return true;
    } // Create mode
    return procedure.status === 'in-progress';
  }, [procedure, role]);

  const canEditNotes = useCallback((): boolean => {
    // Both main provider and assistant can edit notes
    if (role === 'coordinator') {
      return false;
    }
    if (!procedure) {
      return true;
    } // Create mode
    return procedure.status === 'in-progress';
  }, [procedure, role]);

  const canBeginTreatment = useCallback((): boolean => {
    // Coordinator cannot begin treatment
    if (role === 'coordinator') {
      return false;
    }
    if (!procedure) {
      return false;
    }
    // Must be assigned to the treatment (main or assistant)
    if (!isAssignedProvider()) {
      return false;
    }
    return procedure.status === 'preparation';
  }, [procedure, role, isAssignedProvider]);

  const canCompleteTreatment = useCallback((): boolean => {
    // Only main provider can complete (not assistant, not coordinator)
    if (role === 'coordinator') {
      return false;
    }
    if (!procedure) {
      return false;
    }
    if (!isMainProvider()) {
      return false;
    } // Assistant cannot complete
    return procedure.status === 'in-progress';
  }, [procedure, role, isMainProvider]);

  const isReadOnly = useCallback((): boolean => {
    if (role === 'coordinator') {
      return true;
    }
    if (!procedure) {
      return false;
    } // Create mode
    return procedure.status === 'completed' || procedure.status === 'stopped';
  }, [procedure, role]);

  // Status transition handlers
  const handleStartTreatment = useCallback(async (): Promise<void> => {
    if (!procedure || !patient || !user) {
      return;
    }

    try {
      setSaving(true);
      const now = new Date().toISOString();

      // Build audit extension for status change
      const auditExtension = {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/status-change-audit',
        extension: [
          { url: 'fromStatus', valueString: 'preparation' },
          { url: 'toStatus', valueString: 'in-progress' },
          { url: 'changedBy', valueReference: { reference: getReferenceString(user) } },
          { url: 'changedAt', valueString: now },
        ],
      };

      const updated: Procedure = {
        ...procedure,
        status: 'in-progress',
        performedPeriod: {
          start: now,
        },
        extension: [...(procedure.extension || []), auditExtension],
      };

      const saved = await medplum.updateResource(updated);
      setProcedure(saved);

      showNotification({
        title: 'Treatment Started',
        message: 'Treatment is now in progress',
        color: 'blue',
      });

      // Create notification for treatment started
      const notificationData: NotificationData = {
        patient,
        procedure: saved,
        provider: user,
        serviceType: saved.code?.text || 'Treatment',
      };
      await createNotification(medplum, 'treatment-started', notificationData, user);
    } catch (err) {
      showNotification({
        title: 'Error',
        message: normalizeErrorString(err),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [procedure, patient, medplum, user]);

  const handleCompleteTreatment = useCallback(async (): Promise<void> => {
    if (!procedure || !patient || !user) {
      return;
    }

    try {
      setSaving(true);
      const now = new Date().toISOString();

      // Build audit extension for status change
      const auditExtension = {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/status-change-audit',
        extension: [
          { url: 'fromStatus', valueString: 'in-progress' },
          { url: 'toStatus', valueString: 'completed' },
          { url: 'changedBy', valueReference: { reference: getReferenceString(user) } },
          { url: 'changedAt', valueString: now },
        ],
      };

      const updated: Procedure = {
        ...procedure,
        status: 'completed',
        performedPeriod: {
          start: procedure.performedPeriod?.start || now,
          end: now,
        },
        extension: [...(procedure.extension || []), auditExtension],
      };

      const saved = await medplum.updateResource(updated);
      setProcedure(saved);

      showNotification({
        title: 'Treatment Completed',
        message: 'Treatment has been marked as complete',
        color: 'green',
      });

      // Create notification for treatment completed
      const notificationData: NotificationData = {
        patient,
        procedure: saved,
        provider: user,
        serviceType: saved.code?.text || 'Treatment',
      };
      await createNotification(medplum, 'treatment-completed', notificationData, user);
    } catch (err) {
      showNotification({
        title: 'Error',
        message: normalizeErrorString(err),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [procedure, patient, medplum, user]);

  // Save updates to existing treatment (view mode)
  const handleSaveTreatmentUpdate = useCallback(
    async (map: InjectionMap): Promise<void> => {
      if (!procedure || !patient) {
        return;
      }

      try {
        setSaving(true);
        const totalUnits = map.markers.reduce((sum, m) => sum + m.units, 0);

        const updated: Procedure = {
          ...procedure,
          code: {
            ...procedure.code,
            text: `Botox - ${map.markers.map((m) => m.zoneName).join(', ')}`,
          },
          extension: [
            ...(procedure.extension?.filter(
              (e) =>
                e.url !== 'http://melissaknudson.com/fhir/StructureDefinition/treatment-areas' &&
                e.url !== 'http://melissaknudson.com/fhir/StructureDefinition/units-used' &&
                e.url !== 'http://melissaknudson.com/fhir/StructureDefinition/product-brand' &&
                e.url !== 'http://melissaknudson.com/fhir/StructureDefinition/injection-map'
            ) || []),
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/treatment-areas',
              valueString: map.markers.map((m) => m.zoneName).join(', '),
            },
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/units-used',
              valueInteger: totalUnits,
            },
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/product-brand',
              valueString: map.markers[0]?.productBrand || 'botox_cosmetic',
            },
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/injection-map',
              extension: [
                { url: 'bodyRegion', valueString: map.bodyRegion },
                { url: 'view', valueString: map.view },
                ...(map.patientPhoto ? [{ url: 'patientPhoto', valueAttachment: map.patientPhoto }] : []),
                { url: 'createdAt', valueString: map.createdAt },
                ...map.markers.flatMap((marker) => [
                  {
                    url: 'marker',
                    extension: [
                      { url: 'id', valueString: marker.id },
                      { url: 'zoneId', valueString: marker.zoneId },
                      { url: 'zoneName', valueString: marker.zoneName },
                      { url: 'x', valueDecimal: marker.position.x },
                      { url: 'y', valueDecimal: marker.position.y },
                      { url: 'productBrand', valueString: marker.productBrand },
                      { url: 'units', valueInteger: marker.units },
                      ...(marker.notes ? [{ url: 'notes', valueString: marker.notes }] : []),
                      { url: 'isPredefinedZone', valueBoolean: marker.isPredefinedZone },
                    ],
                  },
                ]),
              ],
            },
          ],
        };

        const saved = await medplum.updateResource(updated);
        setProcedure(saved);
        setInjectionMap(map);

        showNotification({
          title: 'Treatment Updated',
          message: 'Changes saved successfully',
          color: 'green',
        });
      } catch (err) {
        showNotification({
          title: 'Error updating treatment',
          message: normalizeErrorString(err),
          color: 'red',
        });
      } finally {
        setSaving(false);
      }
    },
    [procedure, patient, medplum]
  );

  // Upload a before photo
  const handleBeforePhotoUpload = useCallback(
    async (attachment: Attachment): Promise<void> => {
      if (!procedure || !patient) {
        return;
      }

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
      if (!procedure || !patient) {
        return;
      }

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

  // Format date
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) {
      return 'Not scheduled';
    }
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get treatment areas
  const getTreatmentAreas = (proc: Procedure): string => {
    const areas = proc.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/treatment-areas'
    )?.valueString;
    return areas || 'Not specified';
  };

  // Get total units
  const getTotalUnits = (proc: Procedure): number => {
    const units = proc.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/units-used'
    )?.valueInteger;
    return units || 0;
  };

  // Must have a procedureId - treatments are only created via Calendar/appointments
  if (!procedureId) {
    return (
      <Document>
        <Stack gap="md" p="xl">
          <Title order={4}>No Treatment Selected</Title>
          <Text>Treatments must be scheduled through the Calendar.</Text>
          <Button onClick={() => (window.location.href = '/calendar')}>Go to Calendar</Button>
        </Stack>
      </Document>
    );
  }

  if (loading) {
    return <Loading />;
  }

  if (!patient) {
    return (
      <Document>
        <Text color="red">Patient not found</Text>
      </Document>
    );
  }

  // Determine current status
  const currentStatus = procedure?.status || 'preparation';
  const statusInfo = statusConfig[currentStatus] || {
    color: 'gray',
    label: 'Unknown',
    description: '',
  };

  return (
    <Document>
      <Stack gap="xl">
        {/* Header with Status and Action Buttons */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Treatment Details</Title>
            {procedure && (
              <Text size="sm" c="dimmed" mt="xs">
                {formatDate(procedure.performedDateTime || procedure.performedPeriod?.start)}
              </Text>
            )}
          </div>
          <Group>
            {procedure && (
              <Badge color={statusInfo.color} size="lg">
                {statusInfo.label}
              </Badge>
            )}
  {/* Action buttons - top right corner */}
      {procedure?.status === 'preparation' && (
        <>
          {/* NOTE: Edit Booking button removed - Phase 2 will implement multi-service booking editing
          <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => setIsEditModalOpen(true)}>
            Edit Booking
          </Button>
          */}
          <Button
            leftSection={<IconPlayerPlay size={16} />}
            onClick={canBeginTreatment() ? handleStartTreatment : undefined}
            disabled={!canBeginTreatment()}
            loading={saving}
            color="blue"
          >
            Begin Treatment
          </Button>
        </>
      )}
            {procedure?.status === 'in-progress' && (
              <Button
                leftSection={<IconCircleCheck size={16} />}
                onClick={canCompleteTreatment() ? handleCompleteTreatment : undefined}
                disabled={!canCompleteTreatment()}
                loading={saving}
                color="green"
              >
                Complete Treatment
              </Button>
            )}
          </Group>
        </Group>

        {/* Status Alert */}
        {procedure && (
          <Alert color={statusInfo.color} variant="light">
            <Group>
              <Text fw={500}>{statusInfo.label}</Text>
              <Text size="sm">{statusInfo.description}</Text>
            </Group>
          </Alert>
        )}

        {/* Treatment Info */}
        {procedure && (
          <Paper p="md" withBorder>
            <Stack gap="xs">
              <Group>
                <Text fw={500}>Patient:</Text>
                <Text>
                  {patient.name?.[0]?.given?.[0]} {patient.name?.[0]?.family}
                </Text>
              </Group>
              {getAssignedProviders().main && (
                <Group>
                  <Text fw={500}>Main Provider:</Text>
                  <Text>{getAssignedProviders().main}</Text>
                </Group>
              )}
              {getAssignedProviders().assistant && (
                <Group>
                  <Text fw={500}>Assistant:</Text>
                  <Text>{getAssignedProviders().assistant}</Text>
                </Group>
              )}
              <Group>
                <Text fw={500}>Total Units:</Text>
                <Text>{getTotalUnits(procedure)} units</Text>
              </Group>
            </Stack>
          </Paper>
        )}

        <Divider />

        {/* Treatment Map - Hidden when scheduled (preparation) */}
        {procedure?.status !== 'preparation' && (
          <TreatmentMap
            patientId={patientId}
            mode={injectionMap ? 'view' : 'create'}
            initialMap={injectionMap}
            onSave={handleSaveTreatmentUpdate}
            readOnly={!canEditInjections()}
            isSaving={saving}
          />
        )}

  {/* Photo Upload Sections */}
      <PhotoUploadSection
        beforePhotos={beforePhotos}
        afterPhotos={procedure?.status !== 'preparation' ? afterPhotos : []}
        onBeforePhotoUpload={canUploadBeforePhotos() ? handleBeforePhotoUpload : undefined}
        onAfterPhotoUpload={canUploadAfterPhotos() ? handleAfterPhotoUpload : undefined}
        onBeforePhotoRemove={canUploadBeforePhotos() ? handleBeforePhotoRemove : undefined}
        onAfterPhotoRemove={canUploadAfterPhotos() ? handleAfterPhotoRemove : undefined}
        readOnly={!canUploadBeforePhotos() && !canUploadAfterPhotos()}
        isSaving={saving}
      />

      {/* NOTE: Edit Modal removed - Phase 2 will implement unified multi-service treatment page */}
    </Stack>
  </Document>
);
}
