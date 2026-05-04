// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Group, NumberInput, Stack, Text, Textarea, Title } from '@mantine/core';
import type { JSX } from 'react';

interface FillerTreatmentFormProps {
  onChange: (data: FillerTreatmentData) => void;
  value: FillerTreatmentData;
  readonly?: boolean;
}

export interface FillerTreatmentData {
  productBrand?: string;
  productType?: string;
  syringes?: number;
  areas: string[];
  notes?: string;
}

const FILLER_AREAS = [
  { id: 'lips', label: 'Lips' },
  { id: 'cheeks', label: 'Cheeks' },
  { id: 'nasolabial', label: 'Nasolabial Folds' },
  { id: 'marionette', label: 'Marionette Lines' },
  { id: 'chin', label: 'Chin' },
  { id: 'jawline', label: 'Jawline' },
  { id: 'temples', label: 'Temples' },
  { id: 'under-eyes', label: 'Under Eyes' },
];

const FILLER_PRODUCTS = [
  { brand: 'Juvederm', types: ['Ultra', 'Ultra Plus', 'Voluma', 'Volbella', 'Vollure'] },
  { brand: 'Restylane', types: ['Lyft', 'Defyne', 'Refyne', 'Kysse', 'Silk'] },
  { brand: 'Radiesse', types: ['1.5ml', '3ml'] },
  { brand: 'Belotero', types: ['Balance'] },
  { brand: 'Sculptra', types: ['Standard'] },
];

export function FillerTreatmentForm({ onChange, value, readonly }: FillerTreatmentFormProps): JSX.Element {
  const handleAreaToggle = (areaId: string): void => {
    const newAreas = value.areas.includes(areaId)
      ? value.areas.filter(a => a !== areaId)
      : [...value.areas, areaId];
    onChange({ ...value, areas: newAreas });
  };

  const availableTypes = FILLER_PRODUCTS.find(p => p.brand === value.productBrand)?.types || [];

  return (
    <Stack gap="md">
      <Title order={5}>
        Dermal Filler Treatment
      </Title>

      {/* Product Brand */}
      <Group>
        <Text size="sm" fw={500} w={120}>Product Brand:</Text>
        {readonly ? (
          <Text>{value.productBrand || '—'}</Text>
        ) : (
          <select
            value={value.productBrand || ''}
            onChange={(e) => onChange({ ...value, productBrand: e.target.value, productType: undefined })}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
            disabled={readonly}
          >
            <option value="">Select brand...</option>
            {FILLER_PRODUCTS.map(p => (
              <option key={p.brand} value={p.brand}>{p.brand}</option>
            ))}
          </select>
        )}
      </Group>

      {/* Product Type */}
      {value.productBrand && (
        <Group>
          <Text size="sm" fw={500} w={120}>Product Type:</Text>
          {readonly ? (
            <Text>{value.productType || '—'}</Text>
          ) : (
            <select
              value={value.productType || ''}
              onChange={(e) => onChange({ ...value, productType: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
              disabled={readonly || availableTypes.length === 0}
            >
              <option value="">Select type...</option>
              {availableTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </Group>
      )}

      {/* Syringes */}
      <Group>
        <Text size="sm" fw={500} w={120}>Syringes Used:</Text>
        {readonly ? (
          <Text>{value.syringes ?? '—'}</Text>
        ) : (
          <NumberInput
            value={value.syringes}
            onChange={(val) => onChange({ ...value, syringes: typeof val === 'number' ? val : undefined })}
            min={0}
            max={20}
            step={0.5}
            disabled={readonly}
            w={100}
          />
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
          {FILLER_AREAS.map((area) => (
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
            placeholder="Enter treatment notes, injection technique, or observations..."
            minRows={4}
            disabled={readonly}
          />
        )}
      </Box>
    </Stack>
  );
}
