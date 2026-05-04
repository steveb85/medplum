// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * ContraindicationsSection Component
 * Step 8: Safety screening for contraindications
 */

import {
  Alert,
  Checkbox,
  Group,
  Radio,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconSun, IconBabyCarriage, IconVirus } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback } from 'react';
import { BlockerAlert } from '../components/BlockerAlert';
import type { IntakeFormData, TreatmentBlocker } from '../types/intake';

interface ContraindicationsSectionProps {
  data: Partial<IntakeFormData>;
  onChange: (updates: Partial<IntakeFormData>) => void;
  errors: Record<string, string>;
}

const PREGNANCY_OPTIONS = [
  { value: 'pregnant', label: 'Currently pregnant' },
  { value: 'trying-to-conceive', label: 'Trying to conceive' },
  { value: 'breastfeeding', label: 'Breastfeeding' },
  { value: 'none', label: 'None of the above' },
];

const SUN_EXPOSURE_OPTIONS = [
  { value: 'last-2-weeks', label: 'Within the last 2 weeks' },
  { value: 'last-month', label: 'Within the last month' },
  { value: 'none-recent', label: 'No recent sun exposure / tan' },
];

export function ContraindicationsSection({
  data,
  onChange,
  errors,
}: ContraindicationsSectionProps): JSX.Element {
  const calculateBlockers = useCallback((): TreatmentBlocker[] => {
    const blockers: TreatmentBlocker[] = [];

    // Pregnancy blockers
    if (data.pregnancyStatus === 'pregnant') {
      blockers.push({
        id: 'pregnancy',
        title: 'Pregnancy',
        message:
          'Many aesthetic treatments are not recommended during pregnancy. Please consult with your provider.',
        severity: 'warning',
        affectedTreatments: ['Botox', 'Fillers', 'Laser', 'Peels'],
        fieldPath: 'pregnancyStatus',
      });
    } else if (data.pregnancyStatus === 'breastfeeding') {
      blockers.push({
        id: 'breastfeeding',
        title: 'Breastfeeding',
        message:
          'Some treatments may be safe while breastfeeding, but require special considerations.',
        severity: 'warning',
        affectedTreatments: ['Botox', 'Fillers'],
        fieldPath: 'pregnancyStatus',
      });
    }

    // Sun exposure blockers
    if (data.sunExposure === 'last-2-weeks') {
      blockers.push({
        id: 'recent-sun',
        title: 'Recent Sun Exposure',
        message:
          'Recent sun exposure increases risk of complications with laser treatments. Consider rescheduling or taking extra precautions.',
        severity: 'warning',
        affectedTreatments: ['Laser', 'Peels'],
        fieldPath: 'sunExposure',
      });
    }

    // Active infection
    if (data.hasActiveInfection) {
      blockers.push({
        id: 'active-infection',
        title: 'Active Infection',
        message:
          'Active infections should be resolved before aesthetic treatments to prevent spread and complications.',
        severity: 'blocking',
        affectedTreatments: ['All treatments'],
        fieldPath: 'hasActiveInfection',
      });
    }

    // Check for photosensitizing medications
    const hasPhotosensitizingMeds = (data.medications || []).some((m) => m.isPhotosensitizing);
    if (hasPhotosensitizingMeds) {
      blockers.push({
        id: 'photosensitizing-meds',
        title: 'Photosensitizing Medications',
        message:
          'You are taking medications that increase photosensitivity. Laser treatments may need to be adjusted.',
        severity: 'warning',
        affectedTreatments: ['Laser', 'Peels'],
        fieldPath: 'medications',
      });
    }

    // Check for Accutane
    const hasAccutane = (data.medications || []).some((m) => m.isAccutane);
    if (hasAccutane) {
      blockers.push({
        id: 'accutane',
        title: 'Accutane (Isotretinoin)',
        message:
          'Accutane increases risk of scarring and poor healing. You should be off Accutane for 6 months before laser treatments.',
        severity: 'blocking',
        affectedTreatments: ['Laser', 'Peels', 'Microneedling'],
        fieldPath: 'medications',
      });
    }

    // Check for blood thinners
    const hasBloodThinners = (data.medications || []).some((m) => m.isBloodThinner);
    if (hasBloodThinners) {
      blockers.push({
        id: 'blood-thinners',
        title: 'Blood Thinners',
        message:
          'Blood thinners increase bruising risk with injectable treatments. Inform your provider.',
        severity: 'warning',
        affectedTreatments: ['Botox', 'Fillers'],
        fieldPath: 'medications',
      });
    }

    return blockers;
  }, [data]);

  const blockers = calculateBlockers();

  return (
    <Stack gap="lg">
      <div>
        <Title order={3} mb="xs">
          <IconAlertTriangle size={24} style={{ marginRight: '8px', display: 'inline' }} />
          Safety Screening
        </Title>
        <Text c="dimmed">
          Please answer honestly. This information helps us ensure your safety and plan
          appropriate treatments.
        </Text>
      </div>

      <BlockerAlert blockers={blockers} />

      <div>
        <Group mb="xs">
          <IconBabyCarriage size={18} />
          <Text fw={500}>Pregnancy Status</Text>
        </Group>
        <Select
          placeholder="Select your pregnancy status"
          required
          data={PREGNANCY_OPTIONS}
          value={data.pregnancyStatus || undefined}
          onChange={(val) => onChange({ pregnancyStatus: val as IntakeFormData['pregnancyStatus'] })}
          error={errors.pregnancyStatus}
        />

        {(data.pregnancyStatus === 'pregnant' || data.pregnancyStatus === 'breastfeeding') && (
          <Alert color="yellow" mt="md">
            <Text fw={500} size="sm">
              Important Note
            </Text>
            <Text size="sm">
              While some treatments may be safe, we recommend consulting with your OB/GYN
              before proceeding with any aesthetic treatments.
            </Text>
          </Alert>
        )}
      </div>

      <div>
        <Group mb="xs">
          <IconSun size={18} />
          <Text fw={500}>Recent Sun Exposure</Text>
        </Group>
        <Select
          placeholder="Select recent sun exposure"
          required
          data={SUN_EXPOSURE_OPTIONS}
          value={data.sunExposure || undefined}
          onChange={(val) => onChange({ sunExposure: val as IntakeFormData['sunExposure'] })}
          error={errors.sunExposure}
        />

        {data.sunExposure === 'last-2-weeks' && (
          <Alert color="orange" mt="md">
            <Text fw={500} size="sm">
              Sun Exposure Warning
            </Text>
            <Text size="sm">
              Recent tanning or sunburn increases risk of complications with laser treatments.
              Your provider may recommend waiting or adjusting treatment parameters.
            </Text>
          </Alert>
        )}
      </div>

      <div>
        <Group mb="xs">
          <IconVirus size={18} />
          <Text fw={500}>Active Infections</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          Do you currently have any active infections, cold sores, or skin infections
          in treatment areas?
        </Text>
        <Group>
          <Checkbox
            label="Yes"
            checked={data.hasActiveInfection === true}
            onChange={(e) =>
              onChange({ hasActiveInfection: e.currentTarget.checked ? true : null })
            }
          />
          <Checkbox
            label="No"
            checked={data.hasActiveInfection === false}
            onChange={(e) =>
              onChange({ hasActiveInfection: e.currentTarget.checked ? false : null })
            }
          />
        </Group>

        {data.hasActiveInfection && (
          <Stack mt="md">
            <TextInput
              label="Please describe the infection"
              placeholder="e.g., Cold sore on lip, skin infection on cheek"
              required
              value={data.infectionType || ''}
              onChange={(e) => onChange({ infectionType: e.currentTarget.value })}
              error={errors.infectionType}
            />
            <Alert color="red">
              <Text fw={500} size="sm">
                Treatment Delay Recommended
              </Text>
              <Text size="sm">
                Active infections should be fully resolved before aesthetic treatments.
                Please consult with your provider.
              </Text>
            </Alert>
          </Stack>
        )}
      </div>

      <Alert color="blue" title="Your Safety is Our Priority">
        <Text size="sm">
          Based on your responses, any contraindications will be flagged for your provider.
          This doesn't necessarily mean you can't receive treatment—it means we need to
          take extra precautions or adjust the treatment plan.
        </Text>
      </Alert>
    </Stack>
  );
}
