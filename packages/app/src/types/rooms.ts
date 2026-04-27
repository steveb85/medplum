// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Room type definitions for the room management system.
 */

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  status: 'active' | 'inactive';
  hasLaser?: boolean;
}

export type RoomType = 'treatment' | 'waiting' | 'numbing' | 'photo' | 'other';

export const ROOM_TYPES: { code: RoomType; label: string }[] = [
  { code: 'treatment', label: 'Treatment Room' },
  { code: 'waiting', label: 'Waiting Room' },
  { code: 'numbing', label: 'Numbing Room' },
  { code: 'photo', label: 'Photo Room' },
  { code: 'other', label: 'Other Room' },
];

export function getRoomTypeLabel(type: RoomType): string {
  return ROOM_TYPES.find((t) => t.code === type)?.label || 'Unknown Room';
}

export function getRoomTypeColor(type: RoomType): string {
  const colors: Record<RoomType, string> = {
    treatment: 'blue',
    waiting: 'gray',
    numbing: 'yellow',
    photo: 'purple',
    other: 'orange',
  };
  return colors[type] || 'gray';
}
