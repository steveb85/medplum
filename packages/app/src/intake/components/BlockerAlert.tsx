// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * BlockerAlert Component
 * Displays warnings for contraindications and treatment blockers
 */

import { Alert, List, Stack, Text } from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';
import type { JSX } from 'react';
import type { TreatmentBlocker } from '../types/intake';

interface BlockerAlertProps {
  blockers: TreatmentBlocker[];
}

export function BlockerAlert({ blockers }: BlockerAlertProps): JSX.Element {
  if (blockers.length === 0) {
    return (
      <Alert color="green" icon={<IconCircleCheck size={16} />}>
        <Text fw={500}>No contraindications detected</Text>
        <Text size="sm">
          Based on your responses, there are no major contraindications for aesthetic treatments.
        </Text>
      </Alert>
    );
  }

  const blocking = blockers.filter((b) => b.severity === 'blocking');
  const warnings = blockers.filter((b) => b.severity === 'warning');

  return (
    <Stack gap="md">
      {blocking.length > 0 && (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          <Text fw={500}>Treatment Blockers Detected</Text>
          <Text size="sm" mb="xs">
            Some treatments may not be available due to the following:
          </Text>
          <List size="sm">
            {blocking.map((blocker) => (
              <List.Item key={blocker.id}>
                <Text fw={500}>{blocker.title}</Text>
                <Text size="xs" c="dimmed">
                  {blocker.message}
                </Text>
                {blocker.affectedTreatments.length > 0 && (
                  <Text size="xs" c="red">
                    Affects: {blocker.affectedTreatments.join(', ')}
                  </Text>
                )}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
          <Text fw={500}>Precautions Recommended</Text>
          <Text size="sm" mb="xs">
            Please inform your provider about the following:
          </Text>
          <List size="sm">
            {warnings.map((blocker) => (
              <List.Item key={blocker.id}>
                <Text fw={500}>{blocker.title}</Text>
                <Text size="xs" c="dimmed">
                  {blocker.message}
                </Text>
                {blocker.affectedTreatments.length > 0 && (
                  <Text size="xs" c="orange">
                    May affect: {blocker.affectedTreatments.join(', ')}
                  </Text>
                )}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}
    </Stack>
  );
}
