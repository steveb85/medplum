// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Alert, Button, Divider, Group, Paper, Stack, Text, Textarea, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { normalizeErrorString } from '@medplum/core';
import { Document, Loading, useMedplum } from '@medplum/react';
import { IconCamera, IconEdit } from '@tabler/icons-react';
import type { Appointment, Procedure } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { TreatmentStatusAlert } from './shared/TreatmentStatusAlert';
import { TreatmentHeader } from './shared/TreatmentHeader';
import { useTreatmentData } from './shared/useTreatmentData';
import { PhotoUploadSection } from '../nurse-mel/PhotoUploadSection';
import { EXTENSION_URLS } from '../utils/fhir-extensions';
// NOTE: CreateAppointmentModal removed - Phase 2 will implement multi-service booking

export function ConsultationTreatmentPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const procedureId = searchParams.get('procedureId');
  
  const {
    patient,
    procedure,
    beforePhotos,
    afterPhotos,
    loading,
    saving,
    user,
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
  const medplum = useMedplum();

  // Local state for consultation notes
  const [notes, setNotes] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [appointment, setAppointment] = useState<Appointment | undefined>();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Load existing data from procedure
  useEffect(() => {
    if (procedure) {
      const notesExt = procedure.extension?.find(
        (e) => e.url === EXTENSION_URLS.procedure.consultationNotes
      );
      if (notesExt?.valueString) {
        setNotes(notesExt.valueString);
      }

      const recExt = procedure.extension?.find(
        (e) => e.url === EXTENSION_URLS.procedure.recommendations
      );
      if (recExt?.valueString) {
        setRecommendations(recExt.valueString);
      }

      const followUpExt = procedure.extension?.find(
        (e) => e.url === EXTENSION_URLS.procedure.followUpDate
      );
      if (followUpExt?.valueString) {
        setFollowUpDate(followUpExt.valueString);
      }

      // Load linked appointment
      const linkedAppointmentRef = procedure.extension?.find(
        (e) => e.url === EXTENSION_URLS.common.linkedAppointment
      )?.valueReference?.reference;
      if (linkedAppointmentRef?.startsWith('Appointment/')) {
        const appointmentId = linkedAppointmentRef.split('/')[1];
        medplum.readResource('Appointment', appointmentId)
          .then((apt) => setAppointment(apt))
          .catch((err) => console.error('Error loading appointment:', err));
      }
    }
  }, [procedure, medplum]);

  const handleSaveNotes = useCallback(async (): Promise<void> => {
    if (!procedure) return;

    try {
      const updated: Procedure = {
        ...procedure,
        extension: [
          ...(procedure.extension?.filter(
            (e) =>
              e.url !== EXTENSION_URLS.procedure.consultationNotes &&
              e.url !== EXTENSION_URLS.procedure.recommendations &&
              e.url !== EXTENSION_URLS.procedure.followUpDate
          ) || []),
          {
            url: EXTENSION_URLS.procedure.consultationNotes,
            valueString: notes,
          },
          {
            url: EXTENSION_URLS.procedure.recommendations,
            valueString: recommendations,
          },
          ...(followUpDate
            ? [{
                url: EXTENSION_URLS.procedure.followUpDate,
                valueString: followUpDate,
              }]
            : []),
        ],
      };

      const saved = await medplum.updateResource(updated);
      setProcedure(saved);

      showNotification({
        title: 'Notes Saved',
        message: 'Consultation notes have been saved',
        color: 'green',
      });
    } catch (err) {
      showNotification({
        title: 'Error',
        message: normalizeErrorString(err),
        color: 'red',
      });
    }
  }, [procedure, notes, recommendations, followUpDate, medplum]);

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

  return (
    <Document>
      <Stack gap="md" p="md">
        <Group justify="space-between" align="flex-start">
          <Title order={3}>Consultation</Title>
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

        {/* Consultation Notes */}
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Text fw={500}>Consultation Notes</Text>
            <Textarea
              label="Patient Concerns & Goals"
              placeholder="Document patient concerns, aesthetic goals, and medical history..."
              minRows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit()}
            />
            <Textarea
              label="Provider Recommendations"
              placeholder="Document treatment recommendations, products discussed..."
              minRows={3}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              disabled={!canEdit()}
            />
            <Group>
              <Text size="sm">Follow-up recommended:</Text>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                disabled={!canEdit()}
              />
            </Group>
            {canEdit() && (
              <Group justify="flex-end">
                <Button onClick={handleSaveNotes} loading={saving}>
                  Save Notes
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
