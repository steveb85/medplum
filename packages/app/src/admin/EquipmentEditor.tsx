// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  Button,
  Checkbox,
  Group,
  Loader,
  Stack,
  TextInput,
  Textarea,
  Title,
  Select,
  Text,
  Divider,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { Device, Location } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { EQUIPMENT_TYPES } from './equipmentTypes';

interface EquipmentEditorProps {
  mode: 'create' | 'edit';
  equipmentId?: string;
  sourceEquipmentId?: string;
  onCancel: () => void;
  onSave: (device: Device) => void;
}

export function EquipmentEditor(props: EquipmentEditorProps): JSX.Element {
  const { mode, equipmentId, sourceEquipmentId, onCancel, onSave } = props;
  const medplum = useMedplum();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string>('active');
  const [notes, setNotes] = useState('');

  const [rooms, setRooms] = useState<Location[]>([]);
  const [isFloating, setIsFloating] = useState(false);

  const initializeEditor = async (): Promise<void> => {
    try {
      setLoading(true);

      // Load rooms for room assignment
      const roomsBundle = await medplum.search('Location', { _count: '50' });
      const locations = (roomsBundle.entry || []).map((e) => e.resource as Location);
      setRooms(locations);

      if (mode === 'edit' && equipmentId) {
        // Edit mode - load existing
        const device = await medplum.readResource('Device', equipmentId);

        setName(device.deviceName?.[0]?.name || '');
        setTypeCode((device.deviceName?.[0]?.type as any) || 'other');

        const serialId = device.identifier?.find(
          (i) => i.system === 'http://melissaknudson.com/serial-number'
        );
        setSerialNumber(serialId?.value || '');

        setStatus((device.status as any) || 'active');

        if (device.location?.reference) {
          const roomId = device.location.reference.split('/')[1];
          setSelectedRoomId(roomId);
        } else {
          setSelectedRoomId(undefined);
          setIsFloating(true);
        }
      } else if (mode === 'create' && sourceEquipmentId) {
        // Clone mode - pre-fill from source
        const sourceDevice = await medplum.readResource('Device', sourceEquipmentId);
        setName(`${sourceDevice.deviceName?.[0]?.name || ''} (Copy)`);
        setTypeCode((sourceDevice.deviceName?.[0]?.type as any) || 'other');
        setSerialNumber('');
        setStatus('active');
        setIsFloating(!sourceDevice.location?.reference);
        if (sourceDevice.location?.reference) {
          setSelectedRoomId(sourceDevice.location.reference.split('/')[1]);
        }
      } else if (mode === 'create') {
        // Create mode - defaults
        setIsFloating(true);
      }
    } catch (err) {
      console.error('Error initializing editor:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to load data',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeEditor();
  }, [mode, equipmentId, sourceEquipmentId]);

  const handleSubmit = async (): Promise<void> => {
    try {
      setSaving(true);

      if (!name.trim()) {
        showNotification({
          color: 'red',
          title: 'Validation Error',
          message: 'Equipment name is required',
        });
        return;
      }

      // Find type info for device name
      const typeInfo = EQUIPMENT_TYPES.find((t) => t.code === typeCode);

    const device: Device = {
      resourceType: 'Device',
      id: mode === 'edit' ? equipmentId : undefined,
      status: status as any,
      deviceName: [
        {
          name,
          type: typeCode as any,
        },
      ],
      identifier: [],
    };

      // Add serial number if provided
      if (serialNumber?.trim()) {
        device.identifier?.push({
          system: 'http://melissaknudson.com/serial-number',
          value: serialNumber.trim(),
        });
      }

      // Add unique code
      if (mode === 'create') {
        const uniqueCode = `${typeCode}-${Math.floor(Math.random() * 1000)}`;
        device.identifier?.push({
          system: 'http://melissaknudson.com/equipment-code',
          value: uniqueCode,
        });
      }

      // Handle room assignment
      if (!isFloating && selectedRoomId) {
        device.location = { reference: `Location/${selectedRoomId}` };
      }

      // Save to server
      let savedDevice: any;
      if (mode === 'edit' && equipmentId) {
        savedDevice = await medplum.updateResource(device);
        showNotification({
          color: 'green',
          title: 'Success',
          message: 'Equipment updated successfully',
        });
      } else {
        savedDevice = await medplum.createResource(device);
        showNotification({
          color: 'green',
          title: 'Success',
          message: 'Equipment created successfully',
        });
      }

      onSave(savedDevice);
    } catch (err) {
      console.error('Error saving equipment:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to save equipment',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Group justify="center" p="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <Title order={4}>{mode === 'create' ? 'Add New Equipment' : 'Edit Equipment'}</Title>

      <TextInput
        label="Equipment Name"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        required
        placeholder="e.g., Cynosure Elite+ Laser"
      />

            <Select
              label="Equipment Type"
              value={typeCode}
              onChange={(val) => setTypeCode(val || '')}
              data={EQUIPMENT_TYPES.map((t) => ({ value: t.code, label: t.label }))}
              placeholder="Select equipment type"
              required
            />

      <TextInput
        label="Serial Number"
        value={serialNumber}
        onChange={(e) => setSerialNumber(e.currentTarget.value)}
        placeholder="Optional"
      />

            <Select
              label="Status"
              value={status}
              onChange={(val) => setStatus(val || 'active')}
              data={[
                { value: 'active', label: 'Active' },
                { value: 'maintenance', label: 'Maintenance' },
                { value: 'retired', label: 'Retired' },
              ]}
              required
            />

      <Divider label="Room Assignment" />

      <Checkbox
        label="This is portable/floating equipment (not assigned to a room)"
        checked={isFloating}
        onChange={(e) => {
          setIsFloating(e.currentTarget.checked);
          if (e.currentTarget.checked) {
            setSelectedRoomId(undefined);
          }
        }}
      />

          {!isFloating && (
            <Select
              label="Assign to Room"
              value={selectedRoomId}
              onChange={(val) => setSelectedRoomId(val || undefined)}
              data={rooms.map((r) => ({ value: r.id as string, label: r.name || 'Unnamed Room' }))}
              placeholder="Select a room (optional)"
            />
          )}

      {isFloating && (
        <Text size="sm" c="dimmed">
          This equipment will be marked as floating/portable and can be moved between rooms
        </Text>
      )}

      <Textarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
        placeholder="Optional notes about this equipment"
        rows={3}
      />

      <Group justify="right" mt="md">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={saving} disabled={!name.trim() || !typeCode}>
          {mode === 'edit' ? 'Save Changes' : 'Create Equipment'}
        </Button>
      </Group>
    </Stack>
  );
}
