// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconEdit, IconPlayerPlay, IconPlayerStop, IconSignature } from '@tabler/icons-react';
import type { ActivityDefinition, Patient, Practitioner, ServiceRequest } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMedplum } from '@medplum/react';
import { parseServiceConfig } from '../utils/fhir-extensions';
import type { ConsentStatus } from '../utils/consent';
import { findConsentForServiceRequest, isConsentValid } from '../utils/consent';
import type { GalleryPhoto } from './PhotoGallery';

export type ServiceStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

export interface ServiceCardData {
  serviceRequest: ServiceRequest;
  service: ActivityDefinition;
  photos: GalleryPhoto[];
  treatmentData?: Record<string, unknown>;
  status: ServiceStatus;
  startedAt?: Date;
  completedAt?: Date;
}

interface ServiceCardProps {
  data: ServiceCardData;
  index: number;
  patient: Patient;
  mainProvider?: Practitioner;
  assistantProvider?: Practitioner;
  consentStatus?: ConsentStatus;
  onStartService: (serviceRequestId: string) => void;
  onCompleteService: (serviceRequestId: string) => void;
  onSignConsent?: (serviceRequestId: string) => void;
  onUpdateTreatmentData: (serviceRequestId: string, data: Record<string, unknown>) => void;
  onOpenTreatment?: (serviceRequestId: string) => void;
  readonly?: boolean;
}

export function ServiceCard({
  data,
  index,
  patient,
  mainProvider,
  assistantProvider,
  consentStatus,
  onStartService,
  onCompleteService,
  onSignConsent,
  onUpdateTreatmentData,
  onOpenTreatment,
  readonly = false,
}: ServiceCardProps): JSX.Element {
  const medplum = useMedplum();
  const { serviceRequest, service, photos, treatmentData, status, startedAt, completedAt } = data;

  // Consent state
  const [consent, setConsent] = useState<ConsentStatus | undefined>(consentStatus);
  const [loadingConsent, setLoadingConsent] = useState(!consentStatus);

  // Parse service config
  const config = useMemo(() => parseServiceConfig(service), [service]);

  // Load consent status if not provided
  useEffect(() => {
    if (!consentStatus && config.consentRequired && serviceRequest.id) {
      setLoadingConsent(true);
      findConsentForServiceRequest(medplum, serviceRequest.id)
        .then(consentResource => {
          if (consentResource) {
            const isValid = isConsentValid(consentResource);
            setConsent({
              hasConsent: isValid,
              consent: consentResource,
              signedAt: consentResource.dateTime ? new Date(consentResource.dateTime) : undefined,
              signatures: {
                patient: true,
                witness: true,
              },
            });
          } else {
            setConsent({
              hasConsent: false,
              signatures: { patient: false, witness: false },
            });
          }
        })
        .catch(console.error)
        .finally(() => setLoadingConsent(false));
    }
  }, [consentStatus, config.consentRequired, medplum, serviceRequest.id]);

  // Check if treatment can start
  const canStartTreatment = useMemo(() => {
    if (readonly) return false;
    if (status !== 'pending') return false;
    if (config.consentRequired) {
      return consent?.hasConsent === true;
    }
    return true;
  }, [readonly, status, config.consentRequired, consent]);

  const handleStart = useCallback(() => {
    if (serviceRequest.id) {
      onStartService(serviceRequest.id);
    }
  }, [onStartService, serviceRequest.id]);

  const handleComplete = useCallback(() => {
    if (serviceRequest.id) {
      onCompleteService(serviceRequest.id);
    }
  }, [onCompleteService, serviceRequest.id]);

  const handleOpen = useCallback(() => {
    if (serviceRequest.id && onOpenTreatment) {
      onOpenTreatment(serviceRequest.id);
    }
  }, [serviceRequest.id, onOpenTreatment]);

  // Status badge
  const statusBadge = useMemo(() => {
    switch (status) {
      case 'pending':
        return <Badge color="gray" variant="light">Pending</Badge>;
      case 'in-progress':
        return <Badge color="orange" variant="light">In Progress</Badge>;
      case 'completed':
        return <Badge color="green" variant="light">Completed</Badge>;
      case 'cancelled':
        return <Badge color="red" variant="light">Cancelled</Badge>;
      default:
        return null;
    }
  }, [status]);

  // Consent indicator
  const consentIndicator = useMemo(() => {
    if (!config.consentRequired) {
      return (
        <Tooltip label="Consent not required for this service">
          <ThemeIcon size="sm" color="gray" variant="light">
            <IconCheck size={12} />
          </ThemeIcon>
        </Tooltip>
      );
    }

    if (loadingConsent) {
      return (
        <Badge size="sm" color="gray" variant="light">
          Checking...
        </Badge>
      );
    }

    if (consent?.hasConsent) {
      return (
        <Tooltip label={`Consent signed ${consent.signedAt?.toLocaleDateString()}`}>
          <Badge size="sm" color="green" leftSection={<IconCheck size={12} />}>
            Consent Signed
          </Badge>
        </Tooltip>
      );
    }

    return (
      <Tooltip label="Patient consent required before starting treatment">
        <Badge size="sm" color="red" leftSection={<IconAlertCircle size={12} />}>
          Consent Required
        </Badge>
      </Tooltip>
    );
  }, [config.consentRequired, loadingConsent, consent]);

  return (
    <Card withBorder shadow="sm">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs">
          <Text fw={600} size="lg">
            {index + 1}. {service.title || service.name || 'Unknown Service'}
          </Text>
          {statusBadge}
          {consentIndicator}
        </Group>

        <Group gap="xs">
          {/* Sign Consent button */}
          {config.consentRequired && !consent?.hasConsent && !readonly && onSignConsent && serviceRequest.id && (
            <Button
              size="xs"
              variant="filled"
              color="blue"
              leftSection={<IconSignature size={14} />}
              onClick={() => onSignConsent(serviceRequest.id!)}
            >
              Sign Consent
            </Button>
          )}

          {/* View Consent button */}
          {consent?.hasConsent && !readonly && (
            <Button
              size="xs"
              variant="light"
              color="green"
              leftSection={<IconCheck size={14} />}
              onClick={() => {
                if (onSignConsent && serviceRequest.id) {
                  onSignConsent(serviceRequest.id);
                }
              }}
            >
              View Consent
            </Button>
          )}

          {/* Start / Complete / Edit buttons */}
          {status === 'pending' && !readonly && (
            <Button
              size="xs"
              variant="filled"
              color="orange"
              leftSection={<IconPlayerPlay size={14} />}
              onClick={handleStart}
              disabled={!canStartTreatment}
            >
              Start Treatment
            </Button>
          )}

          {status === 'in-progress' && !readonly && (
            <Button
              size="xs"
              variant="light"
              color="green"
              leftSection={<IconPlayerStop size={14} />}
              onClick={handleComplete}
            >
              Complete Treatment
            </Button>
          )}

          {/* Edit icon — opens TreatmentModal */}
          {(status === 'in-progress' || status === 'completed') && onOpenTreatment && (
            <ActionIcon
              variant="light"
              color={status === 'completed' ? 'gray' : 'blue'}
              onClick={handleOpen}
              size="sm"
            >
              <IconEdit size={16} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      {/* Quick info line */}
      <Group gap="md" mt="xs">
        <Text size="sm" c="dimmed">
          Duration: {(service as ActivityDefinition & { duration?: number }).duration ?? 30} min
        </Text>
        {startedAt && (
          <Text size="sm" c="dimmed">
            Started: {startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
        {completedAt && (
          <Text size="sm" c="dimmed">
            Completed: {completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
        {treatmentData && typeof treatmentData.notes === 'string' && treatmentData.notes.length > 0 ? (
          <Text size="sm" c="dimmed" lineClamp={1}>
            {treatmentData.notes}
          </Text>
        ) : null}
      </Group>
    </Card>
  );
}

export default ServiceCard;
