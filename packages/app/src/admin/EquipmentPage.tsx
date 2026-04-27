// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Group, Loader, Modal, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { Device } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import type { JSX } from 'react';
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import type { EquipmentUsage } from '../utils/equipment';
import { EquipmentCard } from './EquipmentCard';
import { EquipmentEditor } from './EquipmentEditor';
import { EQUIPMENT_TYPES } from './equipmentTypes';

export function EquipmentPage(): JSX.Element {
  const medplum = useMedplum();
  const [equipment, setEquipment] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [editEquipmentId, setEditEquipmentId] = useState<string | undefined>(undefined);
  const [cloneEquipmentId, setCloneEquipmentId] = useState<string | undefined>(undefined);

  const loadEquipment = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const bundle = await medplum.search('Device', { _count: '100' });
      const devices = (bundle.entry || []).map((e) => e.resource as Device);
      setEquipment(devices);
    } catch (err) {
      console.error('Error loading equipment:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to load equipment',
      });
    } finally {
      setLoading(false);
    }
  }, [medplum]);

  useEffect(() => {
    startTransition(() => {
      loadEquipment().catch(console.error);
    });
  }, [loadEquipment]);

  const handleCreateNew = (): void => {
    setEditMode('create');
    setEditEquipmentId(undefined);
    setCloneEquipmentId(undefined);
    setShowEditor(true);
  };

  const handleEdit = (device: Device): void => {
    setEditMode('edit');
    setEditEquipmentId(device.id);
    setShowEditor(true);
  };

  const handleClone = (device: Device): void => {
    setEditMode('create');
    setEditEquipmentId(undefined);
    setCloneEquipmentId(device.id);
    setShowEditor(true);
};

const handleMove = (device: Device): void => {
  showNotification({
    color: 'blue',
    title: 'Move Equipment',
    message: 'Equipment move feature coming soon',
  });
};

const handleStatusChange = async (device: Device, newStatus: string): Promise<void> => {
    try {
      const updated = { ...device, status: newStatus as any };
      await medplum.updateResource(updated);
      showNotification({
        color: 'green',
        title: 'Success',
        message: `Equipment marked as ${newStatus}`,
});
    loadEquipment().catch(console.error);
    } catch (err) {
      console.error('Error updating status:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to update equipment status',
      });
    }
  };

  const handleSave = (device: Device): void => {
    setShowEditor(false);
    loadEquipment().catch(console.error);
  };

  const handleCancel = (): void => {
    setShowEditor(false);
  };

const getRoomName = (roomId?: string): string => {
  if (!roomId) {
    return 'Floating';
  }
  // Mock - in real implementation, fetch room name from ID
  if (roomId === 'room-1') {
    return 'Treatment Room 1';
  }
  if (roomId === 'room-2') {
    return 'Treatment Room 2';
  }
  return 'Unknown Room';
};

  // Group by equipment type
  const groupedEquipment = useMemo(() => {
    const groups: Record<string, Device[]> = {};
    for (const item of equipment) {
      const typeCode = (item.deviceName?.[0]?.type as any) || 'other';
      if (!groups[typeCode]) {
        groups[typeCode] = [];
      }
      groups[typeCode].push(item);
    }
    return groups;
  }, [equipment]);

  return (
    <Paper p="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={3}>Equipment Management</Title>
          <Button onClick={handleCreateNew}>+ Add Equipment</Button>
        </Group>

        <Text size="sm" c="dimmed">
          Manage equipment with availability tracking and room assignment.
        </Text>

        {loading ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : (
          <Stack gap="lg">
            {Object.keys(groupedEquipment).map((typeCode) => {
              const equipmentList = groupedEquipment[typeCode];
              const typeInfo = EQUIPMENT_TYPES.find((t) => t.code === typeCode);
              const typeLabel = typeInfo?.label || typeCode;

              return (
                <Stack key={typeCode} gap="md">
                  <Title order={4}>{typeLabel}</Title>
                  <SimpleGrid cols={1} spacing="sm">
{equipmentList.map((device) => {
              const usage: EquipmentUsage = { bookingCount: 0, totalHours: 0, totalCost: 0, bookingIds: [] }; // Mock for now
              return (
                <EquipmentCard
                  key={device.id}
                  equipment={device}
                  usage={usage}
                  getRoomName={getRoomName}
                  onEdit={handleEdit}
                  onStatusChange={handleStatusChange}
                  onMove={handleMove}
                />
              );
            })}
                  </SimpleGrid>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Stack>

      <Modal
        opened={showEditor}
        onClose={handleCancel}
        title={editMode === 'create' ? 'Add Equipment' : 'Edit Equipment'}
        size="lg"
      >
        <EquipmentEditor
          mode={editMode}
          equipmentId={editEquipmentId}
          sourceEquipmentId={cloneEquipmentId}
          onCancel={handleCancel}
          onSave={handleSave}
        />
      </Modal>
    </Paper>
  );
}
