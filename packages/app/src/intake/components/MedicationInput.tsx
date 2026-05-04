// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * MedicationInput Component
 * Dynamic list for adding medications with safety flags
 */

import { Button, Checkbox, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback } from 'react';
import type { MedicationEntry } from '../types/intake';

interface MedicationInputProps {
  value: MedicationEntry[];
  onChange: (medications: MedicationEntry[]) => void;
}

export function MedicationInput({ value, onChange }: MedicationInputProps): JSX.Element {
  const addMedication = useCallback(() => {
    const newMedication: MedicationEntry = {
      id: crypto.randomUUID(),
      name: '',
      dosage: '',
      frequency: '',
      isAccutane: false,
      isBloodThinner: false,
      isPhotosensitizing: false,
    };
    onChange([...value, newMedication]);
  }, [value, onChange]);

  const updateMedication = useCallback(
    (id: string, updates: Partial<MedicationEntry>) => {
      onChange(
        value.map((med) => (med.id === id ? { ...med, ...updates } : med))
      );
    },
    [value, onChange]
  );

  const removeMedication = useCallback(
    (id: string) => {
      onChange(value.filter((med) => med.id !== id));
    },
    [value, onChange]
  );

  return (
    <Stack gap="md">
      {value.length === 0 && (
        <Text size="sm" c="dimmed">
          No medications added. Click the button below to add medications.
        </Text>
      )}

      {value.map((medication) => (
        <div
          key={medication.id}
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
                Medication
              </Text>
              <Button
                variant="light"
                color="red"
                size="xs"
                leftSection={<IconTrash size={14} />}
                onClick={() => removeMedication(medication.id)}
              >
                Remove
              </Button>
            </Group>

            <TextInput
              label="Medication Name"
              placeholder="e.g., Lisinopril"
              required
              value={medication.name}
              onChange={(e) =>
                updateMedication(medication.id, { name: e.currentTarget.value })
              }
            />

            <Group grow>
              <TextInput
                label="Dosage"
                placeholder="e.g., 10mg"
                required
                value={medication.dosage}
                onChange={(e) =>
                  updateMedication(medication.id, { dosage: e.currentTarget.value })
                }
              />
              <TextInput
                label="Frequency"
                placeholder="e.g., Once daily"
                required
                value={medication.frequency}
                onChange={(e) =>
                  updateMedication(medication.id, { frequency: e.currentTarget.value })
                }
              />
            </Group>

            <Text size="xs" fw={500} c="dimmed" mt="xs">
              Safety Flags (check all that apply):
            </Text>
            <Group>
              <Checkbox
                label="Accutane / Isotretinoin"
                checked={medication.isAccutane}
                onChange={(e) =>
                  updateMedication(medication.id, { isAccutane: e.currentTarget.checked })
                }
              />
              <Checkbox
                label="Blood Thinner"
                checked={medication.isBloodThinner}
                onChange={(e) =>
                  updateMedication(medication.id, {
                    isBloodThinner: e.currentTarget.checked,
                  })
                }
              />
              <Checkbox
                label="Photosensitizing"
                checked={medication.isPhotosensitizing}
                onChange={(e) =>
                  updateMedication(medication.id, {
                    isPhotosensitizing: e.currentTarget.checked,
                  })
                }
              />
            </Group>
          </Stack>
        </div>
      ))}

      <Button variant="light" onClick={addMedication}>
        + Add Medication
      </Button>
    </Stack>
  );
}
