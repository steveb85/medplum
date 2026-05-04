// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * DemographicsSection Component
 * Step 2: Patient demographics and contact information
 */

import { Alert, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import type { Patient } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconLoader, IconMail, IconMapPin, IconPhone, IconUser } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { DOBInput } from '../components/DOBInput';
import { DuplicateCheckModal } from '../components/DuplicateCheckModal';
import type { IntakeFormData } from '../types/intake';

interface DemographicsSectionProps {
  data: Partial<IntakeFormData>;
  onChange: (updates: Partial<IntakeFormData>) => void;
  errors: Record<string, string>;
}

const PRONOUN_OPTIONS = [
  { value: 'he/him', label: 'He/Him' },
  { value: 'she/her', label: 'She/Her' },
  { value: 'they/them', label: 'They/Them' },
  { value: 'other', label: 'Other/Prefer not to say' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

const REFERRAL_OPTIONS = [
  { value: 'google', label: 'Google Search' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'friend', label: 'Friend/Family Referral' },
  { value: 'returning-patient', label: 'Returning Patient' },
  { value: 'other', label: 'Other' },
];

export function DemographicsSection({ data, onChange, errors }: DemographicsSectionProps): JSX.Element {
  const medplum = useMedplum();
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [potentialDuplicates, setPotentialDuplicates] = useState<Patient[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Check for duplicates when phone or email changes
  const checkDuplicates = useCallback(
    async (phone?: string, email?: string) => {
      if (!phone && !email) {
        return;
      }

      setCheckingDuplicates(true);
      try {
        const queries: string[] = [];
        if (phone) {
          queries.push(`telecom=${phone}`);
        }
        if (email) {
          queries.push(`telecom=${email}`);
        }

        const result = await medplum.search('Patient', { telecom: queries.join(','), _count: '10' });
        const patients = (result.entry || []).map((e) => e.resource as Patient).filter(Boolean);

        if (patients.length > 0) {
          setPotentialDuplicates(patients);
          setDuplicateModalOpen(true);
        }
      } catch (err) {
        console.error('Error checking duplicates:', err);
      } finally {
        setCheckingDuplicates(false);
      }
    },
    [medplum]
  );

  // Debounced duplicate check
  useEffect(() => {
    const timer = setTimeout(async () => {
      if ((data.phone ?? '').length >= 10 || data.email?.includes('@')) {
        await checkDuplicates(data.phone, data.email);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [data.phone, data.email, checkDuplicates]);

  const handleAddressChange = useCallback(
    (field: keyof IntakeFormData['address'], value: string) => {
      onChange({
        address: { ...(data.address || {}), [field]: value } as IntakeFormData['address'],
      });
    },
    [data.address, onChange]
  );

  return (
    <Stack gap="lg">
      <div>
        <Title order={3} mb="xs">
          Demographics
        </Title>
        <Text c="dimmed">
          Please provide your personal information. This helps us identify you and contact you regarding your care.
        </Text>
      </div>

      <Group grow>
        <TextInput
          label="First Name"
          placeholder="Enter your first name"
          required
          leftSection={<IconUser size={16} />}
          value={data.firstName || ''}
          onChange={(e) => onChange({ firstName: e.currentTarget.value })}
          error={errors.firstName}
        />
        <TextInput
          label="Last Name"
          placeholder="Enter your last name"
          required
          value={data.lastName || ''}
          onChange={(e) => onChange({ lastName: e.currentTarget.value })}
          error={errors.lastName}
        />
      </Group>

      <TextInput
        label="Preferred Name (Optional)"
        placeholder="What should we call you?"
        value={data.preferredName || ''}
        onChange={(e) => onChange({ preferredName: e.currentTarget.value })}
      />

      <Group grow>
        <Select
          label="Pronouns"
          placeholder="Select pronouns"
          required
          data={PRONOUN_OPTIONS}
          value={data.pronouns || undefined}
          onChange={(val) => onChange({ pronouns: val as IntakeFormData['pronouns'] })}
          error={errors.pronouns}
        />
        <Select
          label="Gender Identity"
          placeholder="Select gender identity"
          required
          data={GENDER_OPTIONS}
          value={data.genderIdentity || undefined}
          onChange={(val) => onChange({ genderIdentity: val as IntakeFormData['genderIdentity'] })}
          error={errors.genderIdentity}
        />
      </Group>

      <DOBInput
        label="Date of Birth"
        value={data.dateOfBirth || ''}
        onChange={(value) => onChange({ dateOfBirth: value })}
        error={errors.dateOfBirth}
      />

      <Group grow>
        <TextInput
          label="Mobile Phone"
          placeholder="(555) 123-4567"
          required
          leftSection={<IconPhone size={16} />}
          value={data.phone || ''}
          onChange={(e) => onChange({ phone: e.currentTarget.value })}
          error={errors.phone}
        />
        <TextInput
          label="Email"
          placeholder="you@example.com"
          required
          leftSection={<IconMail size={16} />}
          value={data.email || ''}
          onChange={(e) => onChange({ email: e.currentTarget.value })}
          error={errors.email}
        />
      </Group>

      {checkingDuplicates && (
        <Alert color="blue" icon={<IconLoader size={16} />}>
          Checking for existing records...
        </Alert>
      )}

      <div>
        <Group mb="xs">
          <IconMapPin size={18} />
          <Text fw={500}>Address</Text>
        </Group>
        <Stack gap="sm">
          <TextInput
            label="Street Address"
            placeholder="123 Main St, Apt 4B"
            required
            value={data.address?.street || ''}
            onChange={(e) => handleAddressChange('street', e.currentTarget.value)}
            error={errors['address.street']}
          />
          <Group grow>
            <TextInput
              label="City"
              placeholder="New York"
              required
              value={data.address?.city || ''}
              onChange={(e) => handleAddressChange('city', e.currentTarget.value)}
              error={errors['address.city']}
            />
            <TextInput
              label="State"
              placeholder="NY"
              required
              value={data.address?.state || 'NY'}
              onChange={(e) => handleAddressChange('state', e.currentTarget.value)}
              error={errors['address.state']}
            />
            <TextInput
              label="ZIP Code"
              placeholder="10001"
              required
              value={data.address?.zip || ''}
              onChange={(e) => handleAddressChange('zip', e.currentTarget.value)}
              error={errors['address.zip']}
            />
          </Group>
        </Stack>
      </div>

      <Select
        label="How did you hear about us?"
        placeholder="Select referral source"
        required
        data={REFERRAL_OPTIONS}
        value={data.referralSource || undefined}
        onChange={(val) => onChange({ referralSource: val as IntakeFormData['referralSource'] })}
        error={errors.referralSource}
      />

      <DuplicateCheckModal
        opened={duplicateModalOpen}
        onClose={() => setDuplicateModalOpen(false)}
        duplicates={potentialDuplicates}
        onSelectExisting={() => {
          // Navigate to existing patient
          setDuplicateModalOpen(false);
        }}
        onCreateNew={() => setDuplicateModalOpen(false)}
      />
    </Stack>
  );
}
