// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * PatientIntakePage Component
 * Main entry point for the patient intake form
 * Supports both self-service (patient-facing) and coordinator-assisted modes
 */

import { Alert, Container, Stack, Title } from '@mantine/core';
import { IconClipboardCheck } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntakeSuccess } from './components/IntakeSuccess';
import { IntakeWizard } from './IntakeWizard';
import { useIntakeSubmission } from './hooks';
import { getDefaultFormData } from './utils/validation';
import type { IntakeFormData, IntakeMode } from './types/intake';

export function PatientIntakePage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const { isSubmitting, submitIntake } = useIntakeSubmission();

  // Track submission state
  const [isComplete, setIsComplete] = useState(false);
  const [submittedPatientId, setSubmittedPatientId] = useState<string>('');
  const [submittedPatientName, setSubmittedPatientName] = useState<string>('');

  // Determine mode from URL query param
  const mode: IntakeMode = useMemo(() => {
    const modeParam = searchParams.get('mode');
    return modeParam === 'coordinator' ? 'coordinator-assisted' : 'self-service';
  }, [searchParams]);

  // Check if user is logged in (coordinator mode requires auth)
  const isCoordinatorMode = mode === 'coordinator-assisted';

  const handleSubmit = async (data: IntakeFormData): Promise<void> => {
    const result = await submitIntake(data, mode);

    if (result.success && result.patientId) {
      // Store success info
      setSubmittedPatientId(result.patientId);
      setSubmittedPatientName(`${data.firstName} ${data.lastName}`);
      setIsComplete(true);

      // Clear localStorage draft on successful submission
      const draftKey = `intake-draft-${mode}`;
      localStorage.removeItem(draftKey);
    }
  };

  const handleReset = (): void => {
    // Reset form state
    setIsComplete(false);
    setSubmittedPatientId('');
    setSubmittedPatientName('');
  };

  // Show success screen after completion
  if (isComplete) {
    return (
      <Container size="md" py="xl">
        <IntakeSuccess
          patientId={submittedPatientId}
          patientName={submittedPatientName}
          onReset={handleReset}
        />
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2} mb="xs">
            <IconClipboardCheck size={28} style={{ marginRight: '8px', display: 'inline', verticalAlign: 'middle' }} />
            Patient Intake Form
          </Title>
          {isCoordinatorMode && (
            <Alert color="blue">
              Coordinator Mode: You are creating a patient record on behalf of the patient.
            </Alert>
          )}
        </div>

        <IntakeWizard
          mode={mode}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </Stack>
    </Container>
  );
}
