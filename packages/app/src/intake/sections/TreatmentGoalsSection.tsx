// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * TreatmentGoalsSection Component
 * Step 6/7: Aesthetic history and treatment goals
 */

import { Alert, Button, Checkbox, Group, Radio, Select, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { IconHistory, IconSparkles, IconTarget, IconTrash } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback } from 'react';
import type { AestheticConcern, IntakeFormData, PreviousAestheticTreatment, TreatmentArea } from '../types/intake';

interface TreatmentGoalsSectionProps {
  data: Partial<IntakeFormData>;
  onChange: (updates: Partial<IntakeFormData>) => void;
  errors: Record<string, string>;
}

const AESTHETIC_CONCERNS: { value: AestheticConcern; label: string }[] = [
  { value: 'fine-lines', label: 'Fine Lines' },
  { value: 'wrinkles', label: 'Wrinkles' },
  { value: 'volume-loss', label: 'Volume Loss' },
  { value: 'skin-texture', label: 'Skin Texture' },
  { value: 'pigmentation', label: 'Pigmentation/Sun Spots' },
  { value: 'acne-scars', label: 'Acne/Acne Scars' },
  { value: 'pore-size', label: 'Pore Size' },
  { value: 'skin-laxity', label: 'Skin Laxity' },
  { value: 'under-eye-darkness', label: 'Under Eye Darkness' },
  { value: 'lip-enhancement', label: 'Lip Enhancement' },
  { value: 'jawline-definition', label: 'Jawline Definition' },
  { value: 'neck-lines', label: 'Neck Lines' },
  { value: 'other', label: 'Other' },
];

const TREATMENT_AREAS: { value: TreatmentArea; label: string }[] = [
  { value: 'forehead', label: 'Forehead' },
  { value: 'between-brows', label: 'Between Brows (Glabella)' },
  { value: 'crows-feet', label: "Crow's Feet" },
  { value: 'under-eyes', label: 'Under Eyes (Tear Trough)' },
  { value: 'cheeks', label: 'Cheeks' },
  { value: 'nasolabial-folds', label: 'Nasolabial Folds' },
  { value: 'lips', label: 'Lips' },
  { value: 'chin', label: 'Chin' },
  { value: 'jawline', label: 'Jawline' },
  { value: 'neck', label: 'Neck' },
  { value: 'hands', label: 'Hands' },
  { value: 'other', label: 'Other' },
];

const PROCEDURE_OPTIONS = [
  { value: 'botox', label: 'Botox' },
  { value: 'dysport', label: 'Dysport' },
  { value: 'fillers', label: 'Dermal Fillers' },
  { value: 'laser', label: 'Laser Treatment' },
  { value: 'peels', label: 'Chemical Peel' },
  { value: 'microneedling', label: 'Microneedling' },
];

export function TreatmentGoalsSection({ data, onChange, errors }: TreatmentGoalsSectionProps): JSX.Element {
  const handleConcernToggle = useCallback(
    (concernValue: AestheticConcern, checked: boolean) => {
      const current = data.primaryConcerns || [];
      if (checked) {
        if (current.length < 3) {
          onChange({ primaryConcerns: [...current, concernValue] });
        }
      } else {
        onChange({ primaryConcerns: current.filter((c) => c !== concernValue) });
      }
    },
    [data.primaryConcerns, onChange]
  );

  const handleAreaToggle = useCallback(
    (areaValue: TreatmentArea, checked: boolean) => {
      const current = data.treatmentAreas || [];
      if (checked) {
        onChange({ treatmentAreas: [...current, areaValue] });
      } else {
        onChange({ treatmentAreas: current.filter((a) => a !== areaValue) });
      }
    },
    [data.treatmentAreas, onChange]
  );

  const addPreviousTreatment = useCallback(() => {
    const newTreatment: PreviousAestheticTreatment = {
      id: crypto.randomUUID(),
      procedure: 'botox',
      when: '',
      where: '',
      results: '',
      complications: '',
    };
    onChange({
      previousAestheticTreatments: [...(data.previousAestheticTreatments || []), newTreatment],
    });
  }, [data.previousAestheticTreatments, onChange]);

  const updatePreviousTreatment = useCallback(
    (id: string, updates: Partial<PreviousAestheticTreatment>) => {
      onChange({
        previousAestheticTreatments:
          data.previousAestheticTreatments?.map((t) => (t.id === id ? { ...t, ...updates } : t)) || [],
      });
    },
    [data.previousAestheticTreatments, onChange]
  );

  const removePreviousTreatment = useCallback(
    (id: string) => {
      onChange({
        previousAestheticTreatments: data.previousAestheticTreatments?.filter((t) => t.id !== id) || [],
      });
    },
    [data.previousAestheticTreatments, onChange]
  );

  return (
    <Stack gap="lg">
      <div>
        <Title order={3} mb="xs">
          <IconTarget size={24} style={{ marginRight: '8px', display: 'inline' }} />
          Treatment Goals
        </Title>
        <Text c="dimmed">Help us understand what you hope to achieve with aesthetic treatments.</Text>
      </div>

      <div>
        <Group mb="xs">
          <IconSparkles size={18} />
          <Text fw={500}>Primary Concerns (Select up to 3)</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          What are your main aesthetic concerns? These help us recommend the best treatments.
        </Text>

        <Group>
          {AESTHETIC_CONCERNS.map((concern) => (
            <Checkbox
              key={concern.value}
              label={concern.label}
              checked={(data.primaryConcerns || []).includes(concern.value)}
              onChange={(e) => handleConcernToggle(concern.value, e.currentTarget.checked)}
            />
          ))}
        </Group>

        {errors.primaryConcerns && (
          <Text size="xs" c="red" mt="xs">
            {errors.primaryConcerns}
          </Text>
        )}
      </div>

      <div>
        <Group mb="xs">
          <IconTarget size={18} />
          <Text fw={500}>Areas of Interest</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          Which areas are you interested in treating?
        </Text>

        <Group>
          {TREATMENT_AREAS.map((area) => (
            <Checkbox
              key={area.value}
              label={area.label}
              checked={(data.treatmentAreas || []).includes(area.value)}
              onChange={(e) => handleAreaToggle(area.value, e.currentTarget.checked)}
            />
          ))}
        </Group>

        {errors.treatmentAreas && (
          <Text size="xs" c="red" mt="xs">
            {errors.treatmentAreas}
          </Text>
        )}
      </div>

      <div>
        <Group mb="xs">
          <IconHistory size={18} />
          <Text fw={500}>Previous Aesthetic Treatments</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          Have you had any aesthetic treatments before? This helps us plan your care.
        </Text>

        {(data.previousAestheticTreatments || []).map((treatment) => (
          <div
            key={treatment.id}
            style={{
              padding: '16px',
              border: '1px solid #e9ecef',
              borderRadius: '8px',
              backgroundColor: '#f8f9fa',
              marginBottom: '12px',
            }}
          >
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={500} size="sm">
                  Previous Treatment
                </Text>
                <Button
                  variant="light"
                  color="red"
                  size="xs"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => removePreviousTreatment(treatment.id)}
                >
                  Remove
                </Button>
              </Group>

              <Select
                label="Procedure"
                data={PROCEDURE_OPTIONS}
                value={treatment.procedure}
                onChange={(val) =>
                  updatePreviousTreatment(treatment.id, { procedure: val as typeof treatment.procedure })
                }
              />

              <TextInput
                label="When (approximate)"
                placeholder="e.g., 6 months ago, March 2024"
                value={treatment.when}
                onChange={(e) => updatePreviousTreatment(treatment.id, { when: e.currentTarget.value })}
              />

              <TextInput
                label="Where (provider/clinic)"
                placeholder="e.g., Dr. Smith Med Spa"
                value={treatment.where}
                onChange={(e) => updatePreviousTreatment(treatment.id, { where: e.currentTarget.value })}
              />

              <Textarea
                label="Results"
                placeholder="Were you happy with results?"
                value={treatment.results}
                onChange={(e) => updatePreviousTreatment(treatment.id, { results: e.currentTarget.value })}
              />

              <Textarea
                label="Complications (if any)"
                placeholder="Any side effects or complications?"
                value={treatment.complications}
                onChange={(e) => updatePreviousTreatment(treatment.id, { complications: e.currentTarget.value })}
              />
            </Stack>
          </div>
        ))}

        <Button variant="light" onClick={addPreviousTreatment}>
          + Add Previous Treatment
        </Button>
      </div>

      <div>
        <Text fw={500} mb="xs">
          Current Skincare Routine
        </Text>
        <Textarea
          placeholder="Tell us about your current skincare products and routine..."
          value={data.skincareRoutine || ''}
          onChange={(e) => onChange({ skincareRoutine: e.currentTarget.value })}
          minRows={3}
        />
      </div>

      <Group grow align="flex-start">
        <div>
          <Radio.Group
            label={
              <span>
                Do you use retinoids/retinol?
                <span style={{ color: 'red' }}> *</span>
              </span>
            }
            value={data.usesRetinoid === null || data.usesRetinoid === undefined ? '' : String(data.usesRetinoid)}
            onChange={(val) => onChange({ usesRetinoid: val === '' ? null : val === 'true' })}
            error={errors.usesRetinoid}
            required
          >
            <Group mt="xs">
              <Radio value="true" label="Yes" />
              <Radio value="false" label="No" />
            </Group>
          </Radio.Group>
          {data.usesRetinoid && (
            <Alert color="yellow" mt="xs">
              <Text size="xs">Stop retinoids 1 week before peels and laser treatments to reduce sensitivity.</Text>
            </Alert>
          )}
        </div>

        <div>
          <Radio.Group
            label={
              <span>
                Do you use AHAs/BHAs (acids)?
                <span style={{ color: 'red' }}> *</span>
              </span>
            }
            value={data.usesAcids === null || data.usesAcids === undefined ? '' : String(data.usesAcids)}
            onChange={(val) => onChange({ usesAcids: val === '' ? null : val === 'true' })}
            error={errors.usesAcids}
            required
          >
            <Group mt="xs">
              <Radio value="true" label="Yes" />
              <Radio value="false" label="No" />
            </Group>
          </Radio.Group>
          {data.usesAcids && (
            <Alert color="yellow" mt="xs">
              <Text size="xs">Stop acids 3-5 days before peels to reduce sensitivity.</Text>
            </Alert>
          )}
        </div>
      </Group>
    </Stack>
  );
}
