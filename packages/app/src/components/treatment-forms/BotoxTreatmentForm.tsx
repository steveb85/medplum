import { Box, Group, NumberInput, Stack, Text, Textarea, Title } from '@mantine/core';
import type { JSX } from 'react';
import { useState } from 'react';

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
  const [local, setLocal] = useState({ ...value, areas: value.areas || [] });

  const update = (updates: Partial<BotoxTreatmentData>): void => {
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

  if (readonly) {
    return (
      <Stack gap="md">
        <Title order={5}>Botox Treatment</Title>
        <Group><Text size="sm" fw={500} w={120}>Product:</Text><Text>{local.productBrand || '—'}</Text></Group>
        <Group><Text size="sm" fw={500} w={120}>Total Units:</Text><Text>{local.totalUnits ?? '—'}</Text></Group>
        <Box><Text size="sm" fw={500} mb="xs">Areas:</Text><Text>{local.areas.length > 0 ? local.areas.join(', ') : 'None'}</Text></Box>
        <Box><Text size="sm" fw={500} mb="xs">Notes:</Text><Text>{local.notes || 'No notes recorded'}</Text></Box>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title order={5}>Botox Treatment</Title>
      <Group>
        <Text size="sm" fw={500} w={120}>Product Brand:</Text>
        <select value={local.productBrand || ''} onChange={(e) => update({ productBrand: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}>
          <option value="">Select brand...</option>
          <option value="Botox">Botox (Allergan)</option>
          <option value="Dysport">Dysport (Galderma)</option>
          <option value="Xeomin">Xeomin (Merz)</option>
          <option value="Jeuveau">Jeuveau (Evolus)</option>
          <option value="Daxxify">Daxxify (Revance)</option>
        </select>
      </Group>
      <Box>
        <Text size="sm" fw={500} mb="xs">Treatment Areas:</Text>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {BOTOX_AREAS.map((area) => (
            <label key={area.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '4px', cursor: 'pointer', background: local.areas.includes(area.id) ? '#e7f5ff' : '#f8f9fa', border: local.areas.includes(area.id) ? '1px solid #339af0' : '1px solid #e9ecef' }}>
              <input type="checkbox" checked={local.areas.includes(area.id)} onChange={() => handleAreaToggle(area.id)} />
              <Text size="sm">{area.label}</Text>
            </label>
          ))}
        </div>
      </Box>
      <Group>
        <Text size="sm" fw={500} w={120}>Total Units:</Text>
        <NumberInput value={local.totalUnits} onChange={(val) => update({ totalUnits: typeof val === 'number' ? val : undefined })} min={0} max={500} w={100} />
      </Group>
      <Box>
        <Text size="sm" fw={500} mb="xs">Treatment Notes:</Text>
        <Textarea value={local.notes || ''} onChange={(e) => update({ notes: e.target.value })} placeholder="Enter treatment notes, patient reactions, or observations..." minRows={4} />
      </Box>
    </Stack>
  );
}
