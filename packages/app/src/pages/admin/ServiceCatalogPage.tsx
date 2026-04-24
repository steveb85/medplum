// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  Badge,
  Button,
  Card,
  ColorInput,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import { normalizeErrorString } from '@medplum/core';
import type { ActivityDefinition } from '@medplum/fhirtypes';
import { useMedplum, useSearchResources } from '@medplum/react';
import { IconEdit, IconPlus } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useMemo, useState } from 'react';

interface FollowUpMessage {
  hours: number;
  message: string;
}

interface ProviderRate {
  providerId: string;
  providerName: string;
  pricePerUnit: number;
}

interface ServiceConfig {
  numbingTime: number;
  defaultRoom: string;
  roomMovable: boolean;
  minPrice: number;
  maxPrice: number;
  pricePerUnit: boolean;
  unitType: string;
  gfeCategory: string;
  requiresConsult: boolean;
  icon: string;
  color: string;
  category: string;
  depositAmount: number;
  depositReminders: number;
  depositReminderInterval: number;
  followUpSchedule: FollowUpMessage[];
  providerRates: ProviderRate[];
}

interface ServiceFormData {
  id: string;
  name: string;
  title: string;
  description?: string;
  duration: number;
  config: ServiceConfig;
}

const SERVICE_CATEGORIES = [
  { value: 'injection', label: 'Injection' },
  { value: 'laser', label: 'Laser' },
  { value: 'consult', label: 'Consultation' },
  { value: 'other', label: 'Other' },
];

const GFE_CATEGORIES = [
  { value: 'botox', label: 'Botox' },
  { value: 'filler', label: 'Filler' },
  { value: 'laser', label: 'Laser' },
  { value: 'consult', label: 'Consult' },
];

const UNIT_TYPES = [
  { value: 'unit', label: 'Unit' },
  { value: 'syringe', label: 'Syringe' },
  { value: 'area', label: 'Area' },
  { value: 'session', label: 'Session' },
];

function parseServiceConfig(activity: ActivityDefinition): ServiceConfig {
  const ext = activity.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/service-config'
  );

  // Parse follow-up schedule from JSON string
  const followUpScheduleRaw = ext?.extension?.find((e) => e.url === 'followUpSchedule')?.valueString;
  let followUpSchedule: FollowUpMessage[] = [];
  if (followUpScheduleRaw) {
    try {
      followUpSchedule = JSON.parse(followUpScheduleRaw);
    } catch {
      followUpSchedule = [];
    }
  }

  // Parse provider rates from JSON string
  const providerRatesRaw = ext?.extension?.find((e) => e.url === 'providerRates')?.valueString;
  let providerRates: ProviderRate[] = [];
  if (providerRatesRaw) {
    try {
      providerRates = JSON.parse(providerRatesRaw);
    } catch {
      providerRates = [];
    }
  }

  return {
    numbingTime: ext?.extension?.find((e) => e.url === 'numbingTime')?.valueInteger ?? 0,
    defaultRoom: ext?.extension?.find((e) => e.url === 'defaultRoom')?.valueString ?? 'room-1',
    roomMovable: ext?.extension?.find((e) => e.url === 'roomMovable')?.valueBoolean ?? true,
    minPrice: ext?.extension?.find((e) => e.url === 'minPrice')?.valueInteger ?? 0,
    maxPrice: ext?.extension?.find((e) => e.url === 'maxPrice')?.valueInteger ?? 0,
    pricePerUnit: ext?.extension?.find((e) => e.url === 'pricePerUnit')?.valueBoolean ?? false,
    unitType: ext?.extension?.find((e) => e.url === 'unitType')?.valueString ?? 'unit',
    gfeCategory: ext?.extension?.find((e) => e.url === 'gfeCategory')?.valueString ?? '',
    requiresConsult: ext?.extension?.find((e) => e.url === 'requiresConsult')?.valueBoolean ?? false,
    icon: ext?.extension?.find((e) => e.url === 'icon')?.valueString ?? '',
    color: ext?.extension?.find((e) => e.url === 'color')?.valueString ?? 'blue',
    category: ext?.extension?.find((e) => e.url === 'category')?.valueString ?? 'other',
    depositAmount: ext?.extension?.find((e) => e.url === 'depositAmount')?.valueInteger ?? 250,
    depositReminders: ext?.extension?.find((e) => e.url === 'depositReminders')?.valueInteger ?? 4,
    depositReminderInterval: ext?.extension?.find((e) => e.url === 'depositReminderInterval')?.valueInteger ?? 24,
    followUpSchedule,
    providerRates,
  };
}

function buildExtensions(config: ServiceConfig): ActivityDefinition['extension'] {
  const extensions: { url: string; [key: string]: unknown }[] = [
    { url: 'numbingTime', valueInteger: config.numbingTime },
    { url: 'defaultRoom', valueString: config.defaultRoom },
    { url: 'roomMovable', valueBoolean: config.roomMovable },
    { url: 'minPrice', valueInteger: config.minPrice },
    { url: 'maxPrice', valueInteger: config.maxPrice },
    { url: 'pricePerUnit', valueBoolean: config.pricePerUnit },
    { url: 'unitType', valueString: config.unitType },
    { url: 'requiresConsult', valueBoolean: config.requiresConsult },
    { url: 'color', valueString: config.color },
    { url: 'category', valueString: config.category },
    { url: 'depositAmount', valueInteger: config.depositAmount },
    { url: 'depositReminders', valueInteger: config.depositReminders },
    { url: 'depositReminderInterval', valueInteger: config.depositReminderInterval },
  ];

  // Only add optional fields if they have values
  if (config.gfeCategory) {
    extensions.push({ url: 'gfeCategory', valueString: config.gfeCategory });
  }
  if (config.icon) {
    extensions.push({ url: 'icon', valueString: config.icon });
  }
  if (config.followUpSchedule && config.followUpSchedule.length > 0) {
    extensions.push({ url: 'followUpSchedule', valueString: JSON.stringify(config.followUpSchedule) });
  }
  if (config.providerRates && config.providerRates.length > 0) {
    extensions.push({ url: 'providerRates', valueString: JSON.stringify(config.providerRates) });
  }

  return [
    {
      url: 'http://melissaknudson.com/fhir/StructureDefinition/service-config',
      extension: extensions,
    },
  ];
}

function getCategoryBadgeColor(category: string): string {
  switch (category) {
    case 'injection':
      return 'blue';
    case 'laser':
      return 'red';
    case 'consult':
      return 'green';
    default:
      return 'gray';
  }
}

// Helper function to get room display name
function getRoomDisplay(roomValue: string): string {
  if (roomValue === 'room-1') {
    return 'Room 1';
  }
  if (roomValue === 'room-2') {
    return 'Room 2';
  }
  return roomValue;
}

export function ServiceCatalogPage(): JSX.Element {
  const medplum = useMedplum();
  const [opened, { open, close }] = useDisclosure(false);
  const [editingService, setEditingService] = useState<ActivityDefinition | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>({
    id: '',
    name: '',
    title: '',
    duration: 30,
    config: {
      numbingTime: 0,
      defaultRoom: 'room-1',
      roomMovable: true,
      minPrice: 0,
      maxPrice: 0,
      pricePerUnit: false,
      unitType: 'unit',
      gfeCategory: '',
      requiresConsult: false,
      icon: '',
      color: 'blue',
      category: 'other',
      depositAmount: 250,
      depositReminders: 4,
      depositReminderInterval: 24,
      followUpSchedule: [],
      providerRates: [],
    },
  });

  const [servicesResult, loading] = useSearchResources('ActivityDefinition', {
    _sort: 'name',
    _count: '100',
  });

  const services = servicesResult as ActivityDefinition[] | undefined;

  const refresh = useCallback(async () => {
    // Force re-render by modifying state - useSearchResources will refetch
    window.location.reload();
  }, []);

  const allServices = useMemo(() => {
    return services ?? [];
  }, [services]);

  const handleEdit = useCallback(
    (service: ActivityDefinition) => {
      setEditingService(service);
      const config = parseServiceConfig(service);
      setFormData({
        id: service.id ?? '',
        name: service.name ?? '',
        title: service.title ?? '',
        description: service.description,
        duration: service.timingDuration?.value ?? 30,
        config,
      });
      open();
    },
    [open]
  );

  const handleCreate = useCallback(() => {
    setEditingService(null);
    setFormData({
      id: '',
      name: '',
      title: '',
      duration: 30,
      config: {
        numbingTime: 0,
        defaultRoom: 'room-1',
        roomMovable: true,
        minPrice: 0,
        maxPrice: 0,
        pricePerUnit: false,
        unitType: 'unit',
        gfeCategory: '',
        requiresConsult: false,
        icon: '',
        color: 'blue',
        category: 'other',
        depositAmount: 250,
        depositReminders: 4,
        depositReminderInterval: 24,
        followUpSchedule: [],
        providerRates: [],
      },
    });
    open();
  }, [open]);

  const handleSave = useCallback(async () => {
    try {
      if (editingService) {
        // Update existing
        await medplum.updateResource<ActivityDefinition>({
          ...editingService,
          name: formData.name,
          title: formData.title,
          description: formData.description,
          timingDuration: { value: formData.duration, unit: 'min' },
          extension: buildExtensions(formData.config),
        });
        showNotification({ title: 'Success', message: 'Service updated', color: 'green' });
      } else {
        // Create new
        await medplum.createResource<ActivityDefinition>({
          resourceType: 'ActivityDefinition',
          status: 'active',
          name: formData.name,
          title: formData.title,
          description: formData.description,
          kind: 'ServiceRequest',
          code: {
            coding: [
              {
                system: 'http://melissaknudson.com/services',
                code: formData.name.toLowerCase().replace(/\s+/g, '-'),
                display: formData.title,
              },
            ],
            text: formData.title,
          },
          timingDuration: { value: formData.duration, unit: 'min' },
          extension: buildExtensions(formData.config),
        });
        showNotification({ title: 'Success', message: 'Service created', color: 'green' });
      }
      close();
      await refresh();
    } catch (err) {
      showNotification({
        title: 'Error',
        message: normalizeErrorString(err),
        color: 'red',
      });
    }
  }, [medplum, editingService, formData, close, refresh]);

  const handleToggleStatus = useCallback(
    async (service: ActivityDefinition) => {
      try {
        await medplum.updateResource<ActivityDefinition>({
          ...service,
          status: service.status === 'active' ? 'retired' : 'active',
        });
        showNotification({
          title: 'Success',
          message: `Service ${service.status === 'active' ? 'deactivated' : 'activated'}`,
          color: 'green',
        });
        await refresh();
      } catch (err) {
        showNotification({
          title: 'Error',
          message: normalizeErrorString(err),
          color: 'red',
        });
      }
    },
    [medplum, refresh]
  );

  // Render table body content
  const renderTableBody = (): JSX.Element => {
    if (loading) {
      return (
        <Table.Tr>
          <Table.Td colSpan={10}>
            <Text ta="center">Loading...</Text>
          </Table.Td>
        </Table.Tr>
      );
    }

    if (allServices.length === 0) {
      return (
        <Table.Tr>
          <Table.Td colSpan={10}>
            <Text ta="center" c="dimmed">
              No services found. Create your first service.
            </Text>
          </Table.Td>
        </Table.Tr>
      );
    }

    return (
      <>
        {allServices.map((service) => {
          const config = parseServiceConfig(service);
          const priceText = config.pricePerUnit
            ? `$${config.minPrice}-$${config.maxPrice} per ${config.unitType}`
            : `$${config.minPrice} flat`;

          return (
            <Table.Tr key={service.id}>
              <Table.Td>
                <Group gap="xs">
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: config.color,
                    }}
                  />
                  <Text fw={500}>{service.title}</Text>
                </Group>
              </Table.Td>
              <Table.Td>
                <Badge color={getCategoryBadgeColor(config.category)}>{config.category}</Badge>
              </Table.Td>
              <Table.Td>{service.timingDuration?.value || 30} min</Table.Td>
              <Table.Td>
                {config.numbingTime > 0 ? `${config.numbingTime} min` : 'None'}
              </Table.Td>
              <Table.Td>{priceText}</Table.Td>
              <Table.Td>
                <Badge variant="light">${config.depositAmount}</Badge>
              </Table.Td>
              <Table.Td>
                <Badge variant="light">{config.gfeCategory || 'N/A'}</Badge>
              </Table.Td>
              <Table.Td>
                {getRoomDisplay(config.defaultRoom)}
                {config.roomMovable && (
                  <Text size="xs" c="dimmed">
                    (movable)
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Switch
                  checked={service.status === 'active'}
                  onChange={() => handleToggleStatus(service)}
                  size="sm"
                />
              </Table.Td>
              <Table.Td>
                <Button variant="light" size="xs" onClick={() => handleEdit(service)}>
                  <IconEdit size={14} />
                </Button>
              </Table.Td>
            </Table.Tr>
          );
        })}
      </>
    );
  };


  return (
    <Stack gap="md" p="md">
      <Group justify="space-between">
        <Title order={2}>Service Catalog</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
          Add Service
        </Button>
      </Group>

      <Text size="sm" c="dimmed">
        Manage services available for booking. Configure duration, pricing, room requirements, GFE categories, and
        deposit settings.
      </Text>

      <Card withBorder>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Service</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th>Duration</Table.Th>
              <Table.Th>Numbing</Table.Th>
              <Table.Th>Price Range</Table.Th>
              <Table.Th>Deposit</Table.Th>
              <Table.Th>GFE</Table.Th>
              <Table.Th>Room</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
<Table.Tbody>{renderTableBody()}</Table.Tbody>
        </Table>
      </Card>

      {/* Edit/Create Modal */}
      <Modal opened={opened} onClose={close} title={editingService ? 'Edit Service' : 'Create Service'} size="lg">
        <Stack>
          <TextInput
            label="Service Name"
            description="Internal name (e.g., 'botox-cosmetic')"
            value={formData.name}
            onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
            disabled={!!editingService}
            required
          />

          <TextInput
            label="Display Title"
            description="What patients see (e.g., 'Botox Cosmetic')"
            value={formData.title}
            onChange={(e) => setFormData((d) => ({ ...d, title: e.target.value }))}
            required
          />

          <TextInput
            label="Description"
            value={formData.description ?? ''}
            onChange={(e) => setFormData((d) => ({ ...d, description: e.target.value }))}
          />

          <Group grow>
            <NumberInput
              label="Duration (minutes)"
              value={formData.duration}
              onChange={(val) => setFormData((d) => ({ ...d, duration: Number(val) || 30 }))}
              min={15}
              max={360}
              step={15}
              required
            />

            <NumberInput
              label="Numbing Time (minutes)"
              value={formData.config.numbingTime}
              onChange={(val) =>
                setFormData((d) => ({
                  ...d,
                  config: { ...d.config, numbingTime: Number(val) || 0 },
                }))
              }
              min={0}
              max={120}
              step={15}
            />
          </Group>

          <Select
            label="Category"
            value={formData.config.category}
            onChange={(val) =>
              setFormData((d) => ({
                ...d,
                config: { ...d.config, category: val || 'other' },
              }))
            }
            data={SERVICE_CATEGORIES}
            required
          />

          <Select
            label="GFE Category"
            value={formData.config.gfeCategory}
            onChange={(val) =>
              setFormData((d) => ({
                ...d,
                config: { ...d.config, gfeCategory: val || '' },
              }))
            }
            data={GFE_CATEGORIES}
            clearable
          />

          <Group grow>
            <Select
              label="Default Room"
              value={formData.config.defaultRoom}
              onChange={(val) =>
                setFormData((d) => ({
                  ...d,
                  config: { ...d.config, defaultRoom: val || 'room-1' },
                }))
              }
              data={[
                { value: 'room-1', label: 'Treatment Room 1' },
                { value: 'room-2', label: 'Treatment Room 2' },
              ]}
            />

            <Switch
              label="Room Movable"
              checked={formData.config.roomMovable}
              onChange={(e) =>
                setFormData((d) => ({
                  ...d,
                  config: { ...d.config, roomMovable: e.currentTarget.checked },
                }))
              }
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Min Price ($)"
              value={formData.config.minPrice}
              onChange={(val) =>
                setFormData((d) => ({
                  ...d,
                  config: { ...d.config, minPrice: Number(val) || 0 },
                }))
              }
              min={0}
            />

            <NumberInput
              label="Max Price ($)"
              value={formData.config.maxPrice}
              onChange={(val) =>
                setFormData((d) => ({
                  ...d,
                  config: { ...d.config, maxPrice: Number(val) || 0 },
                }))
              }
              min={0}
            />
          </Group>

          <Group grow>
            <Switch
              label="Price Per Unit"
              checked={formData.config.pricePerUnit}
              onChange={(e) =>
                setFormData((d) => ({
                  ...d,
                  config: { ...d.config, pricePerUnit: e.currentTarget.checked },
                }))
              }
            />

            <Select
              label="Unit Type"
              value={formData.config.unitType}
              onChange={(val) =>
                setFormData((d) => ({
                  ...d,
                  config: { ...d.config, unitType: val || 'unit' },
                }))
              }
              data={UNIT_TYPES}
              disabled={!formData.config.pricePerUnit}
            />
          </Group>

          <Switch
            label="Requires Consult"
            description="Patient must have current GFE for this category"
            checked={formData.config.requiresConsult}
            onChange={(e) =>
              setFormData((d) => ({
                ...d,
                config: { ...d.config, requiresConsult: e.currentTarget.checked },
              }))
            }
          />

          <Title order={4} mt="md">
            Deposit Settings
          </Title>

          <Group grow>
            <NumberInput
              label="Deposit Amount ($)"
              description="Default deposit for this service"
              value={formData.config.depositAmount}
              onChange={(val) =>
                setFormData((d) => ({
                  ...d,
                  config: { ...d.config, depositAmount: Number(val) || 250 },
                }))
              }
              min={0}
              max={10000}
              step={25}
            />

            <NumberInput
              label="Max Reminders"
              description="# of deposit reminders (max 4)"
              value={formData.config.depositReminders}
              onChange={(val) => {
                const numVal = Number(val) || 4;
                setFormData((d) => ({
                  ...d,
                  config: { ...d.config, depositReminders: Math.min(numVal, 4) },
                }));
              }}
              min={1}
              max={4}
              step={1}
            />

            <NumberInput
              label="Reminder Interval (hours)"
              description="Hours between reminders"
              value={formData.config.depositReminderInterval}
              onChange={(val) =>
                setFormData((d) => ({
                  ...d,
                  config: { ...d.config, depositReminderInterval: Number(val) || 24 },
                }))
              }
              min={1}
              max={72}
              step={1}
            />
          </Group>

          <ColorInput
            label="Color"
            value={formData.config.color}
            onChange={(val) =>
              setFormData((d) => ({
                ...d,
                config: { ...d.config, color: val },
              }))
            }
          />

          <Group justify="flex-end" mt="md">
            <Button variant="light" color="gray" onClick={close}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editingService ? 'Update' : 'Create'}</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
