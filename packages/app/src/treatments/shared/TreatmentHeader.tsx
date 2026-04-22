// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import type { Patient, Practitioner, Procedure } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { IconCircleCheck, IconPlayerPlay } from '@tabler/icons-react';
import { statusConfig } from './TreatmentStatusAlert';

interface TreatmentHeaderProps {
  procedure: Procedure;
  patient: Patient | undefined;
  user?: Practitioner;
  onBeginTreatment?: () => void;
  onCompleteTreatment?: () => void;
  canBeginTreatment?: boolean;
  canCompleteTreatment?: boolean;
  saving?: boolean;
}

export function TreatmentHeader({
  procedure,
  patient,
  user,
  onBeginTreatment,
  onCompleteTreatment,
  canBeginTreatment = false,
  canCompleteTreatment = false,
  saving = false,
}: TreatmentHeaderProps): JSX.Element {
  const status = procedure.status || 'preparation';
  const statusInfo = statusConfig[status] || statusConfig.preparation;

  // Get assigned providers from procedure
  const getAssignedProviders = (): { main?: string; assistant?: string } => {
    const result: { main?: string; assistant?: string } = {};
    
    const participants = procedure.performer || [];
    participants.forEach((p, index) => {
      const name = p.actor?.display;
      if (index === 0) {
        result.main = name;
      } else {
        result.assistant = name;
      }
    });
    
    return result;
  };

  const providers = getAssignedProviders();

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs">
          <Title order={4}>Treatment Details</Title>
          <Group>
            <Badge color={statusInfo.color} size="lg">
              {statusInfo.label}
            </Badge>
            <Text size="sm" c="dimmed">
              {procedure.code?.text || 'Treatment'}
            </Text>
          </Group>
        </Stack>
        
        {/* Action buttons - only for providers, not coordinators */}
        <Group>
          {status === 'preparation' && onBeginTreatment && (
            <Button
              leftSection={<IconPlayerPlay size={16} />}
              onClick={canBeginTreatment ? onBeginTreatment : undefined}
              disabled={!canBeginTreatment}
              loading={saving}
              color="blue"
            >
              Begin Treatment
            </Button>
          )}
          {status === 'in-progress' && onCompleteTreatment && (
            <Button
              leftSection={<IconCircleCheck size={16} />}
              onClick={canCompleteTreatment ? onCompleteTreatment : undefined}
              disabled={!canCompleteTreatment}
              loading={saving}
              color="green"
            >
              Complete Treatment
            </Button>
          )}
        </Group>
      </Group>

      <Paper p="md" withBorder>
        <Stack gap="xs">
          <Group>
            <Text fw={500}>Patient:</Text>
            <Text>
              {patient?.name?.[0]?.given?.[0]} {patient?.name?.[0]?.family}
            </Text>
          </Group>
          {providers.main && (
            <Group>
              <Text fw={500}>Main Provider:</Text>
              <Text>{providers.main}</Text>
            </Group>
          )}
          {providers.assistant && (
            <Group>
              <Text fw={500}>Assistant:</Text>
              <Text>{providers.assistant}</Text>
            </Group>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
