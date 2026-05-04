// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * IntakeWizard Component
 * Main wizard container that manages step navigation and form state
 */

import { Alert, Button, Card, Group, LoadingOverlay, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconCheck, IconDeviceFloppy } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ProgressBar } from './components';
import {
  WelcomeSection,
  DemographicsSection,
  EmergencyContactSection,
  InsuranceSection,
  MedicalHistorySection,
  TreatmentGoalsSection,
  ContraindicationsSection,
  ReviewSection,
} from './sections';
import type { IntakeFormData, IntakeMode, IntakeStep, ValidationError } from './types/intake';
import { STEPS, getDefaultFormData, validateStep } from './utils/validation';

interface IntakeWizardProps {
  mode: IntakeMode;
  initialData?: Partial<IntakeFormData>;
  onSubmit: (data: IntakeFormData) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  isEditMode?: boolean;
}

interface SectionError {
  step: IntakeStep;
  errors: ValidationError[];
}

export function IntakeWizard({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  isEditMode,
}: IntakeWizardProps): JSX.Element {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<Partial<IntakeFormData>>(
    initialData || getDefaultFormData()
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sectionErrors, setSectionErrors] = useState<SectionError[]>([]);

  const currentStep = STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const updateFormData = useCallback((updates: Partial<IntakeFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Clear errors when data changes
    setErrors((prev) => {
      const newErrors = { ...prev };
      Object.keys(updates).forEach((key) => {
        delete newErrors[key];
      });
      return newErrors;
    });
  }, []);

  const validateCurrentStep = useCallback((): boolean => {
    const result = validateStep(currentStep, formData);
    const errorMap: Record<string, string> = {};
    result.errors.forEach((err) => {
      errorMap[err.field] = err.message;
    });
    setErrors(errorMap);

    // Track section errors for review step
    if (result.errors.length > 0) {
      setSectionErrors((prev) => {
        const filtered = prev.filter((e) => e.step !== currentStep);
        return [...filtered, { step: currentStep, errors: result.errors }];
      });
    } else {
      setSectionErrors((prev) => prev.filter((e) => e.step !== currentStep));
    }

    return result.isValid;
  }, [currentStep, formData]);

  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) {
      return;
    }

    if (!isLastStep) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [isLastStep, validateCurrentStep]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [isFirstStep]);

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      // Only allow clicking previous steps or next step if current is valid
      if (stepIndex <= currentStepIndex) {
        setCurrentStepIndex(stepIndex);
      } else if (stepIndex === currentStepIndex + 1) {
        if (validateCurrentStep()) {
          setCurrentStepIndex(stepIndex);
        }
      }
    },
    [currentStepIndex, validateCurrentStep]
  );

  const handleSubmit = useCallback(() => {
    // Validate all steps before submit
    const allErrors: ValidationError[] = [];
    STEPS.forEach((step) => {
      const result = validateStep(step, formData);
      allErrors.push(...result.errors);
    });

    if (allErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      allErrors.forEach((err) => {
        errorMap[err.field] = err.message;
      });
      setErrors(errorMap);

      showNotification({
        color: 'red',
        title: 'Validation Error',
        message: 'Please review and correct all errors before submitting',
      });
      return;
    }

    // Set submission date
    const finalData: IntakeFormData = {
      ...getDefaultFormData(),
      ...formData,
      submissionDate: new Date().toISOString(),
    } as IntakeFormData;

    onSubmit(finalData);
  }, [formData, onSubmit]);

  const renderStep = useMemo(() => {
    const sectionProps = {
      data: formData,
      onChange: updateFormData,
      errors,
    };

    switch (currentStep) {
      case 'welcome':
        return <WelcomeSection {...sectionProps} />;
      case 'demographics':
        return <DemographicsSection {...sectionProps} />;
      case 'emergency-contact':
        return <EmergencyContactSection {...sectionProps} />;
      case 'insurance':
        return <InsuranceSection {...sectionProps} />;
      case 'medical-history':
        return <MedicalHistorySection {...sectionProps} />;
      case 'treatment-goals':
        return <TreatmentGoalsSection {...sectionProps} />;
      case 'contraindications':
        return <ContraindicationsSection {...sectionProps} />;
      case 'review':
        return <ReviewSection {...sectionProps} />;
      default:
        return <Text>Unknown step</Text>;
    }
  }, [currentStep, formData, updateFormData, errors]);

  return (
    <Card withBorder shadow="sm" padding="lg">
      <LoadingOverlay visible={isSubmitting} />

      <ProgressBar
        currentStep={currentStepIndex}
        onStepClick={handleStepClick}
        allowNavigation={mode === 'coordinator-assisted'}
      />

      <Card.Section withBorder inheritPadding py="md" mb="lg">
        <Title order={3}>
          Step {currentStepIndex + 1}:{' '}
          {currentStep === 'emergency-contact'
            ? 'Emergency Contact'
            : currentStep === 'medical-history'
              ? 'Medical History'
              : currentStep.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
        </Title>
      </Card.Section>

      <div style={{ minHeight: '400px' }}>
        {renderStep}
      </div>

      <Group justify="space-between" mt="xl">
        <Button
          variant="light"
          leftSection={<IconArrowLeft size={16} />}
          onClick={handleBack}
          disabled={isFirstStep}
        >
          Back
        </Button>

        {isLastStep ? (
          <Group>
            {isEditMode && onCancel && (
              <Button variant="light" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              color="green"
              leftSection={<IconCheck size={16} />}
              onClick={handleSubmit}
              loading={isSubmitting}
            >
              {isEditMode ? 'Save Changes' : 'Submit Intake'}
            </Button>
          </Group>
        ) : (
          <Button
            rightSection={<IconArrowRight size={16} />}
            onClick={handleNext}
          >
            Continue
          </Button>
        )}
      </Group>

      {mode === 'coordinator-assisted' && (
        <Group justify="center" mt="md">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconDeviceFloppy size={14} />}
            onClick={() => {
              // This would save to backend for coordinator-assisted mode
              showNotification({
                color: 'blue',
                title: 'Draft Saved',
                message: 'Progress saved for later completion',
              });
            }}
          >
            Save Draft
          </Button>
        </Group>
      )}

      {sectionErrors.length > 0 && isLastStep && (
        <Alert color="red" mt="lg" title="Please correct the following errors:">
          <ul>
            {sectionErrors.map((section) =>
              section.errors.map((err) => (
                <li key={`${section.step}-${err.field}`}>
                  {section.step}: {err.message}
                </li>
              ))
            )}
          </ul>
        </Alert>
      )}
    </Card>
  );
}

// Need to import showNotification
import { showNotification } from '@mantine/notifications';
