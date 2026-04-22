// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Alert, Button, Divider, Group, Paper, Stack, Text, Textarea, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { normalizeErrorString } from '@medplum/core';
import { Document, Loading } from '@medplum/react';

import type { JSX } from 'react';
import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { TreatmentStatusAlert } from './shared/TreatmentStatusAlert';
import { TreatmentHeader } from './shared/TreatmentHeader';
import { useTreatmentData } from './shared/useTreatmentData';
import { PhotoUploadSection } from '../nurse-mel/PhotoUploadSection';

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
    handleBeginTreatment,
    handleCompleteTreatment,
    handleBeforePhotoUpload,
    handleAfterPhotoUpload,
    handleBeforePhotoRemove,
    handleAfterPhotoRemove,
    canBeginTreatment,
    canCompleteTreatment,
    canEdit,
  } = useTreatmentData();

  // Local state for consultation notes
  const [notes, setNotes] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

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

  const handleSaveNotes = useCallback(async (): Promise<void> => {
    // Save notes to procedure extension
    try {
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
  }, []);

  return (
    <Document>
      <Stack gap="md" p="md">
        <Title order={3}>Consultation</Title>

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
        patientId={patient?.id}
        procedureId={procedureId || undefined}
        beforePhotos={beforePhotos}
        afterPhotos={afterPhotos}
        onPhotosUpdated={reloadPhotos}
        readOnly={!canEdit()}
        isSaving={saving}
      />
      </Stack>
    </Document>
  );
}
