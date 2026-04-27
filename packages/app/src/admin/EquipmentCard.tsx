// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import type { Device } from '@medplum/fhirtypes';
import type { JSX } from 'react';

interface EquipmentCardProps {
  equipment: Device;
  usage: {
    bookingCount: number;
    totalHours: number;
  };
  getRoomName: (roomId?: string) => string;
  onEdit: (equipment: Device) => void;
  onMove: (equipment: Device) => void;
  onStatusChange: (equipment: Device, newStatus: string) => void;
}

export function EquipmentCard(props: EquipmentCardProps): JSX.Element {
  const { equipment, usage, getRoomName, onEdit, onMove, onStatusChange } = props;

  const name = equipment.deviceName?.[0]?.name || 'Unnamed Equipment';
  const uniqueCode =
    equipment.identifier?.find((id) => id.system === 'http://melissaknudson.com/equipment-code')?.value || 'N/A';
  const status = (equipment as any).status;
  const assignedRoomId = equipment.location?.reference?.split('/')[1];

  let badgeColor: string;
  if (status === 'active') {
    badgeColor = 'green';
  } else if (status === 'unknown') {
    badgeColor = 'yellow';
  } else if (status === 'inactive') {
    badgeColor = 'gray';
  } else {
    badgeColor = 'red';
  }
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs" style={{ flex: 1 }}>
          <Group gap="xs">
            <Text fw={500}>{name}</Text>
            <Badge
              size="sm"
              color={badgeColor}
            >
              {status || 'active'}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            Code: {uniqueCode}
          </Text>
          {equipment.serialNumber && (
            <Text size="xs" c="dimmed">
              Serial: {equipment.serialNumber}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            Assigned: {assignedRoomId ? getRoomName(assignedRoomId) : 'Floating'}
          </Text>
          <Text size="xs" c="dimmed">
            Usage: {usage.bookingCount} bookings, {usage.totalHours.toFixed(1)} hours
          </Text>
        </Stack>
        <Group gap="xs">
          {status !== 'retired' && (
            <Button size="xs" variant="outline" onClick={() => onEdit(equipment)}>
              Edit
            </Button>
          )}
          {status === 'active' && (
            <Button size="xs" variant="outline" color="yellow" onClick={() => onStatusChange(equipment, 'maintenance')}>
              Service
            </Button>
          )}
          {status === 'unknown' && (
            <Button size="xs" variant="outline" color="green" onClick={() => onStatusChange(equipment, 'active')}>
              Ready
            </Button>
          )}
          {status === 'active' && (
            <Button size="xs" color="red" variant="outline" onClick={() => onStatusChange(equipment, 'retired')}>
              Retire
            </Button>
          )}
        </Group>
      </Group>
    </Card>
  );
}
