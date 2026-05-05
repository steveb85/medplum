// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Group, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PractitionerForm } from './PractitionerForm';

export function PractitionerFormPage(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = !!id;

  const handleSuccess = async (): Promise<void> => {
    await navigate('/Practitioner');
  };

  const handleCancel = async (): Promise<void> => {
    await navigate(-1);
  };

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Group>
          <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={handleCancel}>
            Back
          </Button>
          <Title order={2}>{isEditMode ? 'Edit Staff Member' : 'Add New Staff Member'}</Title>
        </Group>
      </Group>
      <PractitionerForm practitionerId={id} onSuccess={handleSuccess} onCancel={handleCancel} />
    </>
  );
}
