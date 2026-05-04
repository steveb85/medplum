// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * IntakeSuccess Component
 * Post-submission confirmation screen for patients
 */

import { Button, Card, Center, Group, Stack, Text, Title } from '@mantine/core';
import { IconCheck, IconPrinter, IconRotate } from '@tabler/icons-react';
import type { JSX } from 'react';

interface IntakeSuccessProps {
  patientId: string;
  patientName: string;
  onReset: () => void;
  onPrint?: () => void;
}

export function IntakeSuccess({ patientId, patientName, onReset, onPrint }: IntakeSuccessProps): JSX.Element {
  return (
    <Center py="xl">
      <Card withBorder shadow="sm" padding="xl" radius="md" w="100%" maw={500}>
        <Stack align="center" gap="lg">
          {/* Success Icon */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: '#40c057',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconCheck size={48} color="white" />
          </div>

          {/* Title */}
          <Title order={2} ta="center">
            Welcome to Studio Assistant!
          </Title>

          {/* Message */}
          <Text size="lg" ta="center">
            Thank you, {patientName}!
          </Text>

          <Text c="dimmed" ta="center">
            Your patient intake has been completed successfully.
          </Text>

          {/* Patient ID */}
          <Card withBorder bg="gray.0" p="md" w="100%">
            <Group justify="center">
              <Text fw={500}>Patient ID:</Text>
              <Text ff="monospace">{patientId}</Text>
            </Group>
          </Card>

          {/* Next Steps */}
          <Stack gap="xs" w="100%">
            <Text fw={500}>What's Next:</Text>
            <Text size="sm" c="dimmed">
              • Our team will review your information
            </Text>
            <Text size="sm" c="dimmed">
              • You'll receive a text/email to schedule your appointment
            </Text>
            <Text size="sm" c="dimmed">
              • Please return this device to the coordinator
            </Text>
          </Stack>

          {/* Actions */}
          <Group justify="center" mt="md">
            <Button variant="light" leftSection={<IconRotate size={16} />} onClick={onReset}>
              Done - Return to Start
            </Button>
            {onPrint && (
              <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={onPrint}>
                Print Summary
              </Button>
            )}
          </Group>
        </Stack>
      </Card>
    </Center>
  );
}
