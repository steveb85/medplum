// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Badge, Button, Divider, Group, Paper, Select, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';

import { showNotification } from '@mantine/notifications';
import { normalizeErrorString } from '@medplum/core';
import { Document, Loading, useMedplum } from '@medplum/react';
import type { Appointment, Procedure } from '@medplum/fhirtypes';
import { IconEdit } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { TreatmentStatusAlert } from './shared/TreatmentStatusAlert';
import { TreatmentHeader } from './shared/TreatmentHeader';
import { useTreatmentData } from './shared/useTreatmentData';
import { PatientReferencePanel } from './shared/PatientReferencePanel';
import { SOAPNoteSection, DEFAULT_SOAP_NOTE } from './shared/SOAPNoteSection';
import type { SOAPNoteData } from './shared/SOAPNoteSection';
import { ProcedureNoteSection, DEFAULT_PROCEDURE_NOTE } from './shared/ProcedureNoteSection';
import type { ProcedureNoteData } from './shared/ProcedureNoteSection';
import { loadProviderOptions } from './shared/loadProviders';
import type { ProviderOption } from './shared/loadProviders';
import { PhotoUploadSection } from '../nurse-mel/PhotoUploadSection';
import { EXTENSION_URLS } from '../utils/fhir-extensions';
// NOTE: CreateAppointmentModal removed - Phase 2 will implement multi-service booking

// Filler areas
const FILLER_AREAS = [
  'Cheeks',
  'Lips',
  'Nasolabial Folds',
  'Marionette Lines',
  'Chin',
  'Jawline',
  'Tear Troughs',
  'Temples',
];

// Filler products
const FILLER_PRODUCTS = [
  'Juvederm Ultra',
  'Juvederm Ultra Plus',
  'Juvederm Voluma',
  'Juvederm Volbella',
  'Juvederm Vollure',
  'Restylane Lyft',
  'Restylane Defyne',
  'Restylane Refyne',
  'Restylane Silk',
  'Restylane Kysse',
  'Radiesse',
  'Sculptra',
  'Belotero Balance',
];

interface FillerEntry {
  id: string;
  area: string;
  product: string;
  volume: number;
  notes: string;
}

export function FillerTreatmentPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const procedureId = searchParams.get('procedureId');
  const medplum = useMedplum();

  const {
    patient,
    procedure,
    beforePhotos,
    afterPhotos,
    loading,
    saving,
    user,
    patientId,
    setProcedure,
    handleBeginTreatment,
    handleCompleteTreatment,
    handleBeforePhotoUpload,
    handleAfterPhotoUpload,
    handleBeforePhotoRemove,
    handleAfterPhotoRemove,
    canBeginTreatment,
    canCompleteTreatment,
    canEdit,
    canUploadBeforePhotos,
    canUploadAfterPhotos,
  } = useTreatmentData();

  // Local state for filler entries
  const [fillers, setFillers] = useState<FillerEntry[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [appointment, setAppointment] = useState<Appointment | undefined>();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [soapNote, setSoapNote] = useState<SOAPNoteData>(DEFAULT_SOAP_NOTE);
  const [procedureNote, setProcedureNote] = useState<ProcedureNoteData>(DEFAULT_PROCEDURE_NOTE);
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);

  // Load existing data from procedure
  useEffect(() => {
    if (procedure) {
      // Parse filler data from extensions if available
      const fillerExt = procedure.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/filler-entries'
      );
      if (fillerExt?.valueString) {
        try {
          const parsed = JSON.parse(fillerExt.valueString);
          setFillers(parsed);
        } catch {
          setFillers([]);
        }
      }

      // Load general notes
      const notesExt = procedure.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/treatment-notes'
      );
      if (notesExt?.valueString) {
        setGeneralNotes(notesExt.valueString);
      }

      // Load linked appointment
      const linkedAppointmentRef = procedure.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment'
      )?.valueReference?.reference;
      if (linkedAppointmentRef?.startsWith('Appointment/')) {
        const appointmentId = linkedAppointmentRef.split('/')[1];
        medplum.readResource('Appointment', appointmentId)
          .then((apt) => setAppointment(apt))
          .catch((err) => console.error('Error loading appointment:', err));
      }

      // Load SOAP note
      const soapExt = procedure.extension?.find(
        (e) => e.url === EXTENSION_URLS.procedure.soapNote
      );
      if (soapExt?.valueString) {
        try { setSoapNote(JSON.parse(soapExt.valueString)); } catch { setSoapNote(DEFAULT_SOAP_NOTE); }
      }

      // Load procedure note
      const procNoteExt = procedure.extension?.find(
        (e) => e.url === EXTENSION_URLS.procedure.procedureNote
      );
      if (procNoteExt?.valueString) {
        try { setProcedureNote(JSON.parse(procNoteExt.valueString)); } catch { setProcedureNote(DEFAULT_PROCEDURE_NOTE); }
      }
    }
  }, [procedure, medplum]);

  // Load practitioners for provider selects
  useEffect(() => {
    loadProviderOptions(medplum).then(setProviderOptions).catch(console.error);
  }, [medplum]);

  const handleAddFiller = useCallback((): void => {
    const newEntry: FillerEntry = {
      id: `filler-${Date.now()}`,
      area: '',
      product: '',
      volume: 0.5,
      notes: '',
    };
    setFillers((prev) => [...prev, newEntry]);
  }, []);

  const handleUpdateFiller = useCallback((id: string, updates: Partial<FillerEntry>): void => {
    setFillers((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const handleRemoveFiller = useCallback((id: string): void => {
    setFillers((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!procedure) return;

    try {
      const updated: Procedure = {
        ...procedure,
        extension: [
          ...(procedure.extension?.filter(
            (e) =>
              e.url !== EXTENSION_URLS.procedure.fillerEntries &&
              e.url !== EXTENSION_URLS.procedure.treatmentNotes &&
              e.url !== EXTENSION_URLS.procedure.soapNote &&
              e.url !== EXTENSION_URLS.procedure.procedureNote
          ) || []),
          {
            url: EXTENSION_URLS.procedure.fillerEntries,
            valueString: JSON.stringify(fillers),
          },
          {
            url: EXTENSION_URLS.procedure.treatmentNotes,
            valueString: generalNotes,
          },
          {
            url: EXTENSION_URLS.procedure.soapNote,
            valueString: JSON.stringify(soapNote),
          },
          {
            url: EXTENSION_URLS.procedure.procedureNote,
            valueString: JSON.stringify(procedureNote),
          },
        ],
      };

      const saved = await medplum.updateResource(updated);
      setProcedure(saved);

      showNotification({
        title: 'Saved',
        message: 'Filler treatment details saved',
        color: 'green',
      });
    } catch (err) {
      showNotification({
        title: 'Error',
        message: normalizeErrorString(err),
        color: 'red',
      });
    }
  }, [procedure, fillers, generalNotes, soapNote, procedureNote, medplum]);

  // Must have a procedureId
  if (!procedureId) {
    return (
      <Document>
        <Stack gap="md" p="xl">
          <Title order={4}>No Treatment Selected</Title>
          <Text>Treatments must be scheduled through the Calendar.</Text>
          <Button onClick={() => window.location.href = '/calendar'}>
            Go to Calendar
          </Button>
        </Stack>
      </Document>
    );
  }

  // Loading state
  if (loading || !procedure) {
    return (
      <Document>
        <Loading />
      </Document>
    );
  }

  const totalVolume = fillers.reduce((sum, f) => sum + (f.volume || 0), 0);

  return (
    <Document>
      <Stack gap="md" p="md">
        <Group justify="space-between" align="flex-start">
          <Title order={3}>Filler Treatment</Title>
          <Group>
            {procedure?.status === 'preparation' && (
              <Button
                variant="light"
                leftSection={<IconEdit size={16} />}
                onClick={() => setIsEditModalOpen(true)}
              >
                Edit Booking
              </Button>
            )}
          </Group>
        </Group>

        <TreatmentHeader
          procedure={procedure}
          patient={patient}
          user={user}
          onBeginTreatment={handleBeginTreatment}
          onCompleteTreatment={handleCompleteTreatment}
          canBeginTreatment={canBeginTreatment()}
          canCompleteTreatment={canCompleteTreatment()}
          saving={saving}
        />

        <TreatmentStatusAlert status={procedure.status || 'preparation'} />

        <Divider />

        {/* Filler Entries */}
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500}>Filler Injections</Text>
              {canEdit() && (
                <Button onClick={handleAddFiller} size="sm">
                  Add Filler Area
                </Button>
              )}
            </Group>

            {fillers.length === 0 ? (
              <Text c="dimmed">No filler areas added yet</Text>
            ) : (
              <Stack gap="md">
                {fillers.map((filler) => (
                  <Paper key={filler.id} p="sm" withBorder>
                    <Stack gap="xs">
                      <Group grow>
                        <Select
                          label="Area"
                          placeholder="Select area"
                          data={FILLER_AREAS}
                          value={filler.area}
                          onChange={(v) => handleUpdateFiller(filler.id, { area: v || '' })}
                          disabled={!canEdit()}
                        />
                        <Select
                          label="Product"
                          placeholder="Select product"
                          data={FILLER_PRODUCTS}
                          value={filler.product}
                          onChange={(v) => handleUpdateFiller(filler.id, { product: v || '' })}
                          disabled={!canEdit()}
                        />
                        <TextInput
                          label="Volume (ml)"
                          type="number"
                          step={0.1}
                          value={filler.volume}
                          onChange={(e) => handleUpdateFiller(filler.id, { volume: parseFloat(e.target.value) || 0 })}
                          disabled={!canEdit()}
                        />
                      </Group>
                      <Textarea
                        label="Notes"
                        placeholder="Injection technique, depth, etc."
                        value={filler.notes}
                        onChange={(e) => handleUpdateFiller(filler.id, { notes: e.target.value })}
                        disabled={!canEdit()}
                      />
                      {canEdit() && (
                        <Group justify="flex-end">
                          <Button 
                            variant="light" 
                            color="red" 
                            size="xs"
                            onClick={() => handleRemoveFiller(filler.id)}
                          >
                            Remove
                          </Button>
                        </Group>
                      )}
                    </Stack>
                  </Paper>
                ))}

                <Group>
                  <Text fw={500}>Total Volume:</Text>
                  <Badge size="lg">{totalVolume.toFixed(1)} ml</Badge>
                </Group>
              </Stack>
            )}

            <Textarea
              label="Treatment Notes"
              placeholder="General notes about the treatment..."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              disabled={!canEdit()}
            />

          </Stack>
        </Paper>

        <Divider />

        <PatientReferencePanel patientId={patientId} />

        <Divider />

        <SOAPNoteSection value={soapNote} onChange={setSoapNote} readonly={!canEdit()} />

        <Divider />

        <ProcedureNoteSection value={procedureNote} onChange={setProcedureNote} readonly={!canEdit()} supervisingProviderOptions={providerOptions} />

        <Divider />

        {canEdit() && (
          <Group justify="flex-end">
            <Button onClick={handleSave} loading={saving} size="md">
              Save All Changes
            </Button>
          </Group>
        )}

        <Divider />

    <PhotoUploadSection
      beforePhotos={beforePhotos}
      afterPhotos={afterPhotos}
      onBeforePhotoUpload={canUploadBeforePhotos() ? handleBeforePhotoUpload : undefined}
      onAfterPhotoUpload={canUploadAfterPhotos() ? handleAfterPhotoUpload : undefined}
      onBeforePhotoRemove={canUploadBeforePhotos() ? handleBeforePhotoRemove : undefined}
      onAfterPhotoRemove={canUploadAfterPhotos() ? handleAfterPhotoRemove : undefined}
      readOnly={!canEdit()}
        isSaving={saving}
      />

      {/* NOTE: Edit Modal removed - Phase 2 will implement unified treatment page */}
    </Stack>
  </Document>
);
}
