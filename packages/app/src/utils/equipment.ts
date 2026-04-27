// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { EquipmentType } from './equipmentTypes';

/**
 * Equipment utility functions for managing equipment resources.
 */

export interface EquipmentItem {
  id?: string;
  resourceType: 'Device';
  type: EquipmentType['code'];
  uniqueCode: string; // Auto-generated: CODE-SEQUENCE
  name: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  status: 'active' | 'maintenance' | 'retired';
  assignedRoomId?: string; // null for floating
}

export interface EquipmentUsage {
  bookingCount: number;
  totalHours: number;
  totalCost: number;
  bookingIds: string[];
}

/**
 * Generate unique equipment code.
 * Format: {TYPE}-{SEQUENCE} (per-type numbering)
 * Example: laser-hair-removal-002, filler-cart-001, etc.
 */
export function generateEquipmentCode(typeCode: string, existingCodes: string[]): string {
  const prefix = `${typeCode}-`;
  const existingSequences = existingCodes
    .filter((code) => code.startsWith(prefix))
    .map((code) => {
      const parts = code.split('-');
      const lastPart = parts[parts.length - 1];
      return parseInt(lastPart, 10);
    })
    .filter((num) => !isNaN(num));

  const nextSequence = existingSequences.length > 0 ? Math.max(...existingSequences) + 1 : 1;
  return `${prefix}${String(nextSequence).padStart(3, '0')}`;
}

/**
 * Check if equipment can be used (soft delete = retired)
 */
export function isEquipmentAvailable(equipment: EquipmentItem): boolean {
  return equipment.status === 'active';
}

/**
 * Format equipment for display in lists/dropdowns.
 * Format: "Equipment Name (Room Name)" or just "Equipment Name" if floating
 */
export function formatEquipmentDisplay(
  equipment: EquipmentItem,
  getRoomName: (roomId: string) => string
): string {
  if (equipment.assignedRoomId) {
    const roomName = getRoomName(equipment.assignedRoomId);
    return `${equipment.name} (${roomName})`;
  }
  return equipment.name;
}

/**
 * Filter equipment for booking dropdown.
 * Rules:
 * - Only active equipment
 * - Show both room-assigned and floating
 * - For room-assigned, format as "Name (Room)"
 */
export function getAvailableEquipmentForBooking(
  equipment: EquipmentItem[],
  selectedRoomId?: string,
  getRoomName: (roomId: string) => string
): EquipmentItem[] {
  return equipment.filter(isEquipmentAvailable).map((item) => ({
    ...item,
    displayName: formatEquipmentDisplay(item, getRoomName),
  }));
}

/**
 * Track equipment usage from booking data.
 * Returns: count of bookings, total hours, total cost, booking IDs
 */
export function calculateEquipmentUsage(
  equipmentId: string,
  bookings: { id: string; duration: number; cost: number; equipmentIds: string[] }[]
): EquipmentUsage {
  const filtered = bookings.filter((b) => b.equipmentIds.includes(equipmentId));
  return {
    bookingCount: filtered.length,
    totalHours: filtered.reduce((sum, b) => sum + b.duration, 0),
    totalCost: filtered.reduce((sum, b) => sum + b.cost, 0),
    bookingIds: filtered.map((b) => b.id),
  };
}
