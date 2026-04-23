// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Alert, Badge, Button, Divider, Group, Paper, Select, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';

import { showNotification } from '@mantine/notifications';
import { normalizeErrorString } from '@medplum/core';
import { Document, Loading, useMedplum } from '@medplum/react';
import type { Appointment } from '@medplum/fhirtypes';
import { IconEdit } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { TreatmentStatusAlert } from './shared/TreatmentStatusAlert';
import { TreatmentHeader } from './shared/TreatmentHeader';
import { useTreatmentData } from './shared/useTreatmentData';
import { PhotoUploadSection } from '../nurse-mel/PhotoUploadSection';
import { CreateAppointmentModal } from '../components/CreateAppointmentModal';

// Laser types
const LASER_TYPES = [
  'CO2 Fractional',
  'Erbium YAG',
  'Nd:YAG',
  'IPL/Photofacial',
  'Laser Hair Removal',
  'Laser Tattoo Removal',
  'PicoSure',
  'V-Beam',
  'Fraxel',
];

// Treatment areas
const TREATMENT_AREAS = [
  'Full Face',
  'Neck',
  'Chest/Décolletage',
  'Hands',
  'Arms',
  'Legs',
  'Back',
  'Abdomen',
  'Full Body',
];

// Skin types (Fitzpatrick scale)
const SKIN_TYPES = [
  'Type I - Very Fair',
  'Type II - Fair',
  'Type III - Medium',
  'Type IV - Olive',
  'Type V - Brown',
  'Type VI - Dark',
];

interface LaserSession {
  id: string;
  area: string;
  laserType: string;
  settings: string;
  passes: number;
  skinType: string;
  notes: string;
}

export function LaserTreatmentPage(): JSX.Element {
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

  // Local state
  const [sessions, setSessions] = useState<LaserSession[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [recommendedSessions, setRecommendedSessions] = useState(4);
  const [appointment, setAppointment] = useState<Appointment | undefined>();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Load existing data
  useEffect(() => {
    if (procedure) {
      const sessionsExt = procedure.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/laser-sessions'
      );
      if (sessionsExt?.valueString) {
        try {
          setSessions(JSON.parse(sessionsExt.valueString));
        } catch {
          setSessions([]);
        }
      }

      const notesExt = procedure.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/treatment-notes'
      );
      if (notesExt?.valueString) {
        setGeneralNotes(notesExt.valueString);
      }

      const recommendedExt = procedure.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/recommended-sessions'
      );
      if (recommendedExt?.valueInteger) {
        setRecommendedSessions(recommendedExt.valueInteger);
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
    }
  }, [procedure, medplum]);

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

  const handleAddSession = (): void => {
    const newSession: LaserSession = {
      id: `session-${Date.now()}`,
      area: '',
      laserType: '',
      settings: '',
      passes: 1,
      skinType: '',
      notes: '',
    };
    setSessions([...sessions, newSession]);
  };

  const handleUpdateSession = (id: string, updates: Partial<LaserSession>): void => {
    setSessions(sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleRemoveSession = (id: string): void => {
    setSessions(sessions.filter((s) => s.id !== id));
  };

  const handleSave = useCallback(async (): Promise<void> => {
    if (!procedure) return;

    try {
      showNotification({
        title: 'Saved',
        message: 'Laser treatment details saved',
        color: 'green',
      });
    } catch (err) {
      showNotification({
        title: 'Error',
        message: normalizeErrorString(err),
        color: 'red',
      });
    }
  }, [procedure]);

  const completedSessions = sessions.length;

  return (
    <Document>
      <Stack gap="md" p="md">
        <Group justify="space-between" align="flex-start">
          <Title order={3}>Laser Treatment</Title>
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

        {/* Treatment Plan */}
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500}>Treatment Sessions</Text>
              <Group>
                <Text size="sm">Recommended sessions:</Text>
                <TextInput
                  type="number"
                  value={recommendedSessions}
                  onChange={(e) => setRecommendedSessions(parseInt(e.target.value) || 0)}
                  disabled={!canEdit()}
                  w={80}
                />
                <Text size="sm" c="dimmed">
                  Completed: {completedSessions}
                </Text>
              </Group>
            </Group>

            {canEdit() && (
              <Button onClick={handleAddSession} size="sm" w="fit-content">
                Add Session
              </Button>
            )}

            {sessions.length === 0 ? (
              <Text c="dimmed">No sessions added yet</Text>
            ) : (
              <Stack gap="md">
                {sessions.map((session, index) => (
                  <Paper key={session.id} p="sm" withBorder>
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text fw={500}>Session {index + 1}</Text>
                        {canEdit() && (
                          <Button 
                            variant="light" 
                            color="red" 
                            size="xs"
                            onClick={() => handleRemoveSession(session.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </Group>
                      <Group grow>
                        <Select
                          label="Treatment Area"
                          placeholder="Select area"
                          data={TREATMENT_AREAS}
                          value={session.area}
                          onChange={(v) => handleUpdateSession(session.id, { area: v || '' })}
                          disabled={!canEdit()}
                        />
                        <Select
                          label="Laser Type"
                          placeholder="Select laser"
                          data={LASER_TYPES}
                          value={session.laserType}
                          onChange={(v) => handleUpdateSession(session.id, { laserType: v || '' })}
                          disabled={!canEdit()}
                        />
                        <Select
                          label="Skin Type"
                          placeholder="Select skin type"
                          data={SKIN_TYPES}
                          value={session.skinType}
                          onChange={(v) => handleUpdateSession(session.id, { skinType: v || '' })}
                          disabled={!canEdit()}
                        />
                      </Group>
                      <Group grow>
                        <TextInput
                          label="Settings"
                          placeholder="e.g., 20J, 10ms, 10Hz"
                          value={session.settings}
                          onChange={(e) => handleUpdateSession(session.id, { settings: e.target.value })}
                          disabled={!canEdit()}
                        />
                        <TextInput
                          label="Passes"
                          type="number"
                          value={session.passes}
                          onChange={(e) => handleUpdateSession(session.id, { passes: parseInt(e.target.value) || 1 })}
                          disabled={!canEdit()}
                        />
                      </Group>
                      <Textarea
                        label="Session Notes"
                        placeholder="Patient response, settings adjustments, etc."
                        value={session.notes}
                        onChange={(e) => handleUpdateSession(session.id, { notes: e.target.value })}
                        disabled={!canEdit()}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}

            <Textarea
              label="Treatment Notes"
              placeholder="Overall treatment plan, expected results, aftercare instructions..."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              disabled={!canEdit()}
            />

            {canEdit() && (
              <Group justify="flex-end">
                <Button onClick={handleSave} loading={saving}>
                  Save Treatment Details
                </Button>
              </Group>
            )}
          </Stack>
        </Paper>

      {/* Photos */}
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
      </Stack>
    </Document>
  );
}
