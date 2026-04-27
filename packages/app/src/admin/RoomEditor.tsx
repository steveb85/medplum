// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { Location } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { ROOM_TYPES } from '../../../types/rooms';

interface RoomEditorProps {
  mode: 'create' | 'edit';
  roomId?: string;
  sourceRoom?: Location; // For cloning
  onCancel: () => void;
  onSave: (room: Location) => void;
}

export function RoomEditor(props: RoomEditorProps): JSX.Element {
  const { mode, roomId, sourceRoom, onCancel, onSave } = props;
  const medplum = useMedplum();

  const [name, setName] = useState(sourceRoom?.name ?? '');
  const [roomType, setRoomType] = useState<'treatment' | 'waiting' | 'numbing' | 'photo' | 'other' | undefined>(
    sourceRoom?.type?.[0]?.coding?.[0]?.code as any
  );
  const [hasLaser, setHasLaser] = useState(
    sourceRoom?.extension?.find((e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/has-laser')?.valueBoolean ?? false
  );

  useEffect(() => {
    if (mode === 'edit' && roomId) {
      medplum
        .readResource('Location', roomId)
        .then((room) => {
          setName(room.name || '');
          setRoomType(room.type?.[0]?.coding?.[0]?.code as any);
          setHasLaser(
            room.extension?.find((e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/has-laser')?.valueBoolean ??
            false
          );
        })
        .catch(console.error);
    }
  }, [mode, roomId, medplum]);

  const handleSave = async (): Promise<void> => {
    try {
      const location: Location = {
        resourceType: 'Location',
        id: mode === 'edit' ? roomId : undefined,
        meta: { project: medplum.getProject()?.id as any },
        status: 'active' as const,
        name,
        mode: 'instance',
        type: roomType
          ? [
              {
                coding: [{ system: 'http://melissaknudson.com/location-type', code: roomType, display: ROOM_TYPES.find((t) => t.code === roomType)?.label || '' }],
              },
            ]
          : undefined,
        physicalType: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/location-physical-type', code: 'ro', display: 'Room' }],
        },
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/has-laser',
            valueBoolean: hasLaser,
          },
        ],
      };

      const result = await medplum.upsertResource(location);
      showNotification({
        color: 'green',
        title: 'Success',
        message: mode === 'edit' ? 'Room updated successfully' : 'Room created successfully',
      });
      onSave(result);
    } catch (err) {
      console.error('Error saving room:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to save room',
      });
    }
  };

  return (
    <Paper p="md">
      <Stack gap="md">
        <Title order={3}>{mode === 'create' ? 'Create Room' : 'Edit Room'}</Title>

        <TextInput
          label="Room Name"
          placeholder="Treatment Room 1"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

        <Select
          label="Room Type"
          placeholder="Select room type"
          value={roomType || ''}
          onChange={(value) => setRoomType(value as any)}
          data={ROOM_TYPES.map((t) => ({ value: t.code, label: t.label }))}
          required
        />

        <Select
          label="Has Laser"
          value={hasLaser ? 'true' : 'false'}
          onChange={(value) => setHasLaser(value === 'true')}
          data={[
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
        />

        <Group justify="right">
          <Button variant="light" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </Group>
      </Stack>
    </Paper>
  );
}
