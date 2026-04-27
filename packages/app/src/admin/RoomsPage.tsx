// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Group, Loader, Modal, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { Location } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getMedSpaRole } from '../auth/role';
import { RoomCard } from './RoomCard';
import { RoomEditor } from './RoomEditor';

interface RoomWithUsage {
  room: Location;
  usage: { bookingCount: number; totalHours: number };
  equipmentCount: number;
}

export function RoomsPage(): JSX.Element {
  const medplum = useMedplum();
  const [rooms, setRooms] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [editRoomId, setEditRoomId] = useState<string | undefined>(undefined);
  const [equipmentCounts, setEquipmentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async (): Promise<void> => {
    try {
      setLoading(true);
      const bundle = await medplum.search('Location', {
        type: 'http://melissaknudson.com/location-type|treatment-room',
        _sort: 'name',
        _count: '50',
      });
      const locations = (bundle.entry || []).map((e) => e.resource as Location);
      
      // Also get other room types
      const otherBundle = await medplum.search('Location', {
        _sort: 'name',
        _count: '50',
      });
      const otherLocations = (otherBundle.entry || []).map((e) => e.resource as Location);
      
      // Combine and deduplicate
      const allLocations = [...locations, ...otherLocations].filter(
        (room, index, self) => index === self.findIndex((r) => r.id === room.id)
      );
      
      setRooms(allLocations);
      
      // Calculate equipment counts
      const counts = await Promise.all(
        allLocations.map(async (room) => {
          const equipment = await medplum.search('Device', {
            location: room.id,
            _count: '0',
          });
          return [room.id, equipment.total ?? 0] as [string, number];
        })
      );
      setEquipmentCounts(Object.fromEntries(counts));
    } catch (err) {
      console.error('Error loading rooms:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to load rooms',
      });
    } finally {
      setLoading(false);
    }
  };

  const hasLaser = (room: Location): boolean => {
    return room.extension?.find((e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/has-laser')?.valueBoolean ?? false;
  };

  const handleCreateNew = (): void => {
    setEditMode('create');
    setEditRoomId(undefined);
    setShowEditor(true);
  };

  const handleEdit = (room: Location): void => {
    setEditMode('edit');
    setEditRoomId(room.id);
    setShowEditor(true);
  };

  const handleToggleStatus = async (room: Location, newStatus: 'active' | 'inactive'): Promise<void> => {
    try {
      const updated: Location = { ...room, status: newStatus };
      await medplum.updateResource(updated);
      showNotification({
        color: 'green',
        title: 'Success',
        message: `Room ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      });
      loadRooms();
    } catch (err) {
      console.error('Error toggling room status:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to update room status',
      });
    }
  };

  const handleSave = (room: Location): void => {
    setShowEditor(false);
    loadRooms();
  };

  const handleCancel = (): void => {
    setShowEditor(false);
  };

  const activeRooms = rooms.filter((r) => r.status === 'active');
  const inactiveRooms = rooms.filter((r) => r.status === 'inactive');

  return (
    <Paper p="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={3}>Room Management</Title>
          <Button onClick={handleCreateNew}>+ New Room</Button>
        </Group>

        <Text size="sm" c="dimmed">Manage rooms and their configurations for appointments.</Text>

        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : (
          <Stack gap="lg">
            {activeRooms.length > 0 && (
              <Stack gap="md">
                <Title order={4}>Active Rooms</Title>
                <SimpleGrid cols={1} spacing="sm">
                  {activeRooms.map((room) => {
                    const usage: RoomWithUsage['usage'] = { bookingCount: 0, totalHours: 0 }; // Mock
                    return (
                      <RoomCard
                        key={room.id}
                        room={room}
                        assignedEquipmentCount={equipmentCounts[room.id] || 0}
                        usage={usage}
                        getEquipmentCount={(id) => equipmentCounts[id] || 0}
                        onEdit={handleEdit}
                        onToggleStatus={handleToggleStatus}
                      />
                    );
                  })}
                </SimpleGrid>
              </Stack>
            )}

            {inactiveRooms.length > 0 && (
              <Stack gap="md">
                <Title order={4}>Inactive Rooms</Title>
                <SimpleGrid cols={1} spacing="sm">
                  {inactiveRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      assignedEquipmentCount={equipmentCounts[room.id] || 0}
                      usage={{ bookingCount: 0, totalHours: 0 }}
                      getEquipmentCount={(id) => equipmentCounts[id] || 0}
                      onEdit={handleEdit}
                      onToggleStatus={handleToggleStatus}
                    />
                  ))}
                </SimpleGrid>
              </Stack>
            )}
          </Stack>
        )}
      </Stack>

      <Modal opened={showEditor} onClose={handleCancel} title={editMode === 'create' ? 'Create Room' : 'Edit Room'} size="lg">
        <RoomEditor
          mode={editMode}
          roomId={editRoomId}
          onCancel={handleCancel}
          onSave={handleSave}
        />
      </Modal>
    </Paper>
  );
}
