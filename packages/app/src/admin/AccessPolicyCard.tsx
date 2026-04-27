// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import type { AccessPolicy } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { getAccessPolicyDescription } from './accessPolicyUtils';

interface AccessPolicyCardProps {
  policy: AccessPolicy;
  usageCount: number;
  onEdit: (policy: AccessPolicy) => void;
  onClone: (policy: AccessPolicy) => void;
}

export function AccessPolicyCard(props: AccessPolicyCardProps): JSX.Element {
  const { policy, usageCount, onEdit, onClone } = props;

  const isSystemPolicy = policy.name?.includes('Policy') || policy.meta?.tag?.some((t) => t.code === 'system');
  const description = getAccessPolicyDescription(policy);

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs" style={{ flex: 1 }}>
          <Group gap="xs">
            <Text fw={500}>{policy.name}</Text>
            {isSystemPolicy && <Badge size="xs" color="blue">System</Badge>}
            {!isSystemPolicy && <Badge size="xs" color="green">Custom</Badge>}
          </Group>
          {description && (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {usageCount} {usageCount === 1 ? 'assignment' : 'assignments'}
          </Text>
        </Stack>
        <Group gap="xs">
          {!isSystemPolicy && (
            <Button size="xs" variant="outline" onClick={() => onEdit(policy)}>
              Edit
            </Button>
          )}
          <Button size="xs" variant="outline" onClick={() => onClone(policy)}>
            Clone
          </Button>
        </Group>
      </Group>
    </Card>
  );
}
