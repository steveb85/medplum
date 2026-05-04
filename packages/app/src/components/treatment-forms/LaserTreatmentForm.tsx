// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Group, NumberInput, Stack, Text, Textarea, Title } from '@mantine/core';
import type { JSX } from 'react';

interface LaserTreatmentFormProps {
  onChange: (data: LaserTreatmentData) => void;
  value: LaserTreatmentData;
  readonly?: boolean;
}

export interface LaserTreatmentData {
  deviceName?: string;
  treatmentType?: string;
  settings?: string;
  fluence?: number;
  pulseDuration?: number;
  spotSize?: number;
  areas: string[];
  passes?: number;
  notes?: string;
}

const LASER_AREAS = [
  { id: 'face-full', label: 'Face (Full)' },
  { id: 'face-partial', label: 'Face (Partial)' },
  { id: 'neck', label: 'Neck' },
  { id: 'chest', label: 'Chest/Décolletage' },
  { id: 'hands', label: 'Hands' },
  { id: 'arms', label: 'Arms' },
  { id: 'legs', label: 'Legs' },
  { id: 'back', label: 'Back' },
  { id: 'abdomen', label: 'Abdomen' },
];

const LASER_DEVICES = [
  'Fraxel',
  'Clear + Brilliant',
  'CO2 Laser',
  'Erbium Laser',
  'IPL/Photofacial',
  'Nd:YAG',
  'Alexandrite',
  'Diode',
  'PicoSure',
  'PicoWay',
  'VBeam',
];

const TREATMENT_TYPES: Record<string, string[]> = {
  'Fraxel': ['Fractional Resurfacing', 'Non-Ablative'],
  'Clear + Brilliant': ['Perméa', 'Original'],
  'CO2 Laser': ['Fractional', 'Fully Ablative'],
  'Erbium Laser': ['Fractional', 'Fully Ablative'],
  'IPL/Photofacial': ['Skin Rejuvenation', 'Pigment', 'Vascular'],
  'Nd:YAG': ['Hair Removal', 'Vascular', 'Skin Tightening'],
  'Alexandrite': ['Hair Removal', 'Pigment'],
  'Diode': ['Hair Removal'],
  'PicoSure': ['Tattoo Removal', 'Skin Rejuvenation', 'Pigment'],
  'PicoWay': ['Tattoo Removal', 'Skin Rejuvenation', 'Pigment'],
  'VBeam': ['Vascular Lesions', 'Rosacea', 'Redness'],
};

export function LaserTreatmentForm({ onChange, value, readonly }: LaserTreatmentFormProps): JSX.Element {
  const handleAreaToggle = (areaId: string): void => {
    const newAreas = value.areas.includes(areaId)
      ? value.areas.filter(a => a !== areaId)
      : [...value.areas, areaId];
    onChange({ ...value, areas: newAreas });
  };

  const availableTypes = value.deviceName ? TREATMENT_TYPES[value.deviceName] || [] : [];

  return (
    <Stack gap="md">
      <Title order={5}>
        Laser Treatment
      </Title>

      {/* Device */}
      <Group>
        <Text size="sm" fw={500} w={120}>Device:</Text>
        {readonly ? (
          <Text>{value.deviceName || '—'}</Text>
        ) : (
          <select
            value={value.deviceName || ''}
            onChange={(e) => onChange({ ...value, deviceName: e.target.value, treatmentType: undefined })}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
            disabled={readonly}
          >
            <option value="">Select device...</option>
            {LASER_DEVICES.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
      </Group>

      {/* Treatment Type */}
      {value.deviceName && availableTypes.length > 0 && (
        <Group>
          <Text size="sm" fw={500} w={120}>Treatment Type:</Text>
          {readonly ? (
            <Text>{value.treatmentType || '—'}</Text>
          ) : (
            <select
              value={value.treatmentType || ''}
              onChange={(e) => onChange({ ...value, treatmentType: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
              disabled={readonly}
            >
              <option value="">Select type...</option>
              {availableTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </Group>
      )}

      {/* Treatment Settings */}
      <Box>
        <Text size="sm" fw={500} mb="xs">Treatment Settings:</Text>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
          }}
        >
          <div>
            <Text size="xs" c="dimmed" mb={4}>Fluence (J/cm²)</Text>
            {readonly ? (
              <Text>{value.fluence ?? '—'}</Text>
            ) : (
              <NumberInput
                value={value.fluence}
                onChange={(val) => onChange({ ...value, fluence: typeof val === 'number' ? val : undefined })}
                min={0}
                max={100}
                step={0.1}
                disabled={readonly}
              />
            )}
          </div>
          <div>
            <Text size="xs" c="dimmed" mb={4}>Pulse Duration (ms)</Text>
            {readonly ? (
              <Text>{value.pulseDuration ?? '—'}</Text>
            ) : (
              <NumberInput
                value={value.pulseDuration}
                onChange={(val) => onChange({ ...value, pulseDuration: typeof val === 'number' ? val : undefined })}
                min={0}
                max={1000}
                disabled={readonly}
              />
            )}
          </div>
          <div>
            <Text size="xs" c="dimmed" mb={4}>Spot Size (mm)</Text>
            {readonly ? (
              <Text>{value.spotSize ?? '—'}</Text>
            ) : (
              <NumberInput
                value={value.spotSize}
                onChange={(val) => onChange({ ...value, spotSize: typeof val === 'number' ? val : undefined })}
                min={0}
                max={50}
                step={0.5}
                disabled={readonly}
              />
            )}
          </div>
          <div>
            <Text size="xs" c="dimmed" mb={4}>Passes</Text>
            {readonly ? (
              <Text>{value.passes ?? '—'}</Text>
            ) : (
              <NumberInput
                value={value.passes}
                onChange={(val) => onChange({ ...value, passes: typeof val === 'number' ? val : undefined })}
                min={1}
                max={10}
                disabled={readonly}
              />
            )}
          </div>
        </div>
      </Box>

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
          {LASER_AREAS.map((area) => (
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

      {/* Custom Settings */}
      <Box>
        <Text size="sm" fw={500} mb="xs">Custom Settings / Notes:</Text>
        {readonly ? (
          <Box p="xs" bg="gray.0" style={{ borderRadius: '4px', minHeight: '60px' }}>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {value.settings || 'No custom settings recorded'}
            </Text>
          </Box>
        ) : (
          <Textarea
            value={value.settings || ''}
            onChange={(e) => onChange({ ...value, settings: e.target.value })}
            placeholder="Enter custom device settings, parameters, or technical notes..."
            minRows={3}
            disabled={readonly}
          />
        )}
      </Box>

      {/* General Notes */}
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
            placeholder="Enter treatment notes, patient response, or observations..."
            minRows={4}
            disabled={readonly}
          />
        )}
      </Box>
    </Stack>
  );
}
