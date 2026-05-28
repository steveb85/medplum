import { Box, Group, NumberInput, Stack, Text, Textarea, Title } from '@mantine/core';
import type { JSX } from 'react';
import { useState } from 'react';

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
  const [local, setLocal] = useState({ ...value, areas: value.areas || [] });

  const update = (updates: Partial<FillerTreatmentData>): void => {
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

  const availableTypes = FILLER_PRODUCTS.find((p) => p.brand === local.productBrand)?.types || [];

  if (readonly) {
    return (
      <Stack gap="md">
        <Title order={5}>Dermal Filler Treatment</Title>
        <Group><Text size="sm" fw={500} w={120}>Product:</Text><Text>{local.productBrand} {local.productType}</Text></Group>
        <Group><Text size="sm" fw={500} w={120}>Syringes:</Text><Text>{local.syringes ?? '—'}</Text></Group>
        <Box><Text size="sm" fw={500} mb="xs">Areas:</Text><Text>{local.areas.length > 0 ? local.areas.join(', ') : 'None'}</Text></Box>
        <Box><Text size="sm" fw={500} mb="xs">Notes:</Text><Text>{local.notes || 'No notes recorded'}</Text></Box>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title order={5}>Dermal Filler Treatment</Title>
      <Group>
        <Text size="sm" fw={500} w={120}>Product Brand:</Text>
        <select value={local.productBrand || ''} onChange={(e) => update({ productBrand: e.target.value, productType: undefined })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}>
          <option value="">Select brand...</option>
          {FILLER_PRODUCTS.map((p) => (<option key={p.brand} value={p.brand}>{p.brand}</option>))}
        </select>
      </Group>
      {local.productBrand && (
        <Group>
          <Text size="sm" fw={500} w={120}>Product Type:</Text>
          <select value={local.productType || ''} onChange={(e) => update({ productType: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }} disabled={availableTypes.length === 0}>
            <option value="">Select type...</option>
            {availableTypes.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        </Group>
      )}
      <Group>
        <Text size="sm" fw={500} w={120}>Syringes Used:</Text>
        <NumberInput value={local.syringes} onChange={(val) => update({ syringes: typeof val === 'number' ? val : undefined })} min={0} max={20} step={0.5} w={100} />
      </Group>
      <Box>
        <Text size="sm" fw={500} mb="xs">Treatment Areas:</Text>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {FILLER_AREAS.map((area) => (
            <label key={area.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '4px', cursor: 'pointer', background: local.areas.includes(area.id) ? '#e7f5ff' : '#f8f9fa', border: local.areas.includes(area.id) ? '1px solid #339af0' : '1px solid #e9ecef' }}>
              <input type="checkbox" checked={local.areas.includes(area.id)} onChange={() => handleAreaToggle(area.id)} />
              <Text size="sm">{area.label}</Text>
            </label>
          ))}
        </div>
      </Box>
      <Box>
        <Text size="sm" fw={500} mb="xs">Treatment Notes:</Text>
        <Textarea value={local.notes || ''} onChange={(e) => update({ notes: e.target.value })} placeholder="Enter treatment notes, injection technique, or observations..." minRows={4} />
      </Box>
    </Stack>
  );
}
