// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * PatientEditPage Component
 * Full patient edit form accessible from Patient detail page
 * Reuses IntakeWizard but loads existing patient data
 */

import { Alert, Container, LoadingOverlay, Stack, Text, Title } from '@mantine/core';
import { IconUserEdit } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IntakeWizard } from './IntakeWizard';
import { useIntakeSubmission } from './hooks';
import { loadPatientIntoForm } from './utils/loadPatient';
import { getDefaultFormData } from './utils/validation';
import type { IntakeFormData } from './types/intake';
import { useMedplum } from '@medplum/react';

export function PatientEditPage(): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const { id: patientId } = useParams<{ id: string }>();
  const { isSubmitting, submitIntake } = useIntakeSubmission();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [formData, setFormData] = useState<IntakeFormData>(getDefaultFormData());

  // Load patient data on mount
  useEffect(() => {
    async function loadPatient(): Promise<void> {
      if (!patientId) {
        setLoadError('No patient ID provided');
        setIsLoading(false);
        return;
      }

      try {
        const loadedData = await loadPatientIntoForm(medplum, patientId);
        if (loadedData) {
          setFormData(loadedData);
        } else {
          setLoadError('Patient not found');
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load patient data');
      } finally {
        setIsLoading(false);
      }
    }

    loadPatient();
  }, [medplum, patientId]);

  const handleSubmit = async (data: IntakeFormData): Promise<void> => {
    if (!patientId) {
      return;
    }

    const result = await submitIntake(data, 'coordinator-assisted', patientId);

    if (result.success) {
      // Navigate back to patient page
      void navigate(`/Patient/${patientId}`);
    }
  };

  const handleCancel = (): void => {
    if (patientId) {
      void navigate(`/Patient/${patientId}`);
    } else {
      void navigate('/');
    }
  };

  if (isLoading) {
    return (
      <Container size="md" py="xl">
        <LoadingOverlay visible={true} overlayProps={{ blur: 2 }} />
        <Stack gap="lg" align="center" py="xl">
          <Title order={3}>Loading patient data...</Title>
          <Text c="dimmed">Please wait while we fetch the patient information.</Text>
        </Stack>
      </Container>
    );
  }

  if (loadError) {
    return (
      <Container size="md" py="xl">
        <Alert color="red" title="Error Loading Patient">
          {loadError}
          <Text mt="md">
            <Text
              component="span"
              c="blue"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate('/')}
            >
              Return to home page
            </Text>
          </Text>
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2} mb="xs">
            <IconUserEdit
              size={28}
              style={{ marginRight: '8px', display: 'inline', verticalAlign: 'middle' }}
            />
            Edit Patient Information
          </Title>
          <Alert color="blue">
            Editing patient: <strong>{formData.firstName} {formData.lastName}</strong>
          </Alert>
        </div>

        <IntakeWizard
          mode="coordinator-assisted"
          initialData={formData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
          isEditMode
        />
      </Stack>
    </Container>
  );
}
