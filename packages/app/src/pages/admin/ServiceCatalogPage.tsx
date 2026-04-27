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
import type { ServiceConfig } from '../../utils/fhir-extensions';
import { buildServiceConfigExtensions, parseServiceConfig } from '../../utils/fhir-extensions';
import { EQUIPMENT_TYPES, getEquipmentLabel } from '../../admin/equipmentTypes';

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
  { value: 'prep', label: 'Prep' },
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

function getCategoryBadgeColor(category: string): string {
  switch (category) {
    case 'injection':
      return 'blue';
    case 'laser':
      return 'red';
    case 'consult':
      return 'green';
    case 'prep':
      return 'gray';
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
      equipmentRequirements: [],
      recommendedAccompanyingServices: [],
      internalCost: { productCost: 0, costPerUnit: false, unitType: 'unit' },
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
        equipmentRequirements: [],
        recommendedAccompanyingServices: [],
        internalCost: { productCost: 0, costPerUnit: false, unitType: 'unit' },
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
          extension: buildServiceConfigExtensions(formData.config),
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
          extension: buildServiceConfigExtensions(formData.config),
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
          <Table.Td colSpan={12}>
            <Text ta="center">Loading...</Text>
          </Table.Td>
        </Table.Tr>
      );
    }

    if (allServices.length === 0) {
      return (
        <Table.Tr>
          <Table.Td colSpan={12}>
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
              <Table.Td>{config.numbingTime > 0 ? `${config.numbingTime} min` : 'None'}</Table.Td>
              <Table.Td>{priceText}</Table.Td>
              <Table.Td>
                <Badge variant="light" color="teal">
                  ${config.internalCost?.productCost ?? 0}
                  {config.internalCost?.costPerUnit && (
                    <Text component="span" size="xs"> /{config.internalCost?.unitType || config.unitType || 'unit'}</Text>
                  )}
                </Badge>
              </Table.Td>
              <Table.Td>
                {config.equipmentRequirements && config.equipmentRequirements.length > 0 ? (
                  <Group gap={4}>
                    {config.equipmentRequirements.slice(0, 2).map((eq, i) => (
                      <Badge key={i} size="xs" variant="light" color="blue">
                        {getEquipmentLabel(eq.equipmentType)}
                        {!eq.movable && ' ⚓'}
                      </Badge>
                    ))}
                    {config.equipmentRequirements.length > 2 && (
                      <Text size="xs" c="dimmed">
                        +{config.equipmentRequirements.length - 2}
                      </Text>
                    )}
                  </Group>
                ) : (
                  <Text size="xs" c="dimmed">
                    None
                  </Text>
                )}
              </Table.Td>
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
              <Table.Th>Internal Cost</Table.Th>
              <Table.Th>Equipment</Table.Th>
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
      <Modal opened={opened} onClose={close} title={editingService ? 'Edit Service' : 'Create Service'} size="xl">
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

          <Title order={4} mt="md">
            Internal Cost Tracking
          </Title>
          <Stack gap="xs">
            <Group grow>
              <NumberInput
                label="Product Cost ($)"
                description={formData.config.internalCost?.costPerUnit ? `Cost per ${formData.config.internalCost?.unitType || formData.config.unitType || 'unit'}` : 'Flat cost per service'}
                value={formData.config.internalCost?.productCost ?? 0}
                onChange={(val) =>
                  setFormData((d) => ({
                    ...d,
                    config: {
                      ...d.config,
                      internalCost: {
                        ...(d.config.internalCost ?? { productCost: 0, costPerUnit: false }),
                        productCost: Number(val) || 0,
                      },
                    },
                  }))
                }
                min={0}
                step={formData.config.internalCost?.costPerUnit ? 1 : 5}
              />
            </Group>
            <Group>
              <Switch
                label="Cost is per unit"
                description="Cost scales with units used (e.g., per Botox unit)"
                checked={formData.config.internalCost?.costPerUnit ?? false}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    config: {
                      ...d.config,
                      internalCost: {
                        ...(d.config.internalCost ?? { productCost: 0 }),
                        costPerUnit: e.currentTarget.checked,
                        unitType: e.currentTarget.checked ? (d.config.unitType || 'unit') : undefined,
                      },
                    },
                  }))
                }
              />
              {formData.config.internalCost?.costPerUnit && (
                <Text size="sm" c="dimmed">
                  e.g., 35 units × ${formData.config.internalCost?.productCost} = ${35 * (formData.config.internalCost?.productCost || 0)} total cost
                </Text>
              )}
            </Group>
          </Stack>

          <Title order={4} mt="md">
            Equipment Requirements
          </Title>
          <Text size="sm" c="dimmed" mb="xs">
            Equipment required for this service
          </Text>
          <Stack gap="xs">
            {(formData.config.equipmentRequirements?.length ?? 0) === 0 ? (
              <Text size="sm" c="dimmed">
                No equipment requirements. Add equipment below.
              </Text>
            ) : (
              formData.config.equipmentRequirements?.map((req, index) => (
                <Card key={index} withBorder p="xs">
                  <Group align="flex-start">
                    <Select
                      label="Equipment Type"
                      value={req.equipmentType}
                      onChange={(val) =>
                        setFormData((d) => {
                          const newReqs = [...(d.config.equipmentRequirements ?? [])];
                          newReqs[index] = { ...req, equipmentType: val || '' };
                          return {
                            ...d,
                            config: { ...d.config, equipmentRequirements: newReqs },
                          };
                        })
                      }
                      data={EQUIPMENT_TYPES.map((t) => ({
                        value: t.code,
                        label: t.label,
                      }))}
                      style={{ flex: 1 }}
                      searchable
                      clearable
                      placeholder="Select equipment type..."
                    />
                    <Switch
                      label="Required"
                      checked={req.required}
                      onChange={(e) =>
                        setFormData((d) => {
                          const newReqs = [...(d.config.equipmentRequirements ?? [])];
                          newReqs[index] = { ...req, required: e.currentTarget.checked };
                          return {
                            ...d,
                            config: { ...d.config, equipmentRequirements: newReqs },
                          };
                        })
                      }
                    />
                    <Switch
                      label="Movable"
                      checked={req.movable}
                      onChange={(e) =>
                        setFormData((d) => {
                          const newReqs = [...(d.config.equipmentRequirements ?? [])];
                          newReqs[index] = { ...req, movable: e.currentTarget.checked };
                          return {
                            ...d,
                            config: { ...d.config, equipmentRequirements: newReqs },
                          };
                        })
                      }
                    />
                    <Button
                      color="red"
                      variant="light"
                      size="xs"
                      onClick={() =>
                        setFormData((d) => {
                          const newReqs = (d.config.equipmentRequirements ?? []).filter(
                            (_, i) => i !== index
                          );
                          return {
                            ...d,
                            config: { ...d.config, equipmentRequirements: newReqs },
                          };
                        })
                      }
                    >
                      Remove
                    </Button>
                  </Group>
                </Card>
              ))
            )}
            <Button
              variant="light"
              size="sm"
              onClick={() =>
                setFormData((d) => ({
                  ...d,
                  config: {
                    ...d.config,
                    equipmentRequirements: [
                      ...(d.config.equipmentRequirements ?? []),
                      { equipmentType: '', required: true, movable: true },
                    ],
                  },
                }))
              }
            >
              + Add Equipment Requirement
            </Button>
          </Stack>

          <Title order={4} mt="md">
            Recommended Accompanying Services
          </Title>
          <Text size="sm" c="dimmed" mb="xs">
            Services automatically suggested when this service is selected (e.g., numbing)
          </Text>
          <Stack gap="xs">
            {(formData.config.recommendedAccompanyingServices?.length ?? 0) === 0 ? (
              <Text size="sm" c="dimmed">
                No recommended services. Add recommendations below.
              </Text>
            ) : (
              formData.config.recommendedAccompanyingServices?.map((rec, index) => (
                <Card key={index} withBorder p="xs">
                  <Group align="flex-start">
                    <Select
                      label="Service"
                      placeholder="Select accompanying service..."
                      value={rec.serviceCode}
                      onChange={(val) =>
                        setFormData((d) => {
                          const newRecs = [...(d.config.recommendedAccompanyingServices ?? [])];
                          newRecs[index] = { ...rec, serviceCode: val || '' };
                          return {
                            ...d,
                            config: { ...d.config, recommendedAccompanyingServices: newRecs },
                          };
                        })
                      }
                      data={allServices
                        .filter((s) => s.name !== formData.name) // Can't recommend self
                        .map((s) => ({
                          value: s.name || '',
                          label: s.title || s.name || 'Unknown',
                        }))}
                      style={{ flex: 1 }}
                      searchable
                      clearable
                    />
                    <Select
                      label="Timing"
                      value={rec.timing}
                      onChange={(val) =>
                        setFormData((d) => {
                          const newRecs = [...(d.config.recommendedAccompanyingServices ?? [])];
                          newRecs[index] = { ...rec, timing: (val as 'before' | 'after' | 'concurrent') ?? 'before' };
                          return {
                            ...d,
                            config: { ...d.config, recommendedAccompanyingServices: newRecs },
                          };
                        })
                      }
                      data={[
                        { value: 'before', label: 'Before' },
                        { value: 'after', label: 'After' },
                        { value: 'concurrent', label: 'Concurrent' },
                      ]}
                    />
                    <NumberInput
                      label="Offset (min)"
                      value={rec.offsetMinutes}
                      onChange={(val) =>
                        setFormData((d) => {
                          const newRecs = [...(d.config.recommendedAccompanyingServices ?? [])];
                          newRecs[index] = { ...rec, offsetMinutes: Number(val) || 0 };
                          return {
                            ...d,
                            config: { ...d.config, recommendedAccompanyingServices: newRecs },
                          };
                        })
                      }
                      w={100}
                    />
                    <Button
                      color="red"
                      variant="light"
                      size="xs"
                      onClick={() =>
                        setFormData((d) => {
                          const newRecs = (d.config.recommendedAccompanyingServices ?? []).filter(
                            (_, i) => i !== index
                          );
                          return {
                            ...d,
                            config: { ...d.config, recommendedAccompanyingServices: newRecs },
                          };
                        })
                      }
                    >
                      Remove
                    </Button>
                  </Group>
                </Card>
              ))
            )}
            <Button
              variant="light"
              size="sm"
              onClick={() =>
                setFormData((d) => ({
                  ...d,
                  config: {
                    ...d.config,
                    recommendedAccompanyingServices: [
                      ...(d.config.recommendedAccompanyingServices ?? []),
                      { serviceCode: '', timing: 'before', offsetMinutes: 15 },
                    ],
                  },
                }))
              }
            >
              + Add Recommended Service
            </Button>
          </Stack>

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
