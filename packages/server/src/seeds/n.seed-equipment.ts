// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Create equipment
 * Seed initial equipment for the practice
 */

async function createEquipment(
  systemRepo: SystemRepository,
  project: Project,
  type: string,
  name: string,
  serialNumber: string,
  assignedRoomId?: string
): Promise<Device> {
  const existing = await systemRepo.searchOne<Device>({
    resourceType: 'Device',
    filters: [{ code: 'name', operator: 'eq', value: name }],
  });

  if (existing) {
    globalLogger.info(`Equipment ${name} already exists: ${existing.id}`);
    return existing;
  }

  const code = EQUIPMENT_TYPES.find((t) => t.label.toLowerCase().includes(type.toLowerCase()))?.code || 'other';
  const uniqueCode = generateEquipmentCode(code, []); // Simplified for seeding

  return systemRepo.createResource<Device>({
    resourceType: 'Device',
    meta: { project: project.id },
    deviceName: [{ name, type: { coding: [{ system: 'http://melissaknudson.com/equipment-type', code, display: name }] } }],
    identifier: [
      { system: 'http://melissaknudson.com/equipment-code', value: uniqueCode },
      { system: 'http://melissaknudson.com/serial-number', value: serialNumber },
    ],
    status: 'active',
    location: assignedRoomId ? { reference: `Location/${assignedRoomId}` } : undefined,
    extension: [
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/purchase-date',
        valueDate: dayjs().format('YYYY-MM-DD'),
      },
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/purchase-cost',
        valueMoney: { currency: 'USD', value: Math.floor(Math.random() * 20000) + 5000 }, // Random cost $5-25k
      },
    ],
  });
}

// Call this in seed function
async function createEquipmentForPractice(systemRepo: SystemRepository, project: Project, room1: Location, room2: Location): Promise<void> {
  // Create several equipment items
  await createEquipment(systemRepo, project, 'laser-hair-removal', 'Cynosure Elite+ Laser', 'SN-2024-001', room1.id);
  await createEquipment(systemRepo, project, 'laser-hair-removal', 'Lumenis Lightsheer', 'SN-2024-002', room2.id);
  await createEquipment(systemRepo, project, 'botox-station', 'Botox Supply Station #1', 'N/A'); // Floating
  await createEquipment(systemRepo, project, 'filler-cart', 'Dermal Filler Cart Primary', 'N/A', room1.id);
  await createEquipment(systemRepo, project, 'photo-setup', 'Photography Setup Kit', 'N/A'); // Floating
  await createEquipment(systemRepo, project, 'numbing-station', 'Numbing Cream Station', 'N/A', room2.id);
  await createEquipment(systemRepo, project, 'emergency-kit', 'Emergency Response Kit', 'N/A'); // Floating
  
  globalLogger.info('Equipment seeding completed for practice');
}
