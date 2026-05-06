// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * ServiceCard Component
 * 
 * Displays a service in the booking detail view with:
 * - Consent gating (Start button disabled until consent signed)
 * - Inline treatment form (expanded/collapsed)
 * - Photo gallery integration
 * - Status management
 */

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Divider,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconAlertCircle, IconCheck, IconChevronDown, IconChevronRight, IconPhoto, IconPlayerPlay, IconPlayerStop, IconSignature } from '@tabler/icons-react';
import type { ActivityDefinition, Media, Patient, Practitioner, ServiceRequest } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMedplum } from '@medplum/react';
import { parseServiceConfig } from '../utils/fhir-extensions';
import type { ConsentStatus } from '../utils/consent';
import { findConsentForServiceRequest, isConsentValid } from '../utils/consent';
import { GenericTreatmentForm, type GenericTreatmentData } from './treatment-forms';
import type { GalleryPhoto } from './PhotoGallery';
import { PhotoGallery } from './PhotoGallery';

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
  onUploadPhotos: (serviceRequestId: string) => void;
  onDeletePhoto: (serviceRequestId: string, photoId: string) => void;
  onUpdatePhotoMetadata: (serviceRequestId: string, photoId: string, metadata: unknown) => void;
  readonly?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
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
  onUploadPhotos,
  onDeletePhoto,
  onUpdatePhotoMetadata,
  readonly = false,
  expanded: controlledExpanded,
  onToggleExpand,
}: ServiceCardProps): JSX.Element {
  const medplum = useMedplum();
  const { serviceRequest, service, photos, treatmentData, status, startedAt, completedAt } = data;
  
  // Local expanded state if not controlled
  const [localExpanded, { toggle: toggleLocalExpand }] = useDisclosure(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : localExpanded;
  
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
                patient: true, // If we have a valid consent, patient signed
                witness: true, // and witness signed
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

  const handleToggleExpand = useCallback(() => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      toggleLocalExpand();
    }
  }, [onToggleExpand, toggleLocalExpand]);

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

  const handleTreatmentChange = useCallback((newData: GenericTreatmentData) => {
    if (serviceRequest.id) {
      onUpdateTreatmentData(serviceRequest.id, newData as Record<string, unknown>);
    }
  }, [onUpdateTreatmentData, serviceRequest.id]);

  const handleUploadPhotos = useCallback(() => {
    if (serviceRequest.id) {
      onUploadPhotos(serviceRequest.id);
    }
  }, [onUploadPhotos, serviceRequest.id]);

  const handleDeletePhoto = useCallback((photoId: string) => {
    if (serviceRequest.id) {
      onDeletePhoto(serviceRequest.id, photoId);
    }
  }, [onDeletePhoto, serviceRequest.id]);

  const handleUpdatePhotoMetadata = useCallback((photoId: string, metadata: unknown) => {
    if (serviceRequest.id) {
      onUpdatePhotoMetadata(serviceRequest.id, photoId, metadata);
    }
  }, [onUpdatePhotoMetadata, serviceRequest.id]);

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
      {/* Header - Always visible */}
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs">
          <Text fw={600} size="lg">
            {index + 1}. {service.title || service.name || 'Unknown Service'}
          </Text>
          {statusBadge}
          {consentIndicator}
        </Group>

        <Group gap="xs">
          {/* Expand/Collapse button */}
          <ActionIcon
            variant="light"
            size="sm"
            onClick={handleToggleExpand}
          >
            {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </ActionIcon>
        </Group>
      </Group>

      {/* Quick info line */}
      <Group gap="md" mt="xs">
        <Text size="sm" c="dimmed">
          Duration: {(service as ActivityDefinition & { duration?: number }).duration ?? 30} min
        </Text>
        <Text size="sm" c="dimmed">
          •
        </Text>
        <Text size="sm" c="dimmed">
          {photos.length} photo{photos.length !== 1 ? 's' : ''}
        </Text>
        {startedAt && (
          <>
            <Text size="sm" c="dimmed">•</Text>
            <Text size="sm" c="dimmed">
              Started: {startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </>
        )}
        {completedAt && (
          <>
            <Text size="sm" c="dimmed">•</Text>
            <Text size="sm" c="dimmed">
              Completed: {completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </>
        )}
      </Group>

      {/* Expanded content */}
      <Collapse in={isExpanded}>
        <Divider my="md" />

        <Stack gap="md">
            {/* Consent Warning */}
          {config.consentRequired && !consent?.hasConsent && !readonly && (
            <Box p="md" bg="red.0" style={{ borderRadius: '4px' }}>
              <Group gap="xs">
                <ThemeIcon color="red" size="sm" variant="light">
                  <IconAlertCircle size={16} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="red.9">
                  Patient consent required
                </Text>
              </Group>
              <Text size="sm" c="red.7" mt="xs">
                This service requires patient consent to be signed before treatment can begin.
              </Text>
              {onSignConsent && serviceRequest.id && (
                <Button
                  size="xs"
                  variant="filled"
                  color="blue"
                  leftSection={<IconSignature size={14} />}
                  onClick={() => onSignConsent(serviceRequest.id!)}
                  mt="xs"
                >
                  Sign Consent
                </Button>
              )}
            </Box>
          )}

          {/* Treatment Form */}
          <Box>
            <Group justify="space-between" mb="sm">
              <Text fw={500}>Treatment Notes</Text>
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
            </Group>

            <GenericTreatmentForm
              value={treatmentData || {}}
              onChange={handleTreatmentChange}
              readonly={readonly || status === 'pending'}
            />
          </Box>

          {/* Photo Gallery */}
          <Box>
            <PhotoGallery
              photos={photos}
              onUpload={!readonly && status !== 'pending' ? handleUploadPhotos : undefined}
              onDelete={!readonly && status !== 'completed' ? handleDeletePhoto : undefined}
              onUpdateMetadata={!readonly ? handleUpdatePhotoMetadata : undefined}
              readonly={readonly || status === 'pending'}
              title="Treatment Photos"
            />
          </Box>
        </Stack>
      </Collapse>
    </Card>
  );
}

export default ServiceCard;
