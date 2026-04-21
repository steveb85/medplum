// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Alert, Badge, Button, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { createReference, getReferenceString, normalizeErrorString } from '@medplum/core';
import type { Attachment, Media, Observation, Patient, Practitioner, Procedure } from '@medplum/fhirtypes';
import { Document, Loading, useMedplum } from '@medplum/react';
import { IconCamera, IconCircleCheck, IconMap, IconPlayerPlay } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { getMedSpaRole } from '../auth/role';
import type { InjectionMap } from '../treatment-map';
import { TreatmentMap } from '../treatment-map';
import { PhotoUploadSection } from './PhotoUploadSection';

// NOTIFICATION_OPPORTUNITY: When provider starts treatment,
// notify coordinator that treatment is in progress
// Location: After status transition to 'in-progress'

// NOTIFICATION_OPPORTUNITY: When provider completes treatment,
// notify coordinator for follow-up scheduling
// Location: After status transition to 'completed'

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

  // Mode: 'create' for new treatment, 'view' for existing
  const mode = procedureId ? 'view' : 'create';

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Patient data
  const [patient, setPatient] = useState<Patient | undefined>();

  // Procedure data (for existing treatments)
  const [procedure, setProcedure] = useState<Procedure | undefined>();
  const [injectionMap, setInjectionMap] = useState<InjectionMap | undefined>();
  const [beforePhotos, setBeforePhotos] = useState<Attachment[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<Attachment[]>([]);

  // New treatment state
  const [newInjectionMap, setNewInjectionMap] = useState<InjectionMap | undefined>();
  const [newBeforePhotos, setNewBeforePhotos] = useState<Attachment[]>([]);
  const [newAfterPhotos, setNewAfterPhotos] = useState<Attachment[]>([]);

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

  // Load existing procedure
  useEffect(() => {
    if (!procedureId || !patient) return;

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

        // Load before/after photos
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

          if (relatedProcedure === getReferenceString(p)) {
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
  }, [procedureId, patient, medplum]);

  // Set loading false for create mode
  useEffect(() => {
    if (!procedureId) {
      setLoading(false);
    }
  }, [procedureId]);

  // Permission helpers
    // Check if current user is the main provider (not assistant)
  const isMainProvider = useCallback((): boolean => {
    if (!procedure || !user) return false;
    const performers = procedure.performer || [];
    // Main provider is the first performer in the list
    const mainProviderRef = performers[0]?.actor?.reference;
    const userRef = getReferenceString(user);
    return mainProviderRef === userRef;
  }, [procedure, user]);

  const canUploadBeforePhotos = useCallback((): boolean => {
    if (!procedure) return true; // Create mode
    return procedure.status === 'preparation' || procedure.status === 'in-progress';
  }, [procedure]);

  const canUploadAfterPhotos = useCallback((): boolean => {
    if (!procedure) return true; // Create mode
    return procedure.status === 'in-progress';
  }, [procedure]);

  const canEditInjections = useCallback((): boolean => {
    if (role === 'coordinator') return false;
    if (!procedure) return true; // Create mode
    return procedure.status === 'in-progress';
  }, [procedure, role]);

  const canEditNotes = useCallback((): boolean => {
    // Both main provider and assistant can edit notes
    if (role === 'coordinator') return false;
    if (!procedure) return true; // Create mode
    return procedure.status === 'in-progress';
  }, [procedure, role]);

  const canTransitionStatus = useCallback(
    (fromStatus: string): boolean => {
      // Only main provider can transition status (not assistant)
      if (role === 'coordinator') return false;
      if (!procedure) return false;
      if (!isMainProvider()) return false; // Assistant cannot transition status
      return procedure.status === fromStatus;
    },
    [procedure, role, isMainProvider]
  );

  const canCompleteTreatment = useCallback((): boolean => {
    // Only main provider can complete (not assistant)
    if (role === 'coordinator') return false;
    if (!procedure) return false;
    if (!isMainProvider()) return false; // Assistant cannot complete
    return procedure.status === 'in-progress';
  }, [procedure, role, isMainProvider]);

  const isReadOnly = useCallback((): boolean => {
    if (role === 'coordinator') return true;
    if (!procedure) return false; // Create mode
    return procedure.status === 'completed' || procedure.status === 'stopped';
  }, [procedure, role]);

  // Status transition handlers
  const handleStartTreatment = useCallback(async (): Promise<void> => {
    if (!procedure || !patient) return;

    try {
      setSaving(true);
      const now = new Date().toISOString();

      const updated: Procedure = {
        ...procedure,
        status: 'in-progress',
        performedPeriod: {
          start: now,
        },
      };

      const saved = await medplum.updateResource(updated);
      setProcedure(saved);

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
  }, [procedure, patient, medplum]);

  const handleCompleteTreatment = useCallback(async (): Promise<void> => {
    if (!procedure || !patient) return;

    try {
      setSaving(true);
      const now = new Date().toISOString();

      const updated: Procedure = {
        ...procedure,
        status: 'completed',
        performedPeriod: {
          start: procedure.performedPeriod?.start || now,
          end: now,
        },
      };

      const saved = await medplum.updateResource(updated);
      setProcedure(saved);

      showNotification({
        title: 'Treatment Completed',
        message: 'Treatment has been marked as complete',
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
  }, [procedure, patient, medplum]);

  // Save new treatment (create mode)
  const handleSaveNewTreatment = useCallback(
    async (map: InjectionMap): Promise<void> => {
      if (!patient) return;

      try {
        setSaving(true);
        const now = new Date().toISOString();
        const patientRef = createReference(patient);
        const totalUnits = map.markers.reduce((sum, m) => sum + m.units, 0);

        // Create Procedure
        const procedure: Procedure = {
          resourceType: 'Procedure',
          status: 'completed', // New treatments created directly are completed
          code: {
            coding: [
              {
                system: 'http://melissaknudson.com/treatments',
                code: 'botox-cosmetic',
                display: 'Botox Cosmetic Treatment',
              },
            ],
            text: `Botox - ${map.markers.map((m) => m.zoneName).join(', ')}`,
          },
          subject: patientRef,
          performedDateTime: now,
          performedPeriod: {
            start: now,
            end: now,
          },
          extension: [
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
                { url: 'patientPhoto', valueAttachment: map.patientPhoto },
                { url: 'createdAt', valueString: map.createdAt },
                ...map.markers.map((marker) => ({
                  url: 'marker',
                  extension: [
                    { url: 'id', valueString: marker.id },
                    { url: 'zoneId', valueString: marker.zoneId },
                    { url: 'zoneName', valueString: marker.zoneName },
                    { url: 'x', valueDecimal: marker.position.x },
                    { url: 'y', valueDecimal: marker.position.y },
                    { url: 'productBrand', valueString: marker.productBrand },
                    { url: 'units', valueInteger: marker.units },
                    { url: 'notes', valueString: marker.notes },
                    { url: 'isPredefinedZone', valueBoolean: marker.isPredefinedZone },
                  ],
                })),
              ],
            },
          ],
        };

        const savedProcedure = await medplum.createResource(procedure);

        // Create Observation for units
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {
            coding: [
              {
                system: 'http://melissaknudson.com/observations',
                code: 'botox-units',
                display: 'Botox Units Used',
              },
            ],
            text: 'Botox Units Used',
          },
          subject: patientRef,
          effectiveDateTime: now,
          valueQuantity: {
            value: totalUnits,
            unit: 'units',
            system: 'http://unitsofmeasure.org',
            code: 'U',
          },
          partOf: [createReference(savedProcedure)],
        };

        await medplum.createResource(observation);

        // Create Media for photos
        for (const attachment of newBeforePhotos) {
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
            issued: now,
            content: attachment,
            extension: [
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure',
                valueReference: createReference(savedProcedure),
              },
            ],
          };
          await medplum.createResource(media);
        }

        for (const attachment of newAfterPhotos) {
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
            issued: now,
            content: attachment,
            extension: [
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure',
                valueReference: createReference(savedProcedure),
              },
            ],
          };
          await medplum.createResource(media);
        }

        showNotification({
          title: 'Treatment Saved',
          message: 'Treatment documented successfully',
          color: 'green',
        });

        // Navigate to view mode
        window.location.href = `/Patient/${patientId}/botox-treatment?procedureId=${savedProcedure.id}`;
      } catch (err) {
        showNotification({
          title: 'Error saving treatment',
          message: normalizeErrorString(err),
          color: 'red',
        });
      } finally {
        setSaving(false);
      }
    },
    [patient, newBeforePhotos, newAfterPhotos, patientId, medplum]
  );

  // Save updates to existing treatment (view mode)
  const handleSaveTreatmentUpdate = useCallback(
    async (map: InjectionMap): Promise<void> => {
      if (!procedure || !patient) return;

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
                { url: 'patientPhoto', valueAttachment: map.patientPhoto },
                { url: 'createdAt', valueString: map.createdAt },
                ...map.markers.map((marker) => ({
                  url: 'marker',
                  extension: [
                    { url: 'id', valueString: marker.id },
                    { url: 'zoneId', valueString: marker.zoneId },
                    { url: 'zoneName', valueString: marker.zoneName },
                    { url: 'x', valueDecimal: marker.position.x },
                    { url: 'y', valueDecimal: marker.position.y },
                    { url: 'productBrand', valueString: marker.productBrand },
                    { url: 'units', valueInteger: marker.units },
                    { url: 'notes', valueString: marker.notes },
                    { url: 'isPredefinedZone', valueBoolean: marker.isPredefinedZone },
                  ],
                })),
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

  // Save photo updates
  const handleSavePhotos = useCallback(
    async (before: Attachment[], after: Attachment[]): Promise<void> => {
      if (!procedure || !patient) return;

      try {
        setSaving(true);
        const patientRef = createReference(patient);
        const now = new Date().toISOString();
        const procedureRef = createReference(procedure);

        // Create new before photos
        const existingBeforeCount = beforePhotos.length;
        for (let i = existingBeforeCount; i < before.length; i++) {
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
            issued: now,
            content: before[i],
            extension: [
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure',
                valueReference: procedureRef,
              },
            ],
          };
          await medplum.createResource(media);
        }

        // Create new after photos
        const existingAfterCount = afterPhotos.length;
        for (let i = existingAfterCount; i < after.length; i++) {
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
            issued: now,
            content: after[i],
            extension: [
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure',
                valueReference: procedureRef,
              },
            ],
          };
          await medplum.createResource(media);
        }

        setBeforePhotos(before);
        setAfterPhotos(after);

        showNotification({
          title: 'Photos Updated',
          message: 'Photos saved successfully',
          color: 'green',
        });
      } catch (err) {
        showNotification({
          title: 'Error saving photos',
          message: normalizeErrorString(err),
          color: 'red',
        });
      } finally {
        setSaving(false);
      }
    },
    [procedure, patient, beforePhotos.length, afterPhotos.length, medplum]
  );

  // Format date
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Not scheduled';
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
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>{mode === 'create' ? 'New Treatment' : 'Treatment Details'}</Title>
            {mode === 'view' && procedure && (
              <Text size="sm" c="dimmed" mt="xs">
                {formatDate(procedure.performedDateTime || procedure.performedPeriod?.start)}
              </Text>
            )}
          </div>
          <Group>
            {mode === 'view' && procedure && (
              <Badge color={statusInfo.color} size="lg">
                {statusInfo.label}
              </Badge>
            )}
          </Group>
        </Group>

        {/* Status Alert */}
        {mode === 'view' && procedure && (
          <Alert color={statusInfo.color} variant="light">
            <Group>
              <Text fw={500}>{statusInfo.label}</Text>
              <Text size="sm">{statusInfo.description}</Text>
            </Group>
          </Alert>
        )}

        {/* Treatment Info */}
        {mode === 'view' && procedure && (
          <Paper p="md" withBorder>
            <Stack gap="xs">
              <Group>
                <Text fw={500}>Patient:</Text>
                <Text>
                  {patient.name?.[0]?.given?.[0]} {patient.name?.[0]?.family}
                </Text>
              </Group>
              <Group>
                <Text fw={500}>Areas:</Text>
                <Text>{getTreatmentAreas(procedure)}</Text>
              </Group>
              <Group>
                <Text fw={500}>Total Units:</Text>
                <Text>{getTotalUnits(procedure)} units</Text>
              </Group>
            </Stack>
          </Paper>
        )}

        <Divider />

        {/* Status Transition Buttons */}
        {mode === 'view' && procedure && (
          <Group justify="space-between">
            <div>
              {canTransitionStatus('preparation') && (
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={handleStartTreatment}
                  loading={saving}
                  color="blue"
                >
                  Start Treatment
                </Button>
              )}
              {canTransitionStatus('in-progress') && (
                <Button
                  leftSection={<IconCircleCheck size={16} />}
                  onClick={handleCompleteTreatment}
                  loading={saving}
                  color="green"
                >
                  Complete Treatment
                </Button>
              )}
            </div>
            <Text size="sm" c="dimmed">
              {role === 'coordinator' && 'View only - contact provider to make changes'}
              {role === 'provider' && procedure?.status === 'completed' && 'Treatment complete - read only'}
            </Text>
          </Group>
        )}

        {/* Treatment Map */}
        {mode === 'create' ? (
          <TreatmentMap patientId={patientId} mode="create" onSave={handleSaveNewTreatment} isSaving={saving} />
        ) : (
          injectionMap && (
            <TreatmentMap
              patientId={patientId}
              mode="view"
              initialMap={injectionMap}
              onSave={handleSaveTreatmentUpdate}
              readOnly={!canEditInjections()}
              isSaving={saving}
            />
          )
        )}

        {/* Photo Upload Sections */}
        {mode === 'create' ? (
          <>
            <PhotoUploadSection
              title="Before Photos"
              photos={newBeforePhotos}
              onPhotosChange={setNewBeforePhotos}
              icon={<IconCamera size={20} />}
            />
            <PhotoUploadSection
              title="After Photos"
              photos={newAfterPhotos}
              onPhotosChange={setNewAfterPhotos}
              icon={<IconCamera size={20} />}
            />
          </>
        ) : (
          <>
            <PhotoUploadSection
              title="Before Photos"
              photos={beforePhotos}
              onPhotosChange={(photos) => {
                if (canUploadBeforePhotos()) {
                  handleSavePhotos(photos, afterPhotos);
                }
              }}
              readOnly={!canUploadBeforePhotos()}
              icon={<IconCamera size={20} />}
            />
            <PhotoUploadSection
              title="After Photos"
              photos={afterPhotos}
              onPhotosChange={(photos) => {
                if (canUploadAfterPhotos()) {
                  handleSavePhotos(beforePhotos, photos);
                }
              }}
              readOnly={!canUploadAfterPhotos()}
              icon={<IconCamera size={20} />}
            />
          </>
        )}

        {/* Empty state for create mode */}
        {mode === 'create' && (
          <Paper p="xl" withBorder>
            <Stack align="center" gap="md">
              <IconMap size={48} color="gray" />
              <Text size="lg" fw={500} c="dimmed">
                New Treatment
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Use the treatment map above to mark injection points.
                <br />
                Upload before and after photos.
                <br />
                Then save to complete the treatment documentation.
              </Text>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Document>
  );
}
