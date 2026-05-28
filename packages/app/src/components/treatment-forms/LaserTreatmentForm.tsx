import { Box, Group, NumberInput, Stack, Text, Textarea, Title } from '@mantine/core';
import type { JSX } from 'react';
import { useState } from 'react';

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
  'Fraxel', 'Clear + Brilliant', 'CO2 Laser', 'Erbium Laser',
  'IPL/Photofacial', 'Nd:YAG', 'Alexandrite', 'Diode',
  'PicoSure', 'PicoWay', 'VBeam',
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
  const [local, setLocal] = useState({ ...value, areas: value.areas || [] });

  const update = (updates: Partial<LaserTreatmentData>): void => {
    const next = { ...local, ...updates };
    setLocal(next);
    onChange(next);
  };

  const handleAreaToggle = (areaId: string): void => {
    const newAreas = local.areas.includes(areaId)
      ? local.areas.filter((a) => a !== areaId)
      : [...local.areas, areaId];
    update({ areas: newAreas });
  };

  const availableTypes = local.deviceName ? TREATMENT_TYPES[local.deviceName] || [] : [];

  if (readonly) {
    return (
      <Stack gap="md">
        <Title order={5}>Laser Treatment</Title>
        <Group><Text size="sm" fw={500} w={120}>Device:</Text><Text>{local.deviceName || '—'}</Text></Group>
        {local.treatmentType && <Group><Text size="sm" fw={500} w={120}>Type:</Text><Text>{local.treatmentType}</Text></Group>}
        <Box>
          <Text size="sm" fw={500} mb="xs">Settings:</Text>
          <Box p="xs" bg="gray.0" style={{ borderRadius: '4px' }}>
            <Text size="sm">Fluence: {local.fluence ?? '—'} J/cm²</Text>
            <Text size="sm">Pulse: {local.pulseDuration ?? '—'} ms</Text>
            <Text size="sm">Spot: {local.spotSize ?? '—'} mm</Text>
            <Text size="sm">Passes: {local.passes ?? '—'}</Text>
          </Box>
        </Box>
        <Box><Text size="sm" fw={500} mb="xs">Areas:</Text><Text>{local.areas.length > 0 ? local.areas.join(', ') : 'None'}</Text></Box>
        <Box><Text size="sm" fw={500} mb="xs">Notes:</Text><Text>{local.notes || 'No notes recorded'}</Text></Box>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title order={5}>Laser Treatment</Title>
      <Group>
        <Text size="sm" fw={500} w={120}>Device:</Text>
        <select value={local.deviceName || ''} onChange={(e) => update({ deviceName: e.target.value, treatmentType: undefined })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}>
          <option value="">Select device...</option>
          {LASER_DEVICES.map((d) => (<option key={d} value={d}>{d}</option>))}
        </select>
      </Group>
      {local.deviceName && availableTypes.length > 0 && (
        <Group>
          <Text size="sm" fw={500} w={120}>Treatment Type:</Text>
          <select value={local.treatmentType || ''} onChange={(e) => update({ treatmentType: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}>
            <option value="">Select type...</option>
            {availableTypes.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        </Group>
      )}
      <Box>
        <Text size="sm" fw={500} mb="xs">Treatment Settings:</Text>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <div><Text size="xs" c="dimmed" mb={4}>Fluence (J/cm²)</Text><NumberInput value={local.fluence} onChange={(val) => update({ fluence: typeof val === 'number' ? val : undefined })} min={0} max={100} step={0.1} /></div>
          <div><Text size="xs" c="dimmed" mb={4}>Pulse Duration (ms)</Text><NumberInput value={local.pulseDuration} onChange={(val) => update({ pulseDuration: typeof val === 'number' ? val : undefined })} min={0} max={1000} /></div>
          <div><Text size="xs" c="dimmed" mb={4}>Spot Size (mm)</Text><NumberInput value={local.spotSize} onChange={(val) => update({ spotSize: typeof val === 'number' ? val : undefined })} min={0} max={50} step={0.5} /></div>
          <div><Text size="xs" c="dimmed" mb={4}>Passes</Text><NumberInput value={local.passes} onChange={(val) => update({ passes: typeof val === 'number' ? val : undefined })} min={1} max={10} /></div>
        </div>
      </Box>
      <Box>
        <Text size="sm" fw={500} mb="xs">Treatment Areas:</Text>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {LASER_AREAS.map((area) => (
            <label key={area.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '4px', cursor: 'pointer', background: local.areas.includes(area.id) ? '#e7f5ff' : '#f8f9fa', border: local.areas.includes(area.id) ? '1px solid #339af0' : '1px solid #e9ecef' }}>
              <input type="checkbox" checked={local.areas.includes(area.id)} onChange={() => handleAreaToggle(area.id)} />
              <Text size="sm">{area.label}</Text>
            </label>
          ))}
        </div>
      </Box>
      <Box>
        <Text size="sm" fw={500} mb="xs">Custom Settings / Notes:</Text>
        <Textarea value={local.settings || ''} onChange={(e) => update({ settings: e.target.value })} placeholder="Enter custom device settings, parameters, or technical notes..." minRows={3} />
      </Box>
      <Box>
        <Text size="sm" fw={500} mb="xs">Treatment Notes:</Text>
        <Textarea value={local.notes || ''} onChange={(e) => update({ notes: e.target.value })} placeholder="Enter treatment notes, patient response, or observations..." minRows={4} />
      </Box>
    </Stack>
  );
}
