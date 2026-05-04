// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * EmergencyContactSection Component
 * Step 3: Emergency contact information
 */

import { Alert, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconEmergencyBed, IconPhone, IconUser } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback } from 'react';
import type { IntakeFormData } from '../types/intake';

interface EmergencyContactSectionProps {
  data: Partial<IntakeFormData>;
  onChange: (updates: Partial<IntakeFormData>) => void;
  errors: Record<string, string>;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Spouse/Partner' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'child', label: 'Child' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' },
];

export function EmergencyContactSection({ data, onChange, errors }: EmergencyContactSectionProps): JSX.Element {
  const handleChange = useCallback(
    (field: keyof IntakeFormData['emergencyContact'], value: string) => {
      onChange({
        emergencyContact: {
          ...(data.emergencyContact || {}),
          [field]: value,
        } as IntakeFormData['emergencyContact'],
      });
    },
    [data.emergencyContact, onChange]
  );

  return (
    <Stack gap="lg">
      <div>
        <Title order={3} mb="xs">
          <IconEmergencyBed size={24} style={{ marginRight: '8px', display: 'inline' }} />
          Emergency Contact
        </Title>
        <Text c="dimmed">
          Please provide contact information for someone we can reach in case of an emergency during your visit.
        </Text>
      </div>

      <Alert color="red" title="Important">
        <Text size="sm">
          This person should be available by phone during your appointment time. They will only be contacted in case of
          an emergency.
        </Text>
      </Alert>

      <TextInput
        label="Full Name"
        placeholder="Enter emergency contact's full name"
        required
        leftSection={<IconUser size={16} />}
        value={data.emergencyContact?.name || ''}
        onChange={(e) => handleChange('name', e.currentTarget.value)}
        error={errors['emergencyContact.name']}
      />

      <Select
        label="Relationship"
        placeholder="Select relationship"
        required
        data={RELATIONSHIP_OPTIONS}
        value={data.emergencyContact?.relationship || undefined}
        onChange={(val) => handleChange('relationship', val || '')}
        error={errors['emergencyContact.relationship']}
      />

      <TextInput
        label="Phone Number"
        placeholder="(555) 123-4567"
        required
        leftSection={<IconPhone size={16} />}
        value={data.emergencyContact?.phone || ''}
        onChange={(e) => handleChange('phone', e.currentTarget.value)}
        error={errors['emergencyContact.phone']}
      />

      <Alert color="blue" title="HIPAA Note">
        <Text size="sm">
          By providing this contact information, you authorize us to share relevant medical information with this person
          in case of an emergency.
        </Text>
      </Alert>
    </Stack>
  );
}
