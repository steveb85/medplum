// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { ActivityDefinition, Patient, Practitioner, ServiceRequest } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconAlertCircle, IconCheck, IconSignature } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConsentSignatureData } from '../utils/consent';
import { createTreatmentConsent } from '../utils/consent';
import { recordConsentSigned } from '../utils/audit-events';
import { parseServiceConfig } from '../utils/fhir-extensions';
import { SignaturePad } from './SignaturePad';

// Default consent text generator
const getDefaultConsentText = (serviceName: string): string => {
  return `
<h2>${serviceName} Informed Consent</h2>

<p>I have been informed about the ${serviceName} procedure including:</p>

<ul>
<li>The nature and purpose of the treatment</li>
<li>Potential risks and side effects</li>
<li>Expected outcomes and benefits</li>
<li>Alternative treatments available</li>
<li>Post-treatment care instructions</li>
</ul>

<p>I understand that results may vary and that no guarantees have been made.
I have had the opportunity to ask questions and all my questions have been answered to my satisfaction.</p>

<p>I consent to receiving ${serviceName} treatment and understand that I may withdraw
my consent at any time.</p>

<p><strong>Patient Rights:</strong> I understand that I have the right to:</p>
<ul>
<li>Refuse treatment</li>
<li>Ask questions at any time</li>
<li>Receive information in a language I understand</li>
<li>Confidentiality of my medical information</li>
</ul>

<p><strong>Risks and Side Effects:</strong></p>
<p>Common side effects may include redness, swelling, bruising, and discomfort at the treatment site.
These effects are typically temporary and resolve within a few days to weeks.</p>

<p><strong>Alternatives:</strong></p>
<p>I understand that alternative treatments are available and have been explained to me.
I have chosen to proceed with ${serviceName} after considering these options.</p>

<p><strong>Post-Treatment Care:</strong></p>
<p>I agree to follow all post-treatment instructions provided by my healthcare provider.
This may include avoiding certain activities, applying ice or heat, and taking prescribed medications.</p>

<p><strong>Photography:</strong></p>
<p>I consent to the taking of photographs before and after treatment for medical records and
educational purposes. I understand that my identity will be protected.</p>

<p><strong>Financial Responsibility:</strong></p>
<p>I understand that I am financially responsible for the treatment costs and that
insurance coverage varies. Payment is due at the time of service.</p>

<p><strong>Follow-Up:</strong></p>
<p>I agree to attend any scheduled follow-up appointments to monitor my progress and
address any concerns that may arise.</p>

<p><strong>Voluntary Consent:</strong></p>
<p>I am signing this consent form voluntarily. No one has pressured me into receiving
this treatment. I understand that I can withdraw my consent at any time before or during treatment.</p>
`;
};

interface ConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patient: Patient;
  serviceRequest: ServiceRequest;
  service: ActivityDefinition;
  witness: Practitioner | null; // Provider or assistant who witnesses
}

export function ConsentModal({
  isOpen,
  onClose,
  onSuccess,
  patient,
  serviceRequest,
  service,
  witness,
}: ConsentModalProps): JSX.Element {
  const medplum = useMedplum();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Signature states
  const [patientSignature, setPatientSignature] = useState<string | null>(null);
  const [witnessSignature, setWitnessSignature] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [isGuardian, setIsGuardian] = useState(false);

  // Consent acknowledgment checkbox
  const [hasReadConsent, setHasReadConsent] = useState(false);

  // Compute consent text
  const { consentText, consentCategory } = useMemo(() => {
    if (!service) {
      return { consentText: '', consentCategory: '' };
    }
    const config = parseServiceConfig(service);
    return {
      consentText: config.consentText || getDefaultConsentText(service.title || 'Treatment'),
      consentCategory: config.consentCategory || service.name || 'treatment',
    };
  }, [service]);

  // Reset state when modal opens
  useEffect(() => {
    const open = async (): Promise<void> => {
      setPatientSignature(null);
      setWitnessSignature(null);
      // Auto-fill signer name with patient's name
      const patientName = patient.name?.[0]
        ? `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim()
        : '';
      setSignerName(patientName);
      setIsGuardian(false);
      setHasReadConsent(false);
    };
    if (isOpen) {
      open().catch(console.error);
    }
  }, [isOpen, patient]);

  const canSubmit = patientSignature && witnessSignature && signerName.trim() && hasReadConsent;

  const handleSubmit = useCallback(async () => {
    if (!patientSignature || !witnessSignature || !signerName.trim()) {
      showNotification({
        color: 'red',
        title: 'Missing Information',
        message: 'Please complete all signatures and provide the signer name',
      });
      return;
    }

    if (!hasReadConsent) {
      showNotification({
        color: 'yellow',
        title: 'Please Confirm',
        message: 'Please confirm that you have read and understand the consent document',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();

      // Create patient signature data
      const patientSigData: ConsentSignatureData = {
        signatureImage: patientSignature,
        signedAt: now.toISOString(),
        signedBy: isGuardian ? 'guardian' : 'patient',
        signerName: signerName.trim(),
        signerReference: isGuardian
          ? `RelatedPerson/${patient.id}` // Simplified - should create RelatedPerson
          : `Patient/${patient.id}`,
      };

      // Create witness signature data
      const witnessSigData: ConsentSignatureData = {
        signatureImage: witnessSignature,
        signedAt: now.toISOString(),
        signedBy: 'patient', // Witness
        signerName: witness?.name?.[0]
          ? `${witness.name[0].given?.[0] || ''} ${witness.name[0].family || ''}`.trim()
          : 'Witness',
        signerReference: witness ? `Practitioner/${witness.id}` : `Patient/${patient.id}`,
      };

    const consent = await createTreatmentConsent(medplum, {
      patient,
      serviceRequest,
      consentCategory,
      consentText,
      patientSignature: patientSigData,
      witnessSignature: witnessSigData,
      organizationId: service.meta?.project ?? 'default',
    });

    // Record consent signing in audit trail
    // Get current logged-in user (who clicked the button) as the witness
    const currentUser = medplum.getProfile();
    const currentUserPractitioner = currentUser ? {
      resourceType: 'Practitioner' as const,
      id: currentUser.id || '',
      name: currentUser.name,
    } : undefined;
    
    // Get service name for audit trail
    const serviceName = service.title || service.name || 'Unknown Service';
    
    await recordConsentSigned(medplum, patient, consent, serviceRequest, 'patient', currentUserPractitioner, serviceName);

    showNotification({
      color: 'green',
      title: 'Success',
      message: 'Consent signed successfully',
    });

    onSuccess();
    onClose();
    } catch (err) {
      console.error('Error signing consent:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to save consent. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    patientSignature,
    witnessSignature,
    signerName,
    isGuardian,
    hasReadConsent,
    patient,
    serviceRequest,
    consentCategory,
    consentText,
    witness,
    medplum,
    onSuccess,
    onClose,
    service,
  ]);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group>
          <IconSignature size={24} />
          <Title order={4}>Treatment Consent</Title>
        </Group>
      }
      size="100%"
      fullScreen
      padding="md"
    >
      <Stack gap="md" style={{ height: '100%' }}>
        {/* Service Info - Compact header */}
        <Card withBorder p="sm">
          <Group justify="space-between">
            <div>
              <Text fw={500}>{service?.title || 'Treatment'}</Text>
              <Text size="sm" c="dimmed">
                Patient: {patient.name?.[0]?.given?.[0]} {patient.name?.[0]?.family}
              </Text>
            </div>
            <Badge color="blue">{consentCategory}</Badge>
          </Group>
        </Card>

        {/* TWO SECTION LAYOUT - Stacks vertically on mobile */}
        <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
{/* SECTION 1: Consent Document - Takes 60% */}
        <Card
          withBorder
          style={{
            flex: 1.5,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Text fw={500} mb="xs">Consent Document</Text>

          <ScrollArea style={{ flex: 1, minHeight: 0 }}>
            <div
              dangerouslySetInnerHTML={{ __html: consentText }}
              style={{
                padding: '24px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                minHeight: '100%',
                fontSize: '14px',
                lineHeight: '1.6',
              }}
            />
            {/* Add extra space at bottom to ensure last content is readable */}
            <div style={{ height: '100px' }} />
          </ScrollArea>

          {/* Consent Acknowledgment Checkbox */}
          <Checkbox
            mt="md"
            label="I have read and understand the consent document above"
            description="By checking this box, I acknowledge that I have reviewed all the information provided"
            checked={hasReadConsent}
            onChange={(event) => setHasReadConsent(event.currentTarget.checked)}
            required
          />
        </Card>

          {/* SECTION 2: Signatures - Takes 40%, always visible */}
          <Card
            withBorder
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Text fw={500} mb="md">
              Signatures Required
            </Text>

            <Alert icon={<IconAlertCircle size={16} />} color="blue" mb="md">
              Both patient/guardian and witness signatures are required. The witness should be the assigned provider or
              assistant.
            </Alert>

            {/* Signer Name Input */}
            <TextInput
              label="Signer Name"
              description="Name of the person signing (patient or guardian)"
              placeholder="Enter full name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              mb="md"
              required
            />

            <Stack gap="md" style={{ flex: 1, overflow: 'auto' }}>
              {/* Patient/Guardian Signature */}
              <Card withBorder p="sm">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={500} size="sm">
                      Patient/Guardian Signature
                    </Text>
                    <Badge color={patientSignature ? 'green' : 'red'} size="xs">
                      {patientSignature ? 'Signed' : 'Required'}
                    </Badge>
                  </Group>

                  <SignaturePad
                    label="Draw signature here"
                    value={patientSignature}
                    onChange={setPatientSignature}
                    height={100}
                  />

                  {patientSignature && (
                    <Text size="xs" c="dimmed">
                      Signed: {new Date().toLocaleDateString()}
                    </Text>
                  )}
                </Stack>
              </Card>

              {/* Witness Signature */}
              <Card withBorder p="sm">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={500} size="sm">
                      Witness Signature
                    </Text>
                    <Badge color={witnessSignature ? 'green' : 'red'} size="xs">
                      {witnessSignature ? 'Signed' : 'Required'}
                    </Badge>
                  </Group>

                  {witness ? (
                    <Text size="xs" c="dimmed">
                      Witness: {witness.name?.[0]?.given?.[0]} {witness.name?.[0]?.family}
                    </Text>
                  ) : (
                    <Alert color="yellow" p="xs">
                      <Text size="xs">No provider/assistant assigned yet</Text>
                    </Alert>
                  )}

                  <SignaturePad
                    label="Draw witness signature here"
                    value={witnessSignature}
                    onChange={setWitnessSignature}
                    height={100}
                    disabled={!witness}
                  />

                  {witnessSignature && (
                    <Text size="xs" c="dimmed">
                      Signed: {new Date().toLocaleDateString()}
                    </Text>
                  )}
                </Stack>
              </Card>
            </Stack>

            {/* Sign Button - Conditional */}
            <Box mt="auto" pt="md">
              <Divider mb="md" />
              <Group justify="flex-end" gap="xs">
                <Button variant="light" color="gray" onClick={onClose}>
                  Cancel
                </Button>

{!hasReadConsent ? (
            <Button
              variant="light"
              color="yellow"
              leftSection={<IconAlertCircle size={16} />}
              disabled
            >
              Confirm Consent First
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={!canSubmit}
              color={canSubmit ? 'green' : 'gray'}
              leftSection={<IconCheck size={16} />}
            >
              Sign Consent
            </Button>
          )}
        </Group>

        {!hasReadConsent && (
          <Text size="xs" c="dimmed" ta="right" mt="xs">
            Please check the confirmation box above before signing
          </Text>
        )}
            </Box>
          </Card>
        </Stack>
      </Stack>
    </Modal>
  );
}

export default ConsentModal;
