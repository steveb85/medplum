// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * AllergyInput Component
 * Dynamic list for adding allergies with severity levels
 */

import { Button, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback } from 'react';
import type { AllergyEntry } from '../types/intake';

interface AllergyInputProps {
  value: AllergyEntry[];
  onChange: (allergies: AllergyEntry[]) => void;
}

const COMMON_ALLERGIES = [
  { value: 'latex', label: 'Latex' },
  { value: 'lidocaine', label: 'Lidocaine / Local Anesthetics' },
  { value: 'salicylic-acid', label: 'Salicylic Acid' },
  { value: 'glycolic-acid', label: 'Glycolic Acid' },
  { value: 'retinol', label: 'Retinol / Retinoids' },
  { value: 'botox', label: 'Botulinum Toxin (Botox)' },
  { value: 'hyaluronic-acid', label: 'Hyaluronic Acid (Fillers)' },
  { value: 'lidocaine-topical', label: 'Topical Numbing Creams' },
];

const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild (localized reaction)' },
  { value: 'moderate', label: 'Moderate (requires medication)' },
  { value: 'severe', label: 'Severe (anaphylaxis risk)' },
];

export function AllergyInput({ value, onChange }: AllergyInputProps): JSX.Element {
  const addAllergy = useCallback(() => {
    const newAllergy: AllergyEntry = {
      id: crypto.randomUUID(),
      substance: '',
      severity: 'mild',
    };
    onChange([...value, newAllergy]);
  }, [value, onChange]);

  const updateAllergy = useCallback(
    (id: string, updates: Partial<AllergyEntry>) => {
      onChange(
        value.map((allergy) => (allergy.id === id ? { ...allergy, ...updates } : allergy))
      );
    },
    [value, onChange]
  );

  const removeAllergy = useCallback(
    (id: string) => {
      onChange(value.filter((allergy) => allergy.id !== id));
    },
    [value, onChange]
  );

  return (
    <Stack gap="md">
      {value.length === 0 && (
        <Text size="sm" c="dimmed">
          No allergies added. Click the button below to add allergies.
        </Text>
      )}

      {value.map((allergy) => (
        <div
          key={allergy.id}
          style={{
            padding: '16px',
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            backgroundColor: '#f8f9fa',
          }}
        >
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={500} size="sm">
                Allergy
              </Text>
              <Button
                variant="light"
                color="red"
                size="xs"
                leftSection={<IconTrash size={14} />}
                onClick={() => removeAllergy(allergy.id)}
              >
                Remove
              </Button>
            </Group>

          <Select
            label="Substance"
            placeholder="Select or type a substance"
            required
            searchable
            data={COMMON_ALLERGIES}
            value={allergy.substance}
            onChange={(val) => updateAllergy(allergy.id, { substance: val || '' })}
          />

            <Select
              label="Reaction Severity"
              placeholder="Select severity"
              required
              data={SEVERITY_OPTIONS}
              value={allergy.severity}
              onChange={(val) =>
                updateAllergy(allergy.id, { severity: (val as 'mild' | 'moderate' | 'severe') || 'mild' })
              }
            />
          </Stack>
        </div>
      ))}

      <Button variant="light" onClick={addAllergy}>
        + Add Allergy
      </Button>
    </Stack>
  );
}
