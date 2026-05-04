// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * InsuranceSection Component
 * Step 4: Optional insurance information
 */

import { Alert, Checkbox, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconInfoCircle, IconShield } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback } from 'react';
import { DOBInput } from '../components/DOBInput';
import type { IntakeFormData } from '../types/intake';

interface InsuranceSectionProps {
  data: Partial<IntakeFormData>;
  onChange: (updates: Partial<IntakeFormData>) => void;
  errors: Record<string, string>;
}

export function InsuranceSection({ data, onChange, errors }: InsuranceSectionProps): JSX.Element {
  const hasInsurance = data.insurance?.hasInsurance;

  const handleInsuranceChange = useCallback(
    (field: keyof IntakeFormData['insurance'], value: unknown) => {
      onChange({
        insurance: {
          ...(data.insurance || {}),
          [field]: value,
        } as IntakeFormData['insurance'],
      });
    },
    [data.insurance, onChange]
  );

  return (
    <Stack gap="lg">
      <div>
        <Title order={3} mb="xs">
          <IconShield size={24} style={{ marginRight: '8px', display: 'inline' }} />
          Insurance Information
        </Title>
        <Text c="dimmed">
          While many aesthetic treatments are not covered by insurance, we collect this information for our records and
          for any procedures that may be eligible.
        </Text>
      </div>

      <Alert color="blue" icon={<IconInfoCircle size={16} />}>
        <Text size="sm">
          <strong>This section is optional.</strong> Most aesthetic treatments at our med spa are not covered by
          insurance and are paid out-of-pocket.
        </Text>
      </Alert>

      <Checkbox
        label="I have health insurance"
        checked={hasInsurance === true}
        indeterminate={hasInsurance === null}
        onChange={(e) => handleInsuranceChange('hasInsurance', e.currentTarget.checked)}
      />

      {hasInsurance && (
        <Stack gap="md" mt="md">
          <TextInput
            label="Insurance Provider"
            placeholder="e.g., Blue Cross Blue Shield"
            required
            value={data.insurance?.provider || ''}
            onChange={(e) => handleInsuranceChange('provider', e.currentTarget.value)}
            error={errors['insurance.provider']}
          />

          <Group grow>
            <TextInput
              label="Policy Number"
              placeholder="Enter policy number"
              required
              value={data.insurance?.policyNumber || ''}
              onChange={(e) => handleInsuranceChange('policyNumber', e.currentTarget.value)}
              error={errors['insurance.policyNumber']}
            />
            <TextInput
              label="Group Number (Optional)"
              placeholder="Enter group number"
              value={data.insurance?.groupNumber || ''}
              onChange={(e) => handleInsuranceChange('groupNumber', e.currentTarget.value)}
            />
          </Group>

          <Checkbox
            label="Policyholder is the same as patient"
            checked={data.insurance?.policyholderSameAsPatient || false}
            onChange={(e) => handleInsuranceChange('policyholderSameAsPatient', e.currentTarget.checked)}
          />

          {!data.insurance?.policyholderSameAsPatient && (
            <Stack gap="md" mt="md" p="md" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <Text fw={500} size="sm">
                Policyholder Information
              </Text>
              <TextInput
                label="Policyholder Name"
                placeholder="Enter policyholder's full name"
                required
                value={data.insurance?.policyholderName || ''}
                onChange={(e) => handleInsuranceChange('policyholderName', e.currentTarget.value)}
                error={errors['insurance.policyholderName']}
              />
              <Group grow>
                <DOBInput
                  label="Policyholder Date of Birth"
                  value={data.insurance?.policyholderDOB || ''}
                  onChange={(val) => handleInsuranceChange('policyholderDOB', val)}
                  error={errors['insurance.policyholderDOB']}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Relationship to Patient"
                  placeholder="e.g., Spouse, Parent"
                  required
                  value={data.insurance?.policyholderRelationship || ''}
                  onChange={(e) => handleInsuranceChange('policyholderRelationship', e.currentTarget.value)}
                  error={errors['insurance.policyholderRelationship']}
                />
              </Group>
            </Stack>
          )}
        </Stack>
      )}

      {hasInsurance === false && (
        <Alert color="yellow">
          <Text size="sm">
            No problem! We accept various payment methods including credit cards, HSA/FSA cards, and offer payment plans
            for qualifying treatments.
          </Text>
        </Alert>
      )}
    </Stack>
  );
}
