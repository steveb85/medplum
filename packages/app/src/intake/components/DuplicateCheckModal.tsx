// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * DuplicateCheckModal Component
 * Shows potential duplicate patients when phone/email matches
 */

import { Alert, Button, Group, List, Modal, Stack, Text } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';
import type { Patient } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { formatPatientName, formatDateOfBirth } from '../utils/formatters';

interface DuplicateCheckModalProps {
  opened: boolean;
  onClose: () => void;
  duplicates: Patient[];
  onSelectExisting: (patient: Patient) => void;
  onCreateNew: () => void;
}

export function DuplicateCheckModal({
  opened,
  onClose,
  duplicates,
  onSelectExisting,
  onCreateNew,
}: DuplicateCheckModalProps): JSX.Element {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Potential Duplicate Patient Found"
      size="lg"
    >
      <Stack gap="md">
        <Text>
          We found existing patient(s) with similar contact information. Please review:
        </Text>

        <List spacing="sm">
          {duplicates.map((patient) => (
            <List.Item key={patient.id}>
              <div
                style={{
                  padding: '12px',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa',
                }}
              >
                <Stack gap="xs">
                  <Group>
                    <IconUser size={20} />
                    <Text fw={500}>{formatPatientName(patient)}</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    DOB: {formatDateOfBirth(patient.birthDate)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Phone: {patient.telecom?.find((t) => t.system === 'phone')?.value || 'N/A'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Email: {patient.telecom?.find((t) => t.system === 'email')?.value || 'N/A'}
                  </Text>
                  <Button
                    variant="light"
                    size="xs"
                    onClick={() => onSelectExisting(patient)}
                  >
                    This is the same patient
                  </Button>
                </Stack>
              </div>
            </List.Item>
          ))}
        </List>

        <Alert color="blue">
          <Text size="sm">
            If none of these match, click "Create New Patient" below.
          </Text>
        </Alert>

        <Group justify="space-between" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onCreateNew}>Create New Patient</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
