// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import type { Location } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { getRoomTypeLabel } from '../../../types/rooms';

interface RoomCardProps {
  room: Location;
  assignedEquipmentCount: number;
  usage: { bookingCount: number; totalHours: number };
  onEdit: (room: Location) => void;
  onToggleStatus: (room: Location, newStatus: 'active' | 'inactive') => void;
  getEquipmentCount: (roomId: string) => number;
}

export function RoomCard(props: RoomCardProps): JSX.Element {
  const { room, assignedEquipmentCount, usage, onEdit, onToggleStatus, getEquipmentCount } = props;

  const roomName = room.name || 'Unnamed Room';
  const roomType = room.type?.[0]?.coding?.[0]?.code as 'treatment' | 'waiting' | 'numbing' | 'photo' | 'other' | undefined;
  const status = room.status;

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs" style={{ flex: 1 }}>
          <Group gap="xs">
            <Text fw={500}>{roomName}</Text>
            {roomType && (
              <Badge size="sm" color="blue">
                {getRoomTypeLabel(roomType)}
              </Badge>
            )}
            <Badge
              size="sm"
              color={status === 'active' ? 'green' : 'gray'}
            >
              {status}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            Equipment: {assignedEquipmentCount} items
          </Text>
          <Text size="xs" c="dimmed">
            Usage: {usage.bookingCount} bookings, {usage.totalHours.toFixed(1)} hrs today
          </Text>
        </Stack>
        <Group gap="xs">
          <Button size="xs" variant="outline" onClick={() => onEdit(room)}>
            Edit
          </Button>
          {status === 'active' ? (
            <Button
              size="xs"
              variant="outline"
              color="red"
              onClick={() => onToggleStatus(room, 'inactive')}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              size="xs"
              variant="outline"
              color="green"
              onClick={() => onToggleStatus(room, 'active')}
            >
              Activate
            </Button>
          )}
        </Group>
      </Group>
    </Card>
  );
}
