// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * ReviewSection Component
 * Step 9: Review all information and submit
 */

import {
  Accordion,
  Alert,
  Button,
  Checkbox,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconCheck, IconAlertCircle, IconFileCheck } from '@tabler/icons-react';
import type { JSX } from 'react';
import { SignatureCanvas } from '../components/SignatureCanvas';
import type { IntakeFormData } from '../types/intake';
import {
  formatPhoneNumber,
  formatDateOfBirth,
  formatReferralSource,
  formatMedicalCondition,
  formatAestheticConcern,
  formatTreatmentArea,
  formatPregnancyStatus,
  formatProcedureType,
} from '../utils/formatters';

interface ReviewSectionProps {
  data: Partial<IntakeFormData>;
  onChange: (updates: Partial<IntakeFormData>) => void;
  errors: Record<string, string>;
}

export function ReviewSection({ data, onChange, errors }: ReviewSectionProps): JSX.Element {
  const renderDemographics = (): JSX.Element => (
    <Stack gap="xs">
      <Group>
        <Text fw={500}>Name:</Text>
        <Text>{data.firstName} {data.lastName}</Text>
        {data.preferredName && <Text c="dimmed">(Preferred: {data.preferredName})</Text>}
      </Group>
      <Group>
        <Text fw={500}>DOB:</Text>
        <Text>{formatDateOfBirth(data.dateOfBirth)}</Text>
      </Group>
      <Group>
        <Text fw={500}>Contact:</Text>
        <Text>{formatPhoneNumber(data.phone || '')} | {data.email}</Text>
      </Group>
      <Group>
        <Text fw={500}>Address:</Text>
        <Text>
          {data.address?.street}, {data.address?.city}, {data.address?.state} {data.address?.zip}
        </Text>
      </Group>
      <Group>
        <Text fw={500}>Referred by:</Text>
        <Text>{formatReferralSource(data.referralSource || '')}</Text>
      </Group>
    </Stack>
  );

  const renderEmergencyContact = (): JSX.Element => (
    <Stack gap="xs">
      <Group>
        <Text fw={500}>Name:</Text>
        <Text>{data.emergencyContact?.name}</Text>
      </Group>
      <Group>
        <Text fw={500}>Relationship:</Text>
        <Text>{data.emergencyContact?.relationship}</Text>
      </Group>
      <Group>
        <Text fw={500}>Phone:</Text>
        <Text>{formatPhoneNumber(data.emergencyContact?.phone || '')}</Text>
      </Group>
    </Stack>
  );

  const renderInsurance = (): JSX.Element => {
    if (!data.insurance?.hasInsurance) {
      return <Text>No insurance provided (self-pay)</Text>;
    }
    return (
      <Stack gap="xs">
        <Group>
          <Text fw={500}>Provider:</Text>
          <Text>{data.insurance.provider}</Text>
        </Group>
        <Group>
          <Text fw={500}>Policy #:</Text>
          <Text>{data.insurance.policyNumber}</Text>
        </Group>
        {data.insurance.groupNumber && (
          <Group>
            <Text fw={500}>Group #:</Text>
            <Text>{data.insurance.groupNumber}</Text>
          </Group>
        )}
      </Stack>
    );
  };

  const renderMedicalHistory = (): JSX.Element => (
    <Stack gap="xs">
      <div>
        <Text fw={500} size="sm">Medical Conditions:</Text>
        <Text size="sm">
          {data.medicalConditions?.map(formatMedicalCondition).join(', ') || 'None'}
        </Text>
      </div>
      <div>
        <Text fw={500} size="sm">Medications ({data.medications?.length || 0}):</Text>
        {data.medications?.map((med) => (
          <Text key={med.id} size="sm" c="dimmed">
            • {med.name} {med.dosage} - {med.frequency}
            {med.isAccutane && ' (Accutane)'}
            {med.isBloodThinner && ' (Blood thinner)'}
          </Text>
        ))}
      </div>
      <div>
        <Text fw={500} size="sm">Allergies ({data.allergies?.length || 0}):</Text>
        {data.allergies?.map((allergy) => (
          <Text key={allergy.id} size="sm" c="dimmed">
            • {allergy.substance} ({allergy.severity})
          </Text>
        ))}
        {!data.allergies?.length && <Text size="sm" c="dimmed">None reported</Text>}
      </div>
    </Stack>
  );

  const renderTreatmentGoals = (): JSX.Element => (
    <Stack gap="xs">
      <div>
        <Text fw={500} size="sm">Primary Concerns:</Text>
        <Text size="sm">
          {data.primaryConcerns?.map(formatAestheticConcern).join(', ')}
        </Text>
      </div>
      <div>
        <Text fw={500} size="sm">Treatment Areas:</Text>
        <Text size="sm">
          {data.treatmentAreas?.map(formatTreatmentArea).join(', ')}
        </Text>
      </div>
      {(data.previousAestheticTreatments || []).length > 0 && (
        <div>
          <Text fw={500} size="sm">Previous Treatments:</Text>
          {(data.previousAestheticTreatments || []).map((treatment) => (
            <Text key={treatment.id} size="sm" c="dimmed">
              • {formatProcedureType(treatment.procedure)} ({treatment.when})
            </Text>
          ))}
        </div>
      )}
      <div>
        <Text fw={500} size="sm">Skincare:</Text>
        <Text size="sm" c="dimmed">
          Retinoids: {data.usesRetinoid ? 'Yes' : 'No'} | Acids: {data.usesAcids ? 'Yes' : 'No'}
        </Text>
      </div>
    </Stack>
  );

  const renderContraindications = (): JSX.Element => (
    <Stack gap="xs">
      <Group>
        <Text fw={500}>Pregnancy:</Text>
        <Text>{formatPregnancyStatus(data.pregnancyStatus || '')}</Text>
      </Group>
      <Group>
        <Text fw={500}>Sun Exposure:</Text>
        <Text>{data.sunExposure}</Text>
      </Group>
      <Group>
        <Text fw={500}>Active Infections:</Text>
        <Text>{data.hasActiveInfection ? `Yes - ${data.infectionType}` : 'No'}</Text>
      </Group>
    </Stack>
  );

  return (
    <Stack gap="lg">
      <div>
        <Title order={3} mb="xs">
          <IconFileCheck size={24} style={{ marginRight: '8px', display: 'inline' }} />
          Review Your Information
        </Title>
        <Text c="dimmed">
          Please review all the information you've entered. Once you submit, you'll be able
          to schedule your appointment.
        </Text>
      </div>

      <Accordion defaultValue="demographics" variant="separated">
        <Accordion.Item value="demographics">
          <Accordion.Control>Demographics</Accordion.Control>
          <Accordion.Panel>{renderDemographics()}</Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="emergency">
          <Accordion.Control>Emergency Contact</Accordion.Control>
          <Accordion.Panel>{renderEmergencyContact()}</Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="insurance">
          <Accordion.Control>Insurance</Accordion.Control>
          <Accordion.Panel>{renderInsurance()}</Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="medical">
          <Accordion.Control>Medical History</Accordion.Control>
          <Accordion.Panel>{renderMedicalHistory()}</Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="goals">
          <Accordion.Control>Treatment Goals</Accordion.Control>
          <Accordion.Panel>{renderTreatmentGoals()}</Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="contraindications">
          <Accordion.Control>Safety Screening</Accordion.Control>
          <Accordion.Panel>{renderContraindications()}</Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <Alert color="blue" icon={<IconCheck size={16} />}>
        <Text fw={500} size="sm">
          Consents Acknowledged
        </Text>
        <Text size="sm">
          HIPAA Privacy Notice • Terms of Service • Photo Release
        </Text>
      </Alert>

      <div>
        <SignatureCanvas
          label="Digital Signature"
          description="Please sign your full name. This confirms all information is accurate."
          required
          value={data.signatureData || ''}
          onChange={(signature) => onChange({ signatureData: signature })}
          error={errors.signatureData}
        />
      </div>

      <Checkbox
        label="I confirm that all information provided is accurate and complete to the best of my knowledge."
        checked={data.informationConfirmed || false}
        onChange={(e) => onChange({ informationConfirmed: e.currentTarget.checked })}
        error={errors.informationConfirmed}
        required
      />

      <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
        <Text size="sm">
          By submitting this form, you authorize Studio Assistant to:
        </Text>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>Create and maintain your medical record</li>
          <li>Contact you regarding appointments and care</li>
          <li>Share information with your emergency contact if needed</li>
        </ul>
      </Alert>
    </Stack>
  );
}
