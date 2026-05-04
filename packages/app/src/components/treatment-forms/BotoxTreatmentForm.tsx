// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Group, NumberInput, Stack, Text, Textarea, Title } from '@mantine/core';
import type { JSX } from 'react';

interface BotoxTreatmentFormProps {
  onChange: (data: BotoxTreatmentData) => void;
  value: BotoxTreatmentData;
  readonly?: boolean;
}

export interface BotoxTreatmentData {
  totalUnits?: number;
  areas: string[];
  productBrand?: string;
  notes?: string;
}

const BOTOX_AREAS = [
  { id: 'forehead', label: 'Forehead' },
  { id: 'glabella', label: 'Glabella (11s)' },
  { id: 'crows-feet', label: 'Crows Feet' },
  { id: 'brow-lift', label: 'Brow Lift' },
  { id: 'bunny-lines', label: 'Bunny Lines' },
  { id: 'lip-flip', label: 'Lip Flip' },
  { id: 'masseter', label: 'Masseter (TMJ)' },
  { id: 'chin', label: 'Chin Dimpling' },
  { id: 'neck', label: 'Neck Bands' },
];

export function BotoxTreatmentForm({ onChange, value, readonly }: BotoxTreatmentFormProps): JSX.Element {
  const handleAreaToggle = (areaId: string): void => {
    const newAreas = value.areas.includes(areaId)
      ? value.areas.filter(a => a !== areaId)
      : [...value.areas, areaId];
    onChange({ ...value, areas: newAreas });
  };

  return (
    <Stack gap="md">
      <Title order={5}>
        Botox Treatment
      </Title>

      {/* Product Brand */}
      <Group>
        <Text size="sm" fw={500} w={120}>Product Brand:</Text>
        {readonly ? (
          <Text>{value.productBrand || '—'}</Text>
        ) : (
          <select
            value={value.productBrand || ''}
            onChange={(e) => onChange({ ...value, productBrand: e.target.value })}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
            disabled={readonly}
          >
            <option value="">Select brand...</option>
            <option value="Botox">Botox (Allergan)</option>
            <option value="Dysport">Dysport (Galderma)</option>
            <option value="Xeomin">Xeomin (Merz)</option>
            <option value="Jeuveau">Jeuveau (Evolus)</option>
            <option value="Daxxify">Daxxify (Revance)</option>
          </select>
        )}
      </Group>

      {/* Treatment Areas */}
      <Box>
        <Text size="sm" fw={500} mb="xs">Treatment Areas:</Text>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
          }}
        >
          {BOTOX_AREAS.map((area) => (
            <label
              key={area.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                borderRadius: '4px',
                background: value.areas.includes(area.id) ? '#e7f5ff' : '#f8f9fa',
                border: value.areas.includes(area.id) ? '1px solid #339af0' : '1px solid #e9ecef',
                cursor: readonly ? 'default' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={value.areas.includes(area.id)}
                onChange={() => handleAreaToggle(area.id)}
                disabled={readonly}
                style={{ cursor: readonly ? 'default' : 'pointer' }}
              />
              <Text size="sm">{area.label}</Text>
            </label>
          ))}
        </div>
      </Box>

      {/* Total Units */}
      <Group>
        <Text size="sm" fw={500} w={120}>Total Units:</Text>
        {readonly ? (
          <Text>{value.totalUnits ?? '—'}</Text>
        ) : (
          <NumberInput
            value={value.totalUnits}
            onChange={(val) => onChange({ ...value, totalUnits: typeof val === 'number' ? val : undefined })}
            min={0}
            max={500}
            disabled={readonly}
            w={100}
          />
        )}
      </Group>

      {/* Notes */}
      <Box>
        <Text size="sm" fw={500} mb="xs">Treatment Notes:</Text>
        {readonly ? (
          <Box p="xs" bg="gray.0" style={{ borderRadius: '4px', minHeight: '60px' }}>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {value.notes || 'No notes recorded'}
            </Text>
          </Box>
        ) : (
          <Textarea
            value={value.notes || ''}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            placeholder="Enter treatment notes, patient reactions, or observations..."
            minRows={4}
            disabled={readonly}
          />
        )}
      </Box>
    </Stack>
  );
}
