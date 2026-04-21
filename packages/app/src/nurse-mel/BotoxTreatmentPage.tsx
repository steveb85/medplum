// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Box, Button, Group, Paper, Stack, Text, Title, Badge, Tabs, Accordion } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { createReference, getReferenceString, normalizeErrorString } from '@medplum/core';
import type { Attachment, Media, Observation, Patient, Procedure, Practitioner } from '@medplum/fhirtypes';
import { Document, Loading, useMedplum } from '@medplum/react';
import {
  IconCheck,
  IconCircleCheck,
  IconCirclePlus,
  IconPhoto,
  IconX,
  IconMap,
  IconHistory,
  IconCamera,
} from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { PhotoUploadSection } from './PhotoUploadSection';
import { TreatmentMap } from '../treatment-map';
import type { InjectionMap } from '../treatment-map';
import { getMedSpaRole } from '../auth/role';

interface TreatmentRecord {
  procedure: Procedure;
  observation?: Observation;
  beforePhotos: Media[];
  afterPhotos: Media[];
  injectionMap?: InjectionMap;
}

export function BotoxTreatmentPage(): JSX.Element {
  const { id } = useParams() as { id: string };
  const medplum = useMedplum();
  const role = getMedSpaRole(medplum);
  const isReadOnly = role === 'coordinator';

  const [patient, setPatient] = useState<Patient | undefined>();
  const [patientLoading, setPatientLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewTreatment, setShowNewTreatment] = useState(false);
  const [treatmentHistory, setTreatmentHistory] = useState<TreatmentRecord[]>([]);
  const [nurseMel, setNurseMel] = useState<Practitioner | null>(null);
  const [activeTab, setActiveTab] = useState<string>('new');
  console.log(isLoading)
  // New treatment state
  const [beforePhotos, setBeforePhotos] = useState<Attachment[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<Attachment[]>([]);

  // Parse FHIR extension to InjectionMap - declared before use
  const parseInjectionMapExtension = useCallback((extension: any): InjectionMap | undefined => {
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
  }, []);

  // Load patient
  useEffect(() => {
    const loadPatient = async (): Promise<void> => {
      try {
        setPatientLoading(true);
        const p = await medplum.readResource('Patient', id);
        setPatient(p);
      } catch (err) {
        showNotification({
          title: 'Error loading patient',
          message: normalizeErrorString(err),
          color: 'red',
          icon: <IconX size="1rem" />,
        });
      } finally {
        setPatientLoading(false);
      }
    };

    loadPatient().catch(console.error);
  }, [id, medplum]);

  // Load treatment history
  useEffect(() => {
    const loadHistory = async (): Promise<void> => {
      if (!patient) {
        return;
      }

      try {
        setIsLoading(true);
        const patientRef = getReferenceString(patient);

        // Find Nurse Mel practitioner
        const practitioners = await medplum.search('Practitioner', {
          'name:contains': 'Knudson',
        });
        const mel = practitioners.entry?.[0]?.resource as Practitioner | undefined;
        setNurseMel(mel || null);

        // Load procedures
        const proceduresBundle = await medplum.search('Procedure', {
          subject: patientRef,
          code: 'http://melissaknudson.com/treatments|botox-cosmetic',
          _sort: '-date',
          _count: '50',
        });

        const records: TreatmentRecord[] = [];

        for (const entry of proceduresBundle.entry || []) {
          const procedure = entry.resource as Procedure;

          // Load observations for units
          const observations = await medplum.search('Observation', {
            'part-of': getReferenceString(procedure),
          });
          const observation = observations.entry?.[0]?.resource as Observation | undefined;

          // Load before/after photos
          const mediaBundle = await medplum.search('Media', {
            subject: patientRef,
            _count: '100',
          });

          const beforePics: Media[] = [];
          const afterPics: Media[] = [];

          for (const mediaEntry of mediaBundle.entry || []) {
            const media = mediaEntry.resource as Media;
            const relatedProcedure = media.extension?.find(
              (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure'
            )?.valueReference?.reference;

            if (relatedProcedure === getReferenceString(procedure)) {
              if (media.type?.coding?.[0]?.code === 'before') {
                beforePics.push(media);
              } else if (media.type?.coding?.[0]?.code === 'after') {
                afterPics.push(media);
              }
            }
          }

          // Parse injection map from extension
          const injectionMapExtension = procedure.extension?.find(
            (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/injection-map'
          );
          const injectionMap = injectionMapExtension
            ? parseInjectionMapExtension(injectionMapExtension)
            : undefined;

          records.push({
            procedure,
            observation,
            beforePhotos: beforePics,
            afterPhotos: afterPics,
            injectionMap,
          });
        }

        setTreatmentHistory(records);
      } catch (err) {
        console.error('Error loading treatment history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory().catch(console.error);
  }, [medplum, patient, parseInjectionMapExtension]);

  // Handle saving new treatment
  const handleSaveTreatment = useCallback(
    async (injectionMap: InjectionMap): Promise<void> => {
      if (!patient) {
        return;
      }

      setIsSaving(true);

      try {
        const patientRef = createReference(patient);
        const now = new Date().toISOString();

        // Calculate total units
        const totalUnits = injectionMap.markers.reduce((sum, m) => sum + m.units, 0);

        // Create Procedure for the treatment
        const procedure: Procedure = {
          resourceType: 'Procedure',
          status: 'completed',
          code: {
            coding: [
              {
                system: 'http://melissaknudson.com/treatments',
                code: 'botox-cosmetic',
                display: 'Botox Cosmetic Treatment',
              },
            ],
            text: `Botox - ${injectionMap.markers.map((m) => m.zoneName).join(', ')}`,
          },
          subject: patientRef,
          performedDateTime: now,
          performer: nurseMel
            ? [
                {
                  actor: createReference(nurseMel),
                },
              ]
            : undefined,
          extension: [
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/treatment-areas',
              valueString: injectionMap.markers.map((m) => m.zoneName).join(', '),
            },
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/units-used',
              valueInteger: totalUnits,
            },
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/product-brand',
              valueString: injectionMap.markers[0]?.productBrand || 'botox_cosmetic',
            },
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/injection-map',
              extension: [
                { url: 'bodyRegion', valueString: injectionMap.bodyRegion },
                { url: 'view', valueString: injectionMap.view },
                { url: 'patientPhoto', valueAttachment: injectionMap.patientPhoto },
                { url: 'createdAt', valueString: injectionMap.createdAt },
                ...injectionMap.markers.map((marker) => ({
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

        // Create Observation for units tracking
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

        // Create Media resources for before photos
        for (const attachment of beforePhotos) {
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
            operator: nurseMel ? createReference(nurseMel) : undefined,
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

        // Create Media resources for after photos
        for (const attachment of afterPhotos) {
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
            operator: nurseMel ? createReference(nurseMel) : undefined,
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
          title: 'Treatment documented',
          message: `Successfully documented Botox treatment for ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`,
          color: 'green',
          icon: <IconCheck size="1rem" />,
        });

        // Reset form and refresh history
        setBeforePhotos([]);
        setAfterPhotos([]);
        setShowNewTreatment(false);

        // Refresh history
        window.location.reload();
      } catch (err) {
        showNotification({
          title: 'Error saving treatment',
          message: normalizeErrorString(err),
          color: 'red',
          icon: <IconX size="1rem" />,
        });
      } finally {
        setIsSaving(false);
      }
    },
    [patient, beforePhotos, afterPhotos, medplum, nurseMel]
  );

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) {
      return 'Unknown date';
    }
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getTreatmentAreas = (procedure: Procedure): string => {
    const areas = procedure.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/treatment-areas'
    )?.valueString;
    return areas || 'Unknown areas';
  };

  const getUnits = (procedure: Procedure): number => {
    const units = procedure.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/units-used'
    )?.valueInteger;
    return units || 0;
  };

  const getProduct = (procedure: Procedure): string => {
    const product = procedure.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/product-brand'
    )?.valueString;
    return product || 'Unknown product';
  };

  if (patientLoading) {
    return <Loading />;
  }

  if (!patient) {
    return (
      <Document>
        <Text color="red">Patient not found</Text>
      </Document>
    );
  }

  return (
    <Document>
      <Stack gap="xl">
        {/* Header with New Treatment Button */}
        <Group justify="space-between" align="center">
          <div>
            <Title order={4}>Botox Treatments</Title>
            <Text size="sm" c="dimmed">
              {treatmentHistory.length} treatment{treatmentHistory.length !== 1 ? 's' : ''} on record
            </Text>
          </div>
          {!isReadOnly && (
            <Button
              leftSection={<IconCirclePlus size={20} />}
              onClick={() => setShowNewTreatment(!showNewTreatment)}
              variant={showNewTreatment ? 'light' : 'filled'}
            >
              {showNewTreatment ? 'Cancel' : 'New Treatment'}
            </Button>
          )}
        </Group>

        {/* New Treatment Form */}
        {showNewTreatment && !isReadOnly && (
          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'new')}>
              <Tabs.List>
                <Tabs.Tab value="new" leftSection={<IconMap size={16} />}>
                  Treatment Map
                </Tabs.Tab>
                <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
                  History
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="new" pt="md">
                <Stack gap="md">
                  <TreatmentMap
                    patientId={id}
                    mode="create"
                    onSave={handleSaveTreatment}
                    isSaving={isSaving}
                  />

                  <PhotoUploadSection
                    title="Before Photos"
                    photos={beforePhotos}
                    onPhotosChange={setBeforePhotos}
                    icon={<IconCamera size={20} />}
                  />

                  <PhotoUploadSection
                    title="After Photos"
                    photos={afterPhotos}
                    onPhotosChange={setAfterPhotos}
                    icon={<IconCamera size={20} />}
                  />
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="history" pt="md">
                <Text>No treatment history yet.</Text>
              </Tabs.Panel>
            </Tabs>
          </Paper>
        )}

        {/* Treatment History Timeline */}
        {treatmentHistory.length > 0 ? (
          <Accordion multiple defaultValue={treatmentHistory.map((_, i) => String(i))}>
            {treatmentHistory.map((record, index) => (
              <Accordion.Item key={record.procedure.id} value={String(index)}>
                <Accordion.Control>
                  <Group gap="xs">
                    <IconCircleCheck size={16} color="green" />
                    <Text fw={500}>{formatDate(record.procedure.performedDateTime)}</Text>
                    <Badge size="sm" color="green">
                      {getUnits(record.procedure)} units
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Paper p="sm" radius="sm" withBorder>
                    <Stack gap="xs">
                      <Group>
                        <Text size="sm">
                          <strong>Areas:</strong> {getTreatmentAreas(record.procedure)}
                        </Text>
                      </Group>
                      <Text size="sm">
                        <strong>Product:</strong> {getProduct(record.procedure)}
                      </Text>
                      {record.procedure.note && record.procedure.note.length > 0 && (
                        <Text size="sm" c="dimmed" fs="italic">
                          &ldquo;{record.procedure.note[0].text}&rdquo;
                        </Text>
                      )}

                      {/* Photo thumbnails */}
                      {(record.beforePhotos.length > 0 || record.afterPhotos.length > 0) && (
                        <Group gap="xs" mt="xs">
                          {record.beforePhotos.length > 0 && (
                            <Badge size="sm" color="gray" variant="light">
                              {record.beforePhotos.length} before photo
                              {record.beforePhotos.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          {record.afterPhotos.length > 0 && (
                            <Badge size="sm" color="green" variant="light">
                              {record.afterPhotos.length} after photo
                              {record.afterPhotos.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </Group>
                      )}

                      {/* Show injection map if available */}
                      {record.injectionMap && (
                        <Box mt="md">
                          <Text size="sm" fw={500} mb="xs">
                            Injection Map
                          </Text>
                          <TreatmentMap
                            patientId={id}
                            mode="view"
                            initialMap={record.injectionMap}
                            readOnly
                          />
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        ) : (
          <Paper p="xl" radius="md" withBorder>
            <Stack align="center" gap="md">
              <IconPhoto size={48} color="gray" />
              <Text size="lg" fw={500} c="dimmed">
                No treatments yet
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                This patient hasn&apos;t had any Botox treatments documented yet.
                {!isReadOnly && (
                  <>
                    <br />
                    Click &ldquo;New Treatment&rdquo; to add their first treatment.
                  </>
                )}
              </Text>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Document>
  );
}
