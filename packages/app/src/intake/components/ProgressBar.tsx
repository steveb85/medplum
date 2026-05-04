// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * ProgressBar Component
 * Shows progress through the intake form steps
 */

import { Group, Stepper, Text } from '@mantine/core';
import type { JSX } from 'react';
import { STEPS } from '../types/intake';

interface ProgressBarProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  allowNavigation?: boolean;
}

const STEP_LABELS: Record<string, string> = {
  welcome: 'Welcome',
  demographics: 'Demographics',
  'emergency-contact': 'Emergency Contact',
  insurance: 'Insurance',
  'medical-history': 'Medical History',
  'aesthetic-history': 'Aesthetic History',
  'treatment-goals': 'Treatment Goals',
  contraindications: 'Safety',
  review: 'Review',
};

export function ProgressBar({
  currentStep,
  onStepClick,
  allowNavigation = false,
}: ProgressBarProps): JSX.Element {
  return (
    <div style={{ marginBottom: '24px' }}>
      <Group justify="space-between" mb="xs">
        <Text size="sm" c="dimmed">
          Step {currentStep + 1} of {STEPS.length}
        </Text>
        <Text size="sm" fw={500}>
          {Math.round(((currentStep + 1) / STEPS.length) * 100)}% Complete
        </Text>
      </Group>

      <Stepper
        active={currentStep}
        onStepClick={allowNavigation ? onStepClick : undefined}
        size="sm"
        allowNextStepsSelect={false}
      >
        {STEPS.map((step, index) => (
          <Stepper.Step
            key={step}
            label={STEP_LABELS[step]}
            description={index < currentStep ? 'Complete' : undefined}
            allowStepClick={allowNavigation && index <= currentStep}
          />
        ))}
      </Stepper>
    </div>
  );
}
