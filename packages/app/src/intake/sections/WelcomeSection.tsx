// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * WelcomeSection Component
 * Step 1: Legal acknowledgments and consents
 */

import { Alert, Checkbox, Stack, Text, Title } from '@mantine/core';
import { IconShieldCheck, IconFileText, IconCamera } from '@tabler/icons-react';
import type { JSX } from 'react';
import type { IntakeFormData } from '../types/intake';

interface WelcomeSectionProps {
  data: Partial<IntakeFormData>;
  onChange: (updates: Partial<IntakeFormData>) => void;
  errors: Record<string, string>;
}

export function WelcomeSection({ data, onChange, errors }: WelcomeSectionProps): JSX.Element {
  return (
    <Stack gap="lg">
      <div>
        <Title order={3} mb="xs">
          Welcome to Studio Assistant
        </Title>
        <Text c="dimmed">
          Thank you for choosing our med spa for your aesthetic needs. Before we begin,
          we need to collect some important information and obtain your consent for treatment.
        </Text>
      </div>

      <Alert color="blue" title="Privacy & Security">
        <Text size="sm">
          Your information is protected by HIPAA and will only be used for your care.
          All data is securely stored and transmitted.
        </Text>
      </Alert>

      <div>
        <Title order={4} mb="xs">
          <IconShieldCheck size={20} style={{ marginRight: '8px', display: 'inline' }} />
          HIPAA Privacy Notice
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          I acknowledge that I have received and understand the Notice of Privacy Practices
          regarding how my protected health information may be used and disclosed.
        </Text>
        <Checkbox
          label="I acknowledge the HIPAA Privacy Notice"
          checked={data.hipaaAcknowledged || false}
          onChange={(e) => onChange({ hipaaAcknowledged: e.currentTarget.checked })}
          error={errors.hipaaAcknowledged}
          required
        />
      </div>

      <div>
        <Title order={4} mb="xs">
          <IconFileText size={20} style={{ marginRight: '8px', display: 'inline' }} />
          Terms of Service
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          I agree to the Terms of Service, including payment policies, cancellation policies,
          and understand that aesthetic treatments may have risks and side effects.
        </Text>
        <Checkbox
          label="I accept the Terms of Service"
          checked={data.termsAccepted || false}
          onChange={(e) => onChange({ termsAccepted: e.currentTarget.checked })}
          error={errors.termsAccepted}
          required
        />
      </div>

      <div>
        <Title order={4} mb="xs">
          <IconCamera size={20} style={{ marginRight: '8px', display: 'inline' }} />
          Photo/Video Release
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          I consent to the use of my photographs and videos for documentation purposes,
          including before/after comparisons. These may also be used for educational
          and marketing purposes with identifying information removed.
        </Text>
        <Checkbox
          label="I consent to photo/video documentation"
          checked={data.photoRelease || false}
          onChange={(e) => onChange({ photoRelease: e.currentTarget.checked })}
          error={errors.photoRelease}
          required
        />
      </div>

      <Alert color="yellow" title="Important">
        <Text size="sm">
          All fields above are required to proceed. By continuing, you confirm that you
          are 18 years of age or older and are providing accurate information.
        </Text>
      </Alert>
    </Stack>
  );
}
