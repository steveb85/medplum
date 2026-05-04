// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * MedicalHistorySection Component
 * Step 5: Medical conditions, medications, and allergies
 */

import { Alert, Checkbox, Group, Stack, Text, Title } from '@mantine/core';
import { IconHeart, IconPill, IconShield } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useMemo } from 'react';
import { AllergyInput } from '../components/AllergyInput';
import { MedicationInput } from '../components/MedicationInput';
import type { IntakeFormData, MedicalCondition } from '../types/intake';

interface MedicalHistorySectionProps {
  data: Partial<IntakeFormData>;
  onChange: (updates: Partial<IntakeFormData>) => void;
  errors: Record<string, string>;
}

const MEDICAL_CONDITIONS = [
  { value: 'diabetes', label: 'Diabetes', critical: false },
  { value: 'heart-condition', label: 'Heart Condition', critical: true },
  { value: 'autoimmune-disorder', label: 'Autoimmune Disorder', critical: false },
  { value: 'bleeding-disorder', label: 'Bleeding Disorder', critical: true },
  { value: 'seizure-disorder', label: 'Seizure Disorder', critical: false },
  { value: 'cold-sores', label: 'Cold Sores (HSV-1)', critical: true },
  { value: 'keloid-tendency', label: 'Keloid Tendency', critical: true },
  { value: 'none', label: 'None of the Above', critical: false },
];

export function MedicalHistorySection({ data, onChange, errors }: MedicalHistorySectionProps): JSX.Element {
  const selectedConditions = useMemo(() => data.medicalConditions || [], [data.medicalConditions]);

  const handleConditionToggle = useCallback(
    (conditionValue: string, checked: boolean) => {
      let newConditions: MedicalCondition[];

      if (conditionValue === 'none') {
        newConditions = checked ? ['none'] : [];
      } else {
        const condition = conditionValue as MedicalCondition;
        newConditions = checked
          ? [...selectedConditions.filter((c) => c !== 'none'), condition]
          : selectedConditions.filter((c) => c !== condition);
      }

      onChange({ medicalConditions: newConditions });
    },
    [selectedConditions, onChange]
  );

  const handleMedicationsChange = useCallback(
    (medications: IntakeFormData['medications']) => {
      onChange({ medications });
    },
    [onChange]
  );

  const handleAllergiesChange = useCallback(
    (allergies: IntakeFormData['allergies']) => {
      onChange({ allergies });
    },
    [onChange]
  );

  return (
    <Stack gap="lg">
      <div>
        <Title order={3} mb="xs">
          <IconHeart size={24} style={{ marginRight: '8px', display: 'inline' }} />
          Medical History
        </Title>
        <Text c="dimmed">
          Please tell us about your medical history. This information helps us ensure your safety and recommend
          appropriate treatments.
        </Text>
      </div>

      <div>
        <Group mb="xs">
          <IconShield size={18} />
          <Text fw={500}>Medical Conditions</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          Select all conditions that apply to you. Some conditions may affect treatment options.
        </Text>

        <Stack gap="xs">
          {MEDICAL_CONDITIONS.map((condition) => (
            <Checkbox
              key={condition.value}
              label={
                <Group gap="xs">
                  <span>{condition.label}</span>
                  {condition.critical && (
                    <span style={{ color: '#fa5252', fontSize: '0.75rem' }}>(Important for treatment safety)</span>
                  )}
                </Group>
              }
              checked={selectedConditions.includes(condition.value as MedicalCondition)}
              onChange={(e) => handleConditionToggle(condition.value, e.currentTarget.checked)}
            />
          ))}
        </Stack>

        {errors.medicalConditions && (
          <Text size="xs" c="red" mt="xs">
            {errors.medicalConditions}
          </Text>
        )}
      </div>

      {selectedConditions.includes('cold-sores') && (
        <Alert color="yellow">
          <Text fw={500} size="sm">
            Cold Sores (HSV-1) Note
          </Text>
          <Text size="sm">
            Certain treatments may trigger cold sore outbreaks. Please inform your provider if you have a history of
            cold sores, as antiviral prophylaxis may be recommended.
          </Text>
        </Alert>
      )}

      {selectedConditions.includes('keloid-tendency') && (
        <Alert color="yellow">
          <Text fw={500} size="sm">
            Keloid Tendency Note
          </Text>
          <Text size="sm">
            You may have increased risk of keloid formation from injectable treatments. Your provider will discuss this
            with you during consultation.
          </Text>
        </Alert>
      )}

      <div>
        <Group mb="xs">
          <IconPill size={18} />
          <Text fw={500}>Current Medications</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          List all medications you are currently taking, including prescriptions, over-the-counter, and supplements.
          Mark important safety flags if applicable.
        </Text>

        <MedicationInput value={data.medications || []} onChange={handleMedicationsChange} />

        {(data.medications || []).some((m) => m.isAccutane) && (
          <Alert color="red" mt="md">
            <Text fw={500} size="sm">
              Accutane/Isotretinoin Warning
            </Text>
            <Text size="sm">
              You must be off Accutane for at least 6 months before certain laser treatments. Please discuss with your
              provider.
            </Text>
          </Alert>
        )}
      </div>

      <div>
        <Group mb="xs">
          <IconShield size={18} />
          <Text fw={500}>Allergies</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          List any allergies to medications, topical products, or other substances. Include severity of reactions.
        </Text>

        <AllergyInput value={data.allergies || []} onChange={handleAllergiesChange} />

        {(data.allergies || []).some(
          (a) => a.substance.toLowerCase().includes('latex') || a.substance.toLowerCase().includes('lidocaine')
        ) && (
          <Alert color="yellow" mt="md">
            <Text fw={500} size="sm">
              Latex/Lidocaine Allergy Note
            </Text>
            <Text size="sm">
              Please inform your provider about these allergies before any treatment. Alternative products are
              available.
            </Text>
          </Alert>
        )}
      </div>
    </Stack>
  );
}
