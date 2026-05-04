// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Alert, Badge, Button, Card, Collapse, Divider, Group, Modal, ScrollArea, Stack, Text, ThemeIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { ActivityDefinition, Consent, Patient, Practitioner, ServiceRequest } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconAlertCircle, IconCheck, IconChevronDown, IconChevronRight, IconPrinter, IconSignature } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { ConsentStatus } from '../utils/consent';
import { findConsentForServiceRequest, getConsentsForServiceRequests } from '../utils/consent';
import { parseServiceConfig } from '../utils/fhir-extensions';
import { ConsentModal } from './ConsentModal';

// Helper component for consent badges
interface ConsentBadgeProps {
  consentRequired: boolean;
  isSigned: boolean;
}

function ConsentBadge({ consentRequired, isSigned }: ConsentBadgeProps): JSX.Element {
  if (!consentRequired) {
    return (
      <Badge color="gray" size="sm">
        Not Required
      </Badge>
    );
  }
  if (isSigned) {
    return (
      <Badge color="green" size="sm" leftSection={<IconCheck size={12} />}>
        Signed
      </Badge>
    );
  }
  return (
    <Badge color="red" size="sm" leftSection={<IconAlertCircle size={12} />}>
      Required
    </Badge>
  );
}

interface ConsentItem {
  serviceRequest: ServiceRequest;
  service: ActivityDefinition;
  consentRequired: boolean;
  status: ConsentStatus;
}

interface ConsentStatusSectionProps {
  patient: Patient;
  serviceRequests: ServiceRequest[];
  services: ActivityDefinition[];
  providers: Practitioner[];
  onConsentSigned: () => void;
}

export function ConsentStatusSection({
  patient,
  serviceRequests,
  services,
  providers,
  onConsentSigned,
}: ConsentStatusSectionProps): JSX.Element {
  const medplum = useMedplum();
  const [opened, { toggle }] = useDisclosure(true);
  const [consentItems, setConsentItems] = useState<ConsentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state for signing consent
  const [signingConsent, setSigningConsent] = useState<{
    serviceRequest: ServiceRequest;
    service: ActivityDefinition;
    witness: Practitioner | null;
  } | null>(null);

  // Modal state for viewing signed consent
  const [viewingConsent, setViewingConsent] = useState<{
    consent: Consent;
    serviceTitle: string;
  } | null>(null);
  const [consentHtml, setConsentHtml] = useState<string>('');

  // Load consent status for all services
  useEffect(() => {
    const loadConsents = async (): Promise<void> => {
      if (serviceRequests.length === 0) {
        setConsentItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const serviceRequestIds = serviceRequests.map((sr) => sr.id).filter((id): id is string => Boolean(id));
      const consentsMap = await getConsentsForServiceRequests(medplum, serviceRequestIds);

      const items: ConsentItem[] = serviceRequests.map((sr) => {
        // Match service by code.coding[0].code (ActivityDefinition.code) not ActivityDefinition.id
        const serviceCode = sr.code?.coding?.[0]?.code;
        const service = services.find((s) => s.code?.coding?.[0]?.code === serviceCode);

        const config = service ? parseServiceConfig(service) : null;
        // Default to consent required only if we have a service config, otherwise assume not required
        const consentRequired = config ? (config.consentRequired ?? true) : false;

        const status = (sr.id && consentsMap.get(sr.id)) || {
          hasConsent: false,
          signatures: { patient: false, witness: false },
        };

        return {
          serviceRequest: sr,
          service: service || ({} as ActivityDefinition),
          consentRequired,
          status,
        };
      });

      setConsentItems(items);
      setLoading(false);
    };

    loadConsents().catch(console.error);
  }, [medplum, serviceRequests, services]);

  const getWitnessForService = useCallback(
    (sr: ServiceRequest): Practitioner | null => {
      // Find provider or assistant assigned to this service
      const performerRef = sr.performer?.[0]?.reference;
      if (performerRef?.startsWith('Practitioner/')) {
        return providers.find((p) => p.id === performerRef.split('/')[1]) || null;
      }
      return null;
    },
    [providers]
  );

  const handleSignConsent = useCallback(
    (item: ConsentItem) => {
      const witness = getWitnessForService(item.serviceRequest);
      setSigningConsent({
        serviceRequest: item.serviceRequest,
        service: item.service,
        witness,
      });
    },
    [getWitnessForService]
  );

  const handleConsentSuccess = useCallback(() => {
    setSigningConsent(null);
    onConsentSigned();
  }, [onConsentSigned]);

  const handleViewSignedConsent = useCallback(async (item: ConsentItem) => {
    if (!item.serviceRequest.id) {
      return;
    }
    const consent = await findConsentForServiceRequest(medplum, item.serviceRequest.id);
    if (consent?.sourceAttachment?.data) {
      // Decode base64 HTML
      const html = typeof window !== 'undefined'
        ? decodeURIComponent(escape(atob(consent.sourceAttachment.data)))
        : Buffer.from(consent.sourceAttachment.data, 'base64').toString('utf-8');
      setConsentHtml(html);
      setViewingConsent({
        consent,
        serviceTitle: item.service.title || 'Treatment',
      });
    }
  }, [medplum]);

  const handlePrintConsent = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (printWindow && consentHtml) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Consent Document</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              img { max-width: 100%; }
            </style>
          </head>
          <body>
            ${consentHtml}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, [consentHtml]);

  // Helper to determine border color
  const getBorderColor = (consentRequired: boolean, isSigned: boolean): string => {
    if (!consentRequired) {
      return '#dee2e6';
    } // gray
    if (isSigned) {
      return '#40c057';
    } // green
    return '#fa5252'; // red
  };

  const pendingCount = consentItems.filter((item) => item.consentRequired && !item.status.hasConsent).length;

  const signedCount = consentItems.filter((item) => item.consentRequired && item.status.hasConsent).length;

  const notRequiredCount = consentItems.filter((item) => !item.consentRequired).length;

  if (loading) {
    return (
      <Card withBorder>
        <Text c="dimmed">Loading consent status...</Text>
      </Card>
    );
  }

  if (consentItems.length === 0) {
    return <></>;
  }

  return (
    <>
      <Card withBorder>
        <Group justify="space-between" mb="xs">
          <Group>
            <ThemeIcon size="lg" color={pendingCount > 0 ? 'yellow' : 'green'}>
              <IconSignature size={24} />
            </ThemeIcon>
            <div>
              <Text fw={500}>Treatment Consents</Text>
              <Text size="sm" c="dimmed">
                {signedCount} of {consentItems.filter((i) => i.consentRequired).length} signed
                {notRequiredCount > 0 && ` (${notRequiredCount} not required)`}
              </Text>
            </div>
          </Group>
          <Button variant="subtle" onClick={toggle} rightSection={opened ? <IconChevronDown /> : <IconChevronRight />}>
            {opened ? 'Hide' : 'Show'}
          </Button>
        </Group>

        <Collapse in={opened}>
          <Divider my="md" />

          {pendingCount > 0 && (
            <Alert icon={<IconAlertCircle size={16} />} color="yellow" mb="md">
              <Text fw={500}>Consent Required</Text>
              <Text size="sm">
                {pendingCount} service(s) require patient consent before treatment can begin. Please ensure patient
                reviews and signs all required consents.
              </Text>
            </Alert>
          )}

          <Stack gap="xs">
            {consentItems.map((item, index) => {
              const { serviceRequest, service, consentRequired, status } = item;
              const isSigned = status.hasConsent;
              const isExpired = status.expiresAt && status.expiresAt < new Date();

              return (
                <Card
                  key={serviceRequest.id}
                  withBorder
                  p="sm"
                  style={{
                    borderColor: getBorderColor(consentRequired, isSigned),
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs">
                      <Text fw={500}>
                        {index + 1}. {service.title || 'Unknown Service'}
                      </Text>

                      <ConsentBadge consentRequired={consentRequired} isSigned={isSigned} />

                      {isExpired && (
                        <Badge color="orange" size="sm">
                          Expired
                        </Badge>
                      )}
                    </Group>

              <Group gap="xs">
                {consentRequired && isSigned && (
                  <>
                    <Text size="xs" c="dimmed">
                      Signed: {status.signedAt?.toLocaleString()}
                    </Text>
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconPrinter size={14} />}
                      onClick={() => handleViewSignedConsent(item)}
                    >
                      View Signed
                    </Button>
                  </>
                )}

                      {consentRequired && !isSigned && (
                        <Button size="xs" color="red" onClick={() => handleSignConsent(item)}>
                          Sign Consent
                        </Button>
                      )}

                      {consentRequired && isSigned && status.signatures.witness && (
                        <Badge color="blue" size="sm" variant="light">
                          Witnessed
                        </Badge>
                      )}
                    </Group>
                  </Group>
                </Card>
              );
            })}
          </Stack>

          {pendingCount > 1 && (
            <Group justify="center" mt="md">
              <Button
                variant="light"
                color="red"
                onClick={() => {
                  // Open batch consent modal for first pending service
                  const firstPending = consentItems.find((i) => i.consentRequired && !i.status.hasConsent);
                  if (firstPending) {
                    handleSignConsent(firstPending);
                  }
                }}
              >
                Sign All Pending Consents
              </Button>
            </Group>
          )}
        </Collapse>
      </Card>

      {/* Consent Signing Modal */}
      {signingConsent && (
        <ConsentModal
          isOpen={!!signingConsent}
          onClose={() => setSigningConsent(null)}
          onSuccess={handleConsentSuccess}
          patient={patient}
          serviceRequest={signingConsent.serviceRequest}
          service={signingConsent.service}
          witness={signingConsent.witness}
        />
      )}

      {/* View Signed Consent Modal */}
      <Modal
        opened={!!viewingConsent}
        onClose={() => setViewingConsent(null)}
        title={`${viewingConsent?.serviceTitle || 'Treatment'} Consent`}
        size="xl"
      >
        <Stack>
          <ScrollArea h={500}>
            <div
              dangerouslySetInnerHTML={{ __html: consentHtml }}
              style={{
                padding: '20px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
              }}
            />
          </ScrollArea>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setViewingConsent(null)}>
              Close
            </Button>
            <Button leftSection={<IconPrinter size={16} />} onClick={handlePrintConsent}>
              Print
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
