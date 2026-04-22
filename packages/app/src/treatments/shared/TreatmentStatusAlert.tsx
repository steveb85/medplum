// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Alert, Group, Text } from '@mantine/core';
import type { JSX } from 'react';

export interface TreatmentStatusConfig {
  color: string;
  label: string;
  description: string;
}

export const statusConfig: Record<string, TreatmentStatusConfig> = {
  preparation: {
    color: 'orange',
    label: 'Scheduled',
    description: 'Appointment booked, ready for before photos',
  },
  'in-progress': {
    color: 'blue',
    label: 'In Progress',
    description: 'Treatment active',
  },
  completed: {
    color: 'green',
    label: 'Completed',
    description: 'Treatment finished, view only',
  },
  cancelled: {
    color: 'red',
    label: 'Cancelled',
    description: 'Treatment cancelled',
  },
};

interface TreatmentStatusAlertProps {
  status: string;
}

export function TreatmentStatusAlert({ status }: TreatmentStatusAlertProps): JSX.Element | null {
  const config = statusConfig[status];
  if (!config) return null;

  return (
    <Alert color={config.color} variant="light">
      <Group>
        <Text fw={500}>{config.label}</Text>
        <Text size="sm">{config.description}</Text>
      </Group>
    </Alert>
  );
}
