// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * useIntakeSubmission Hook
 * Manages submission of intake form data to FHIR resources
 */

import { showNotification } from '@mantine/notifications';
import { normalizeErrorString } from '@medplum/core';
import type { Patient, Practitioner } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { useCallback, useState } from 'react';
import type { IntakeFormData, IntakeMode, IntakeNotification, IntakeSubmissionResult } from '../types/intake';
import {
  createPatientFromIntake,
  updatePatientFromIntake,
  createConsentsFromIntake,
  createCoverageFromIntake,
  createConditionsFromIntake,
  createMedicationStatementsFromIntake,
  createAllergiesFromIntake,
  createObservationsFromIntake,
  createFlagsFromIntake,
  createQuestionnaireResponseFromIntake,
} from '../utils/intakeToFhir';

interface UseIntakeSubmissionReturn {
  isSubmitting: boolean;
  submitIntake: (data: IntakeFormData, mode: IntakeMode, patientId?: string) => Promise<IntakeSubmissionResult>;
}

export function useIntakeSubmission(): UseIntakeSubmissionReturn {
  const medplum = useMedplum();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitIntake = useCallback(
    async (data: IntakeFormData, mode: IntakeMode, existingPatientId?: string): Promise<IntakeSubmissionResult> => {
      setIsSubmitting(true);

      try {
        // Get current practitioner if logged in
        const profile = medplum.getProfile() as Practitioner | undefined;

        let patientId: string;

        if (existingPatientId) {
          // UPDATE MODE: Update existing patient
          patientId = existingPatientId;

          // 1. Fetch existing patient and update
          const existingPatient = await medplum.readResource('Patient', patientId);
          const updatedPatient = updatePatientFromIntake(existingPatient, data, profile);
          await medplum.updateResource(updatedPatient);

          // 2. Delete and recreate related resources to ensure clean state
          // Delete existing resources first
          await deleteExistingIntakeResources(medplum, patientId);

          // 3. Create new related resources
          await Promise.all([
            // Consents
            ...createConsentsFromIntake(patientId, data).map((consent) => medplum.createResource(consent)),

            // Coverage (if insurance provided)
            (() => {
              const coverage = createCoverageFromIntake(patientId, data);
              return coverage ? medplum.createResource(coverage) : Promise.resolve();
            })(),

            // Conditions
            ...createConditionsFromIntake(patientId, data).map((condition) => medplum.createResource(condition)),

            // Medications
            ...createMedicationStatementsFromIntake(patientId, data).map((med) => medplum.createResource(med)),

            // Allergies
            ...createAllergiesFromIntake(patientId, data).map((allergy) => medplum.createResource(allergy)),

            // Observations
            ...createObservationsFromIntake(patientId, data).map((obs) => medplum.createResource(obs)),

            // Flags
            ...createFlagsFromIntake(patientId, data).map((flag) => medplum.createResource(flag)),

            // QuestionnaireResponse (raw data)
            medplum.createResource(createQuestionnaireResponseFromIntake(patientId, data, mode)),
          ]);

          // Send notification about patient update
          await sendUpdateNotification(medplum, patientId, data);

          showNotification({
            color: 'green',
            title: 'Success',
            message: 'Patient information updated successfully',
          });
        } else {
          // CREATE MODE: Create new patient
          // 1. Create Patient
          const patient = await medplum.createResource(createPatientFromIntake(data, profile));
          patientId = patient.id || '';

          if (!patientId) {
            throw new Error('Failed to create patient');
          }

          // 2. Create all related resources in parallel
          await Promise.all([
            // Consents
            ...createConsentsFromIntake(patientId, data).map((consent) => medplum.createResource(consent)),

            // Coverage (if insurance provided)
            (() => {
              const coverage = createCoverageFromIntake(patientId, data);
              return coverage ? medplum.createResource(coverage) : Promise.resolve();
            })(),

            // Conditions
            ...createConditionsFromIntake(patientId, data).map((condition) => medplum.createResource(condition)),

            // Medications
            ...createMedicationStatementsFromIntake(patientId, data).map((med) => medplum.createResource(med)),

            // Allergies
            ...createAllergiesFromIntake(patientId, data).map((allergy) => medplum.createResource(allergy)),

            // Observations
            ...createObservationsFromIntake(patientId, data).map((obs) => medplum.createResource(obs)),

            // Flags
            ...createFlagsFromIntake(patientId, data).map((flag) => medplum.createResource(flag)),

            // QuestionnaireResponse (raw data)
            medplum.createResource(createQuestionnaireResponseFromIntake(patientId, data, mode)),
          ]);

          // Send notification to staff about new patient
          await sendIntakeNotification(medplum, patientId, data);

          showNotification({
            color: 'green',
            title: 'Success',
            message: 'Patient intake completed successfully',
          });
        }

        return {
          success: true,
          patientId,
        };
      } catch (err) {
        console.error('Intake submission error:', err);
        showNotification({
          color: 'red',
          title: 'Error',
          message: normalizeErrorString(err),
        });

        return {
          success: false,
          errors: [normalizeErrorString(err)],
        };
      } finally {
        setIsSubmitting(false);
      }
    },
    [medplum]
  );

  return {
    isSubmitting,
    submitIntake,
  };
}

async function sendIntakeNotification(
  medplum: ReturnType<typeof useMedplum>,
  patientId: string,
  data: IntakeFormData
): Promise<void> {
  try {
    // Prepare notification data
    const notification: IntakeNotification = {
      type: 'new-patient-intake',
      patientId,
      patientName: `${data.firstName} ${data.lastName}`,
      blockers: [], // Will be populated based on data
      submittedAt: new Date().toISOString(),
    };

    // Calculate blockers
    if (data.pregnancyStatus === 'pregnant') {
      notification.blockers.push({
        id: 'pregnancy',
        title: 'Pregnancy',
        message: 'Patient is pregnant',
        severity: 'warning',
        affectedTreatments: ['Botox', 'Fillers', 'Laser'],
        fieldPath: 'pregnancyStatus',
      });
    }

    if (data.medications?.some((m) => m.isAccutane)) {
      notification.blockers.push({
        id: 'accutane',
        title: 'Accutane',
        message: 'Patient is on Accutane',
        severity: 'blocking',
        affectedTreatments: ['Laser', 'Peels'],
        fieldPath: 'medications',
      });
    }

    // Create Communication resource for notification
    await medplum.createResource({
      resourceType: 'Communication',
      status: 'completed',
      category: [
        {
          coding: [
            {
              system: 'http://melissaknudson.com/fhir/CodeSystem/communication-category',
              code: 'new-patient',
              display: 'New Patient Intake',
            },
          ],
        },
      ],
      subject: { reference: `Patient/${patientId}` },
      sent: new Date().toISOString(),
      payload: [
        {
          contentString: JSON.stringify(notification),
        },
      ],
      extension: [
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-type',
          valueString: 'broadcast',
        },
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-urgency',
          valueString: notification.blockers.length > 0 ? 'high' : 'normal',
        },
      ],
    });

    // Also create a Task for coordinators to review
    if (notification.blockers.length > 0) {
      await medplum.createResource({
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        code: {
          coding: [
            {
              system: 'http://melissaknudson.com/fhir/CodeSystem/task-code',
              code: 'review-intake',
              display: 'Review Patient Intake',
            },
          ],
        },
        description: `New patient intake requires review due to ${notification.blockers.length} blocker(s): ${notification.blockers
          .map((b) => b.title)
          .join(', ')}`,
        for: { reference: `Patient/${patientId}` },
        authoredOn: new Date().toISOString(),
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/task-priority',
            valueString: 'high',
          },
        ],
      });
    }
  } catch (err) {
    console.error('Failed to send intake notification:', err);
  }
}

async function sendUpdateNotification(
  medplum: ReturnType<typeof useMedplum>,
  patientId: string,
  data: IntakeFormData
): Promise<void> {
  try {
    await medplum.createResource({
      resourceType: 'Communication',
      status: 'completed',
      category: [
        {
          coding: [
            {
              system: 'http://melissaknudson.com/fhir/CodeSystem/communication-category',
              code: 'patient-updated',
              display: 'Patient Updated',
            },
          ],
        },
      ],
      subject: { reference: `Patient/${patientId}` },
      sent: new Date().toISOString(),
      payload: [
        {
          contentString: JSON.stringify({
            type: 'patient-updated',
            patientId,
            patientName: `${data.firstName} ${data.lastName}`,
            updatedAt: new Date().toISOString(),
          }),
        },
      ],
    });
  } catch (err) {
    console.error('Failed to send update notification:', err);
  }
}

async function deleteExistingIntakeResources(
  medplum: ReturnType<typeof useMedplum>,
  patientId: string
): Promise<void> {
  type ResourceType = 'Consent' | 'Coverage' | 'Condition' | 'MedicationStatement' | 'AllergyIntolerance' | 'Observation' | 'Flag' | 'RelatedPerson';

  // Delete and recreate these resources to ensure clean state
  const resourceTypes: { type: ResourceType; query: string }[] = [
    { type: 'Consent', query: `patient=Patient/${patientId}` },
    { type: 'Coverage', query: `beneficiary=Patient/${patientId}` },
    { type: 'Condition', query: `patient=Patient/${patientId}&category=problem-list-item,contraindication` },
    { type: 'MedicationStatement', query: `subject=Patient/${patientId}` },
    { type: 'AllergyIntolerance', query: `patient=Patient/${patientId}` },
    { type: 'Observation', query: `subject=Patient/${patientId}&category=aesthetic-history,surgical-history` },
    { type: 'Flag', query: `patient=Patient/${patientId}&category=treatment-goals` },
    { type: 'RelatedPerson', query: `patient=Patient/${patientId}&relationship=emergency` },
  ];

  // Delete resources in parallel, but don't fail if some don't exist
  await Promise.all(
    resourceTypes.map(async ({ type, query }) => {
      try {
        const bundle = await medplum.search(type, query);
        if (bundle.entry) {
          await Promise.all(
            bundle.entry.map(async (entry) => {
              if (entry.resource?.id) {
                try {
                  await medplum.deleteResource(type, entry.resource.id);
                } catch {
                  // Ignore errors for individual deletions
                }
              }
            })
          );
        }
      } catch {
        // Ignore search errors
      }
    })
  );
}
