// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

// CreateAppointmentModalV3 - Phase 4 Implementation
// Per-service equipment, room, provider configuration with visual timeline

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Grid,
  Group,
  Loader,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import { createReference, getReferenceString, normalizeErrorString } from '@medplum/core';
import type {
  ActivityDefinition,
  Appointment,
  Device,
  Patient,
  Practitioner,
  ServiceRequest,
  Task,
} from '@medplum/fhirtypes';
import { ResourceInput, useMedplum, useSearchResources } from '@medplum/react';
import {
  IconAlertCircle,
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconCircleDashed,
  IconDeviceHeartMonitor,
  IconPlus,
  IconSettings,
  IconTrash,
  IconUser,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMedSpaRole, isAssistantEligible, isMainProviderEligible } from '../auth/role';
import { createNotification } from '../notifications/utils';
import type { EquipmentRequirement, ServiceConfig } from '../utils/fhir-extensions';
import { parseServiceConfig } from '../utils/fhir-extensions';
import { recordBookingCreated, recordBookingEdited } from '../utils/audit-events';

type Step = 'patient' | 'services' | 'configure' | 'schedule' | 'review';

interface ServiceConfigExtended extends ServiceConfig {
  equipmentRequirements: EquipmentRequirement[];
  recommendedAccompanyingServices: {
    serviceCode: string;
    timing: 'before' | 'after' | 'concurrent';
    offsetMinutes: number;
  }[];
}

// Per-service configuration
interface ServiceBookingConfig {
  activityDefinition: ActivityDefinition;
  config: ServiceConfigExtended;
  // Per-service overrides
  provider?: Practitioner;
  assistant?: Practitioner;
  duration: number;
  room: string;
  equipmentAssignments: EquipmentAssignment[];
  notes?: string;
}

interface EquipmentAssignment {
  requirementIndex: number;
  deviceId?: string; // Device reference ID
}

interface CreateAppointmentModalV3Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSlot?: { start: Date; end: Date } | null;
  editMode?: boolean;
  editAppointment?: Appointment;
  editServiceRequests?: ServiceRequest[];
}

interface ParsedServiceConfig {
  baseConfig: ServiceConfig;
  equipmentRequirements: EquipmentRequirement[];
  recommendedAccompanyingServices: {
    serviceCode: string;
    timing: 'before' | 'after' | 'concurrent';
    offsetMinutes: number;
  }[];
}

// Parse ActivityDefinition extension to extended ServiceConfig
function parseServiceConfigExtended(activity: ActivityDefinition): ServiceConfigExtended {
  const baseConfig = parseServiceConfig(activity);
  const ext = activity.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/service-config'
  );

  // Parse from the single JSON string value (same format as buildServiceConfigExtensions stores)
  const configJson = ext?.valueString;
  if (configJson) {
    try {
      const parsed = JSON.parse(configJson);
      return {
        ...baseConfig,
        equipmentRequirements: parsed.equipmentRequirements || [],
        recommendedAccompanyingServices: parsed.recommendedAccompanyingServices || [],
      };
    } catch {
      // Fall through to defaults
    }
  }

  // Fallback: try nested extensions for backwards compatibility
  const equipmentReqsRaw = ext?.extension?.find((e) => e.url === 'equipmentRequirements')?.valueString;
  let equipmentRequirements: EquipmentRequirement[] = [];
  if (equipmentReqsRaw) {
    try {
      equipmentRequirements = JSON.parse(equipmentReqsRaw);
    } catch {
      equipmentRequirements = [];
    }
  }

  const recommendedServicesRaw = ext?.extension?.find((e) => e.url === 'recommendedAccompanyingServices')?.valueString;
  let recommendedAccompanyingServices: {
    serviceCode: string;
    timing: 'before' | 'after' | 'concurrent';
    offsetMinutes: number;
  }[] = [];
  if (recommendedServicesRaw) {
    try {
      recommendedAccompanyingServices = JSON.parse(recommendedServicesRaw);
    } catch {
      recommendedAccompanyingServices = [];
    }
  }

  return {
    ...baseConfig,
    equipmentRequirements,
    recommendedAccompanyingServices,
  };
}

// Check if patient has current GFE for a category
function checkGFEStatus(patient: Patient | null, gfeCategory: string): { valid: boolean; expiresIn?: number } {
  if (!patient || !gfeCategory) {
    return { valid: true };
  }

  const consultExt = patient.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/consult-tracking'
  );

  if (!consultExt) {
    return { valid: false };
  }

  const expiryDate = consultExt.extension?.find((e) => e.url === 'consultExpiryDate')?.valueDate;
  if (!expiryDate) {
    return { valid: false };
  }

  const gfeCategories = consultExt.extension?.find((e) => e.url === 'gfeCategories')?.extension;
  const categoryGFE = gfeCategories?.find(
    (e) => e.extension?.find((ext) => ext.url === 'type')?.valueString === gfeCategory
  );

  if (!categoryGFE) {
    // Check general consult expiry
    const daysUntilExpiry = dayjs(expiryDate).diff(dayjs(), 'days');
    return { valid: daysUntilExpiry > 0, expiresIn: daysUntilExpiry };
  }

  const categoryExpiry = categoryGFE.extension?.find((e) => e.url === 'expiry')?.valueDate;
  if (!categoryExpiry) {
    return { valid: false };
  }

  const daysUntilExpiry = dayjs(categoryExpiry).diff(dayjs(), 'days');
  return { valid: daysUntilExpiry > 0, expiresIn: daysUntilExpiry };
}

// Generate time slots
function generateTimeSlots(): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];
  for (let hour = 8; hour <= 19; hour++) {
    for (const minute of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const label = dayjs().hour(hour).minute(minute).format('h:mm A');
      slots.push({ value: time, label });
    }
  }
  return slots;
}

// Get room display name
function getRoomDisplay(roomValue: string): string {
  if (roomValue === 'room-1') {
    return 'Room 1';
  }
  if (roomValue === 'room-2') {
    return 'Room 2';
  }
  return roomValue;
}

// Get device display info
function getDeviceDisplayInfo(
  deviceId: string,
  allEquipment: Device[]
): { name: string; room?: string; serial?: string } {
  const device = allEquipment.find((d) => d.id === deviceId);
  if (!device) {
    return { name: 'Unknown Device' };
  }

  const room = device.location?.display || device.location?.reference?.split('/')?.[1];
  const serial = device.identifier?.find((id) => id.type?.text === 'serial-number')?.value;

  return {
    name: device.deviceName?.[0]?.name || 'Unnamed Device',
    room: room ? getRoomDisplay(room) : undefined,
    serial,
  };
}

// Check service compatibility
function checkServiceCompatibility(services: ServiceBookingConfig[]): string[] {
  const issues: string[] = [];

  // Check for incompatible services
  const laserService = services.find((s) => s.config.category === 'laser');
  const incompatibleWithLaser = services.filter(
    (s) => s.config.category === 'injection' && s.activityDefinition.name?.includes('filler')
  );

  if (laserService && incompatibleWithLaser.length > 0) {
    issues.push('Laser treatments should not be combined with injectables on the same day');
  }

  return issues;
}

// Calculate timeline
function calculateTimeline(
  services: ServiceBookingConfig[],
  startTime: dayjs.Dayjs
): { items: TimelineItem[]; totalDuration: number } {
  const items: TimelineItem[] = [];
  let currentTime = startTime;
  let totalDuration = 0;

  for (const service of services) {
    // Check for recommended accompanying services (before)
    const beforeServices = service.config.recommendedAccompanyingServices.filter((s) => s.timing === 'before');

    // Calculate total prep time needed (sum of all non-zero before services)
    const totalPrepTime = beforeServices
      .filter((rec) => Math.abs(rec.offsetMinutes) > 0)
      .reduce((sum, rec) => sum + Math.abs(rec.offsetMinutes), 0);

    // Move currentTime back to start of prep period
    const prepStartTime = currentTime.subtract(totalPrepTime, 'minute');
    let prepTime = prepStartTime;

    // Add prep items in chronological order (before the main service)
    for (const rec of beforeServices) {
      // Skip zero-duration prep services
      if (Math.abs(rec.offsetMinutes) === 0) {
        continue;
      }

      items.push({
        type: 'accompanying',
        title: `Prepare: ${rec.serviceCode}`,
        startTime: prepTime,
        endTime: prepTime.add(Math.abs(rec.offsetMinutes), 'minute'),
        service,
      });

      prepTime = prepTime.add(Math.abs(rec.offsetMinutes), 'minute');
      totalDuration += Math.abs(rec.offsetMinutes);
    }

    // Main service
    items.push({
      type: 'service',
      title: service.activityDefinition.title || 'Service',
      startTime: currentTime,
      endTime: currentTime.add(service.duration, 'minute'),
      service,
    });
    currentTime = currentTime.add(service.duration, 'minute');
    totalDuration += service.duration;

    // Check for recommended accompanying services (after)
    const afterServices = service.config.recommendedAccompanyingServices.filter((s) => s.timing === 'after');
    for (const rec of afterServices) {
      // Skip zero-duration follow-up services
      if (Math.abs(rec.offsetMinutes) === 0) {
        continue;
      }

      items.push({
        type: 'accompanying',
        title: `Follow-up: ${rec.serviceCode}`,
        startTime: currentTime,
        endTime: currentTime.add(rec.offsetMinutes, 'minute'),
        service,
      });
      currentTime = currentTime.add(rec.offsetMinutes, 'minute');
      totalDuration += rec.offsetMinutes;
    }
  }

  return { items, totalDuration };
}

interface TimelineItem {
  type: 'service' | 'accompanying' | 'gap';
  title: string;
  startTime: dayjs.Dayjs;
  endTime: dayjs.Dayjs;
  service: ServiceBookingConfig;
  warning?: string;
}

export function CreateAppointmentModalV3({
  isOpen,
  onClose,
  onSuccess,
  initialSlot,
  editMode = false,
  editAppointment,
  editServiceRequests,
}: CreateAppointmentModalV3Props): JSX.Element {
  const medplum = useMedplum();
  const role = getMedSpaRole(medplum);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Step tracking
  const [activeStep, setActiveStep] = useState<number>(0);
  const steps = useMemo<Step[]>(() => ['patient', 'services', 'configure', 'schedule', 'review'], []);

  // Step 1: Patient
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientGFEStatus, setPatientGFEStatus] = useState<{ valid: boolean; expiresIn?: number }>({ valid: true });
  const [addConsult, setAddConsult] = useState(false);

  // Step 2 & 3: Services
  const [availableServices, setAvailableServices] = useState<ActivityDefinition[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceBookingConfig[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceErrors, setServiceErrors] = useState<string[]>([]);

  // Load equipment
  const [equipmentResult] = useSearchResources('Device', { status: 'active', _count: '100' });
  const allEquipment = useMemo(() => (equipmentResult as Device[]) ?? [], [equipmentResult]);

  // Load practitioners
  const [allPractitioners, setAllPractitioners] = useState<Practitioner[]>([]);
  const [practitionersLoading, setPractitionersLoading] = useState(false);

  // Step 4: Schedule
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('09:00');

  // Step 5: Review
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load available services
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const loadData = async (): Promise<void> => {
      // Load services
      try {
        const result = await medplum.searchResources('ActivityDefinition', {
          _sort: 'name',
          _count: '100',
        });
        const activeServices = (result as ActivityDefinition[]).filter((s) => s.status === 'active');
        setAvailableServices(activeServices);
      } catch (err) {
        console.error('Error loading services:', err);
      }

      // Load practitioners
      try {
        setPractitionersLoading(true);
        const result = await medplum.searchResources('Practitioner', {
          _sort: 'name',
          _count: '100',
        });
        setAllPractitioners(result as Practitioner[]);
      } catch (err) {
        console.error('Error loading practitioners:', err);
      } finally {
        setPractitionersLoading(false);
      }

      // Set initial slot
      if (initialSlot) {
        setSelectedDate(initialSlot.start);
        const hours = initialSlot.start.getHours().toString().padStart(2, '0');
        const minutes = initialSlot.start.getMinutes().toString().padStart(2, '0');
        setSelectedTime(`${hours}:${minutes}`);
      }
    };

    loadData().catch(console.error);
  }, [isOpen, medplum, initialSlot]);

  // Auto-select provider when only one is available
  // useEffect(() => {
  //   const eligibleMainProviders = allPractitioners.filter((p) => isMainProviderEligible(p));

  //   if (eligibleMainProviders.length === 1) {
  //     const onlyProvider = eligibleMainProviders[0];
  //     const setSelect = async (current:any): Promise<void> => {
  //      current.map((service:any) => {
  //         if (!service.provider) {
  //           return { ...service, provider: onlyProvider };
  //         }
  //         return service;
  //       })
  //     };
  //     // Auto-select for services that don't have a provider yet
  //     setSelect(selectedServices).catch(console.error);
  //   }
  // }, [allPractitioners]);

  // Check GFE when patient changes
  useEffect(() => {
    const gfe = async (input: { valid: boolean; expiresIn?: number }): Promise<void> => {
      return setPatientGFEStatus(input);
    };

    if (!patient) {
      gfe({ valid: true }).catch(console.error);
      return;
    }

    const consultExt = patient.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/consult-tracking'
    );

    if (!consultExt) {
      gfe({ valid: true }).catch(console.error);
      return;
    }

    const expiryDate = consultExt.extension?.find((e) => e.url === 'consultExpiryDate')?.valueDate;
    if (!expiryDate) {
      gfe({ valid: true }).catch(console.error);
      return;
    }

    const daysUntilExpiry = dayjs(expiryDate).diff(dayjs(), 'days');
    gfe({ valid: daysUntilExpiry > 0, expiresIn: daysUntilExpiry }).catch(console.error);
  }, [patient]);

  // Update service compatibility errors
  useEffect(() => {
    const set = async (): Promise<void> => {
      return setServiceErrors(issues);
    };
    const issues = checkServiceCompatibility(selectedServices);
    set().catch(console.error);
  }, [selectedServices]);

  // Helper to create service config
  const createServiceBookingConfig = useCallback((activity: ActivityDefinition): ServiceBookingConfig => {
    const config = parseServiceConfigExtended(activity);
    return {
      activityDefinition: activity,
      config,
      duration: activity.timingDuration?.value ?? 30,
      room: config.defaultRoom,
      equipmentAssignments: config.equipmentRequirements.map((req, idx) => ({
        requirementIndex: idx,
        deviceId: req.equipmentReference?.reference?.split('/')?.[1],
      })),
    };
  }, []);

  // Service selection handler - auto-adds recommended accompanying services
  const toggleService = useCallback(
    (activity: ActivityDefinition) => {
      const config = parseServiceConfigExtended(activity);
      console.log('Parsed config for', activity.title, config);
      setSelectedServices((current) => {
        const existsIndex = current.findIndex((s) => s.activityDefinition.id === activity.id);
        if (existsIndex >= 0) {
          // Remove the service and any of its auto-added accompanying services
          const serviceToRemove = current[existsIndex];
          return current.filter((s) => {
            // Keep if it's not the main service
            if (s.activityDefinition.id !== activity.id) {
              // Also check if it was auto-added by this service
              const wasAutoAdded = serviceToRemove.config.recommendedAccompanyingServices.some(
                (rec) => rec.serviceCode === s.activityDefinition.name
              );
              return !wasAutoAdded;
            }
            return false;
          });
        }

        // Create new service config
        const newService = createServiceBookingConfig(activity);
        const result: ServiceBookingConfig[] = [...current, newService];

        // Auto-add recommended accompanying services with 'before' timing
        for (const rec of config.recommendedAccompanyingServices) {
          if (rec.timing === 'before') {
            const accompanyingService = availableServices.find((s) => s.name === rec.serviceCode);
            if (accompanyingService && !result.some((s) => s.activityDefinition.id === accompanyingService.id)) {
              const accompanyingConfig = createServiceBookingConfig(accompanyingService);
              // Insert before the main service
              result.splice(result.length - 1, 0, accompanyingConfig);
            }
          }
        }

        return result;
      });
    },
    [availableServices, createServiceBookingConfig]
  );

  // Move service in sequence
  const moveService = useCallback((index: number, direction: 'up' | 'down') => {
    setSelectedServices((current) => {
      const newServices = [...current];
      if (direction === 'up' && index > 0) {
        [newServices[index], newServices[index - 1]] = [newServices[index - 1], newServices[index]];
      } else if (direction === 'down' && index < newServices.length - 1) {
        [newServices[index], newServices[index + 1]] = [newServices[index + 1], newServices[index]];
      }
      return newServices;
    });
  }, []);

  // Remove service
  const removeService = useCallback((index: number) => {
    setSelectedServices((current) => current.filter((_, i) => i !== index));
  }, []);

  // Update service config
  const updateServiceConfig = useCallback((index: number, updates: Partial<ServiceBookingConfig>) => {
    setSelectedServices((current) => {
      const newServices = [...current];
      newServices[index] = { ...newServices[index], ...updates };
      return newServices;
    });
  }, []);

  // Step navigation
  const nextStep = useCallback(() => {
    if (activeStep < steps.length - 1) {
      setActiveStep((s) => s + 1);
    }
  }, [activeStep, steps.length]);

  const prevStep = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep((s) => s - 1);
    }
  }, [activeStep]);

  // Validation
  const canProceed = useCallback((): boolean => {
    switch (steps[activeStep]) {
      case 'patient':
        return !!patient;
      case 'services':
        return selectedServices.length > 0 && serviceErrors.length === 0;
      case 'configure': {
        // Check each service's provider requirements
        return selectedServices.every((s) => {
          const mainProviderValid = !s.config.mainProviderRequired || !!s.provider;
          const assistantValid = s.config.assistantRequired ? !!s.assistant : true;
          return mainProviderValid && assistantValid;
        });
      }
      case 'schedule':
        return !!selectedDate && !!selectedTime;
      case 'review':
        return true;
      default:
        return false;
    }
  }, [activeStep, steps, patient, selectedServices, serviceErrors, selectedDate, selectedTime]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!patient || !selectedDate) {
      return;
    }

    setIsSubmitting(true);

    try {
      const startTime = dayjs(selectedDate)
        .hour(parseInt(selectedTime.split(':')[0], 10))
        .minute(parseInt(selectedTime.split(':')[1], 10));

      // Calculate total duration from timeline
      const { totalDuration, items } = calculateTimeline(selectedServices, startTime);
      const endTime = startTime.add(totalDuration, 'minute');

      if (editMode && editAppointment) {
        // EDIT MODE: Update existing appointment and service requests
        const updatedAppointment: Appointment = {
          ...editAppointment,
          status: editAppointment.status, // Preserve existing status
          serviceType: [{ text: selectedServices.map((s) => s.activityDefinition.title).join(', ') }],
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          description: notes || undefined,
          participant: [{ actor: createReference(patient), status: 'tentative' }],
        };

        // Add unique providers as participants
        const providers = new Set<string>();
        for (const service of selectedServices) {
          if (service.provider) {
            const ref = getReferenceString(service.provider);
            if (ref && !providers.has(ref)) {
              providers.add(ref);
              updatedAppointment.participant.push({
                actor: createReference(service.provider),
                status: 'tentative',
              });
            }
          }
          if (service.assistant) {
            const ref = getReferenceString(service.assistant);
            if (ref && !providers.has(ref)) {
              providers.add(ref);
              updatedAppointment.participant.push({
                actor: createReference(service.assistant),
                status: 'tentative',
              });
            }
          }
        }

        await medplum.updateResource(updatedAppointment);

        // Update or create ServiceRequests
        const existingServiceRequests = editServiceRequests || [];
        const updatedServiceRequests: ServiceRequest[] = [];

        for (let i = 0; i < selectedServices.length; i++) {
          const svc = selectedServices[i];
          const serviceItem = items.filter((item) => item.type === 'service')[i];
          const serviceStart = dayjs(serviceItem?.startTime || startTime.toDate());
          const serviceEnd = dayjs(serviceItem?.endTime || endTime.toDate());

          const existingSR = existingServiceRequests[i];
          const serviceRequest: ServiceRequest = {
            ...(existingSR || {
              resourceType: 'ServiceRequest',
              status: 'draft',
              intent: 'order',
              authoredOn: new Date().toISOString(),
              supportingInfo: [{ reference: getReferenceString(updatedAppointment) }],
            }),
            code: svc.activityDefinition.code,
            subject: createReference(patient),
            requester: svc.provider ? { reference: getReferenceString(svc.provider) } : undefined,
            performer: [
              ...(svc.provider ? [createReference(svc.provider)] : []),
              ...(svc.assistant ? [createReference(svc.assistant)] : []),
            ],
            extension: [
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/service-position',
                valueInteger: i + 1,
              },
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
                valueReference: { reference: getReferenceString(updatedAppointment) },
              },
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/assigned-room',
                valueString: svc.room,
              },
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/actual-duration',
                valueInteger: svc.duration,
              },
            ],
          };

          // Add assigned equipment
          if (!serviceRequest.extension) {
            serviceRequest.extension = [];
          }
          for (const eq of svc.equipmentAssignments) {
            if (eq.deviceId) {
              serviceRequest.extension.push({
                url: 'http://melissaknudson.com/fhir/StructureDefinition/assigned-equipment',
                valueReference: { reference: `Device/${eq.deviceId}` },
              });
            }
          }

          if (existingSR) {
            await medplum.updateResource(serviceRequest);
          } else {
            await medplum.createResource(serviceRequest);
          }
          updatedServiceRequests.push(serviceRequest);
        }

        // Delete extra service requests if services were removed
        for (let i = selectedServices.length; i < existingServiceRequests.length; i++) {
          try {
            const sr = existingServiceRequests[i];
            if (sr.id) {
              await medplum.deleteResource('ServiceRequest', sr.id);
            }
          } catch (err) {
            console.error('Error deleting service request:', err);
          }
        }

        // Record edit action via AuditEvent
        const currentUser = medplum.getProfile();
        const currentUserPractitioner = {
          resourceType: 'Practitioner' as const,
          id: currentUser?.id || '',
          name: currentUser?.name,
        };

        // Build changes description for audit
        const changes: string[] = [];

        // Check for room changes
        for (let i = 0; i < selectedServices.length && i < existingServiceRequests.length; i++) {
          const newRoom = selectedServices[i].room;
          const oldRoomExt = existingServiceRequests[i]?.extension?.find(
            (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/assigned-room'
          );
          const oldRoom = oldRoomExt?.valueString || 'none';
          if (newRoom !== oldRoom) {
            changes.push(`Room changed from ${oldRoom} to ${newRoom} for service ${i + 1}`);
          }
        }

        // Check for provider changes
        if (selectedServices[0]?.provider && existingServiceRequests[0]) {
          const newProviderId = selectedServices[0].provider?.id;
          const oldProviderRef = existingServiceRequests[0].requester?.reference;
          const oldProviderId = oldProviderRef?.split('/')[1];
          if (newProviderId !== oldProviderId) {
            changes.push(`Provider changed for service 1`);
          }
        }

        const changeDescription = changes.length > 0
          ? `Booking edited: ${changes.join('; ')}`
          : 'Booking edited from modal';

        // Use first service request for the audit event (booking = appointment + services)
        const firstServiceRequest = updatedServiceRequests?.[0];
        if (firstServiceRequest) {
          await recordBookingEdited(
            medplum,
            patient,
            firstServiceRequest,
            currentUserPractitioner,
            changeDescription
          );
        }

        showNotification({
          title: 'Booking Updated',
          message: `Booking for ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family} updated successfully`,
          color: 'green',
        });
      } else {
        // CREATE MODE: Create new appointment and service requests
        const initialStatus = 'pending';

        // 1. Create Appointment
        const appointment: Appointment = {
          resourceType: 'Appointment',
          status: initialStatus,
          serviceType: [{ text: selectedServices.map((s) => s.activityDefinition.title).join(', ') }],
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          description: notes || undefined,
          participant: [{ actor: createReference(patient), status: 'tentative' }],
          extension: [
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/total-services',
              valueInteger: selectedServices.length,
            },
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-required',
              valueMoney: { value: 250, currency: 'USD' },
            },
          ],
        };

        // Add unique providers as participants
        const providers = new Set<string>();
        for (const service of selectedServices) {
          if (service.provider) {
            const ref = getReferenceString(service.provider);
            if (ref && !providers.has(ref)) {
              providers.add(ref);
              appointment.participant.push({
                actor: createReference(service.provider),
                status: 'tentative',
              });
            }
          }
          if (service.assistant) {
            const ref = getReferenceString(service.assistant);
            if (ref && !providers.has(ref)) {
              providers.add(ref);
              appointment.participant.push({
                actor: createReference(service.assistant),
                status: 'tentative',
              });
            }
          }
        }

        const savedAppointment = await medplum.createResource(appointment);

        // Send notification
        try {
          await createNotification(
            medplum,
            'appointment-created',
            {
              patient,
              appointment: savedAppointment,
              date: savedAppointment.start,
              time: dayjs(savedAppointment.start).format('h:mm A'),
              serviceType: selectedServices.map((s) => s.activityDefinition.title).join(', '),
            },
            medplum.getProfile() as Practitioner | undefined
          );
        } catch (notifyErr) {
          console.error('Error sending notification:', notifyErr);
        }

        // 2. Create ServiceRequests for each service
        const serviceRequests: ServiceRequest[] = [];
        for (let i = 0; i < selectedServices.length; i++) {
          const svc = selectedServices[i];
          const serviceItem = items.filter((item) => item.type === 'service')[i];

          const serviceRequest: ServiceRequest = {
            resourceType: 'ServiceRequest',
            status: 'draft',
            intent: 'order',
            code: svc.activityDefinition.code,
            subject: createReference(patient),
            requester: svc.provider ? { reference: getReferenceString(svc.provider) } : undefined,
            performer: [
              ...(svc.provider ? [createReference(svc.provider)] : []),
              ...(svc.assistant ? [createReference(svc.assistant)] : []),
            ],
            authoredOn: new Date().toISOString(),
            supportingInfo: [{ reference: getReferenceString(savedAppointment) }],
            extension: [
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/service-position',
                valueInteger: i + 1,
              },
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
                valueReference: { reference: getReferenceString(savedAppointment) },
              },
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/assigned-room',
                valueString: svc.room,
              },
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/actual-duration',
                valueInteger: svc.duration,
              },
            ],
          };

          // Add assigned equipment
          if (!serviceRequest.extension) {
            serviceRequest.extension = [];
          }
          for (const eq of svc.equipmentAssignments) {
            if (eq.deviceId) {
              serviceRequest.extension.push({
                url: 'http://melissaknudson.com/fhir/StructureDefinition/assigned-equipment',
                valueReference: { reference: `Device/${eq.deviceId}` },
              });
            }
          }

          const saved = await medplum.createResource(serviceRequest);
          serviceRequests.push(saved);
        }

        // 3. Create Task for numbing if a numbing service is in the selected services
        // Find the numbing service (by name containing 'numb')
        const numbingService = selectedServices.find((s) => s.activityDefinition.name?.toLowerCase().includes('numb'));
        if (numbingService) {
          const numbingDuration = numbingService.duration;
          const numbingStart = startTime.subtract(numbingDuration, 'minute');
          const numbingTask: Task = {
            resourceType: 'Task',
            status: 'draft',
            intent: 'order',
            code: { text: 'Apply numbing cream' },
            focus: { reference: getReferenceString(serviceRequests[0]) },
            for: createReference(patient),
            requester: numbingService.provider ? { reference: getReferenceString(numbingService.provider) } : undefined,
            owner: numbingService.assistant ? createReference(numbingService.assistant) : undefined,
            executionPeriod: {
              start: numbingStart.toISOString(),
              end: startTime.toISOString(),
            },
            extension: [
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/numbing-duration',
                valueInteger: numbingDuration,
              },
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
                valueReference: { reference: getReferenceString(savedAppointment) },
              },
            ],
          };
          await medplum.createResource(numbingTask);
        }

        showNotification({
          title: 'Booking Created',
          message: `Booking for ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family} created and pending deposit payment`,
          color: 'green',
        });

        // Record booking created via AuditEvent
        const currentUser = medplum.getProfile();
        const currentUserPractitioner = {
          resourceType: 'Practitioner' as const,
          id: currentUser?.id || '',
          name: currentUser?.name,
        };
        const serviceNames = selectedServices.map((s) => s.activityDefinition.title || '').filter((name): name is string => name !== '');
        if (serviceRequests.length > 0) {
          await recordBookingCreated(
            medplum,
            patient,
            serviceRequests[0],
            currentUserPractitioner,
            serviceNames,
            notes || undefined
          );
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      showNotification({
        title: 'Error',
        message: normalizeErrorString(err),
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    patient,
    selectedDate,
    selectedTime,
    selectedServices,
    notes,
    medplum,
    onSuccess,
    onClose,
    editMode,
    editAppointment,
    editServiceRequests,
  ]);

  // Reset form when modal closes
  useEffect(() => {
    const set = async (): Promise<void> => {
      setActiveStep(0);
      setPatient(null);
      setSelectedServices([]);
      setSelectedDate(null);
      setSelectedTime('09:00');
      setNotes('');
      setAddConsult(false);
    };
    if (!isOpen) {
      set().catch(console.error);
    }
  }, [isOpen]);

  // Pre-fill form in edit mode
  useEffect(() => {
    if (!editMode || !editAppointment || !editServiceRequests || editServiceRequests.length === 0) {
      return;
    }

    const prefill = async (): Promise<void> => {
      // Set patient from appointment participant
      const patientParticipant = editAppointment.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'));
      if (patientParticipant?.actor?.reference) {
        const patientId = patientParticipant.actor.reference.split('/')[1];
        try {
          const patientResource = await medplum.readResource('Patient', patientId);
          setPatient(patientResource);
        } catch (err) {
          console.error('Error loading patient:', err);
        }
      }

      // Set date and time from appointment start
      if (editAppointment.start) {
        const startDate = new Date(editAppointment.start);
        setSelectedDate(startDate);
        const hours = startDate.getHours().toString().padStart(2, '0');
        const minutes = startDate.getMinutes().toString().padStart(2, '0');
        setSelectedTime(`${hours}:${minutes}`);
      }

      // Set notes from appointment description
      if (editAppointment.description) {
        setNotes(editAppointment.description);
      }

      // Build selected services from ServiceRequests
      const services: ServiceBookingConfig[] = [];
      for (const sr of editServiceRequests) {
        const serviceCode = sr.code?.coding?.[0]?.code;
        if (!serviceCode) {continue;}

        // Find matching ActivityDefinition
        const matchingActivity = availableServices.find((a) => a.code?.coding?.[0]?.code === serviceCode);
        if (!matchingActivity) {continue;}

        // Extract provider and assistant from ServiceRequest
        const provider = allPractitioners.find((p) => {
          const srRef = sr.requester?.reference;
          return srRef?.includes(p.id ?? '');
        });

        const performerRefs = sr.performer?.map((p) => p.reference).filter((r): r is string => r !== undefined) || [];
        const assistant = allPractitioners.find((p) => {
          return p.id && performerRefs.some((ref) => ref.includes(p.id || '')) && p.id !== provider?.id;
        });

        // Extract room and equipment from extensions
        const roomExt = sr.extension?.find(
          (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/assigned-room'
        );
        const room = roomExt?.valueString || '';

        const equipmentAssignments: EquipmentAssignment[] = [];
        let equipIndex = 0;
        sr.extension
          ?.filter((e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/assigned-equipment')
          .forEach((eq) => {
            const deviceId = eq.valueReference?.reference?.split('/')[1] || '';
            if (deviceId) {
              equipmentAssignments.push({ requirementIndex: equipIndex++, deviceId });
            }
          });

        // Get duration from ActivityDefinition timingDuration or default
        const duration = matchingActivity.timingDuration?.value ?? 60;

        services.push({
          activityDefinition: matchingActivity,
          config: parseServiceConfigExtended(matchingActivity),
          duration,
          room,
          provider,
          assistant,
          equipmentAssignments,
        });
      }

      if (services.length > 0) {
        setSelectedServices(services);
      }

      // In edit mode, skip to services step (patient is already set)
      if (editMode && patient && services.length > 0) {
        setActiveStep(1); // Skip to 'services' step
      }
    };

    prefill().catch(console.error);
  }, [editMode, editAppointment, editServiceRequests, availableServices, allPractitioners, medplum, patient]);

  // Render step content
  const renderStepContent = (): JSX.Element => {
    switch (steps[activeStep]) {
      case 'patient':
        return (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {editMode ? 'Patient for this booking (read-only in edit mode):' : 'Select a patient for this appointment.'}
            </Text>

            <div>
              <Text size="sm" fw={500} mb="xs">
                Patient <span style={{ color: 'red' }}>*</span>
              </Text>
              <ResourceInput
                resourceType="Patient"
                name="patient"
                placeholder="Search for patient..."
                defaultValue={patient as any}
                onChange={(value) => !editMode && setPatient(value as Patient | null)}
                disabled={editMode}
              />
            </div>

            {patient && (
              <>
                {!patientGFEStatus.valid && (
                  <Alert color="red" icon={<IconAlertCircle size={16} />}>
                    <Text fw={500}>Annual Consult Expired</Text>
                    <Text size="sm">
                      This patient requires a current annual consultation before booking treatments.
                    </Text>
                    <Checkbox
                      mt="sm"
                      label="Include Annual Consultation in this booking"
                      checked={addConsult}
                      onChange={(e) => setAddConsult(e.currentTarget.checked)}
                    />
                  </Alert>
                )}

                {patientGFEStatus.valid &&
                  patientGFEStatus.expiresIn !== undefined &&
                  patientGFEStatus.expiresIn < 30 && (
                    <Alert color="orange" icon={<IconAlertCircle size={16} />}>
                      <Text fw={500}>Consult Expires Soon</Text>
                      <Text size="sm">
                        Annual consultation expires in {patientGFEStatus.expiresIn} days. Consider scheduling a renewal.
                      </Text>
                      <Checkbox
                        mt="sm"
                        label="Include Annual Consultation in this booking"
                        checked={addConsult}
                        onChange={(e) => setAddConsult(e.currentTarget.checked)}
                      />
                    </Alert>
                  )}

                {patientGFEStatus.valid &&
                  (patientGFEStatus.expiresIn === undefined || patientGFEStatus.expiresIn >= 30) && (
                    <Alert color="green" icon={<IconCheck size={16} />}>
                      <Text fw={500}>Annual Consult Current</Text>
                      <Text size="sm">Patient has a valid annual consultation.</Text>
                    </Alert>
                  )}
              </>
            )}
          </Stack>
        );

      case 'services': {
        const filteredServices = availableServices.filter((s) => {
          if (!serviceSearch) {
            return true;
          }
          const search = serviceSearch.toLowerCase();
          return (
            s.title?.toLowerCase().includes(search) ||
            s.name?.toLowerCase().includes(search) ||
            s.description?.toLowerCase().includes(search)
          );
        });

        return (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Select one or more services for this appointment. Configure each service's details in the next step.
            </Text>

            {serviceErrors.length > 0 && (
              <Alert color="orange" icon={<IconAlertCircle size={16} />}>
                <Text fw={500}>Compatibility Warning</Text>
                {serviceErrors.map((err, i) => (
                  <Text key={i} size="sm">
                    • {err}
                  </Text>
                ))}
              </Alert>
            )}

            <TextInput
              placeholder="Search services..."
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              leftSection={<IconDeviceHeartMonitor size={16} />}
            />

            <Stack gap="xs">
              {filteredServices.length === 0 ? (
                <Text ta="center" c="dimmed" py="xl">
                  No services found.
                </Text>
              ) : (
                filteredServices
                  .filter((s) => s.status === 'active')
                  .map((service) => {
                    const isSelected = selectedServices.some((s) => s.activityDefinition.id === service.id);
                    const config = parseServiceConfig(service);
                    const gfeStatus = checkGFEStatus(patient, config.gfeCategory);

                    return (
                      <Card
                        key={service.id}
                        withBorder
                        padding="sm"
                        style={{
                          cursor: 'pointer',
                          borderColor: isSelected ? 'var(--mantine-color-blue-5)' : undefined,
                          backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : undefined,
                        }}
                        onClick={() => toggleService(service)}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: config.color,
                                flexShrink: 0,
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text fw={500} lineClamp={1}>
                                {service.title}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {service.timingDuration?.value ?? 30} min
                              </Text>
                            </div>
                          </Group>
                          <Group gap="xs" style={{ flexShrink: 0 }}>
                            {!gfeStatus.valid && config.gfeCategory && (
                              <Tooltip label="GFE expired">
                                <Badge color="red" size="sm">
                                  GFE
                                </Badge>
                              </Tooltip>
                            )}
                            {isSelected && <IconCheck size={20} color="var(--mantine-color-blue-5)" />}
                          </Group>
                        </Group>
                      </Card>
                    );
                  })
              )}
            </Stack>

            {selectedServices.length > 0 && (
              <Card withBorder bg="gray.0">
                <Stack gap="xs">
                  <Text fw={500}>Selected Services ({selectedServices.length})</Text>
                  <Text size="sm" c="dimmed">
                    Click &quot;Next&quot; to configure each service&apos;s provider, room, and equipment.
                  </Text>
                </Stack>
              </Card>
            )}
          </Stack>
        );
      }

      case 'configure': {
        // For ALL users (including admins), separate providers vs assistants
        // Admins see all practitioners, but still separated by role
        const eligibleMainProviders = allPractitioners.filter((p) => isMainProviderEligible(p));
        const eligibleAssistants = allPractitioners.filter((p) => isAssistantEligible(p));

        return (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Configure each service with provider, room, and equipment assignments.
            </Text>

            {selectedServices.length === 0 ? (
              <Text ta="center" c="dimmed" py="xl">
                No services selected. Go back to select services.
              </Text>
            ) : (
              <ScrollArea h={500} type="auto">
                <Stack gap="md">
                  {selectedServices.map((service, index) => (
                    <Card key={service.activityDefinition.id} withBorder>
                      <Card.Section withBorder inheritPadding py="xs">
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="xs">
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: service.config.color,
                              }}
                            />
                            <Text fw={500}>
                              {index + 1}. {service.activityDefinition.title}
                            </Text>
                            {service.provider && (
                              <Badge size="xs" color="blue">
                                {service.provider.name?.[0]?.given?.[0]} {service.provider.name?.[0]?.family}
                              </Badge>
                            )}
                          </Group>
                          <Group gap={4}>
                            <ActionIcon
                              size="sm"
                              variant="light"
                              disabled={index === 0}
                              onClick={() => moveService(index, 'up')}
                            >
                              <IconArrowUp size={14} />
                            </ActionIcon>
                            <ActionIcon
                              size="sm"
                              variant="light"
                              disabled={index === selectedServices.length - 1}
                              onClick={() => moveService(index, 'down')}
                            >
                              <IconArrowDown size={14} />
                            </ActionIcon>
                            <ActionIcon size="sm" color="red" variant="light" onClick={() => removeService(index)}>
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Card.Section>
                      <Stack gap="md" mt="md">
                        {/* Provider Selection */}
                        <Grid>
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500} mb="xs">
                              Main Provider{' '}
                              {service.config.mainProviderRequired && <span style={{ color: 'red' }}>*</span>}
                              {!service.config.mainProviderRequired && (
                                <span style={{ color: 'gray', fontSize: '0.85em' }}> (optional)</span>
                              )}
                            </Text>
                            {practitionersLoading ? (
                              <Loader size="sm" />
                            ) : (
                              <Select
                                placeholder="Select provider..."
                                value={service.provider?.id}
                                onChange={(val) => {
                                  const provider = eligibleMainProviders.find((p) => p.id === val);
                                  updateServiceConfig(index, { provider });
                                }}
                                data={eligibleMainProviders.map((p) => ({
                                  value: p.id || '',
                                  label:
                                    `${p.name?.[0]?.given?.[0] || ''} ${p.name?.[0]?.family || ''}`.trim() || 'Unknown',
                                }))}
                                searchable
                              />
                            )}
                          </Grid.Col>
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500} mb="xs">
                              Assistant {service.config.assistantRequired && <span style={{ color: 'red' }}>*</span>}
                              {!service.config.assistantRequired && (
                                <span style={{ color: 'gray', fontSize: '0.85em' }}> (optional)</span>
                              )}
                            </Text>
                            {practitionersLoading ? (
                              <Loader size="sm" />
                            ) : (
                              <Select
                                placeholder="Select assistant..."
                                value={service.assistant?.id}
                                onChange={(val) => {
                                  const assistant = eligibleAssistants.find((p) => p.id === val) || undefined;
                                  updateServiceConfig(index, { assistant });
                                }}
                                data={[
                                  { value: '', label: 'None' },
                                  ...eligibleAssistants.map((p) => ({
                                    value: p.id || '',
                                    label:
                                      `${p.name?.[0]?.given?.[0] || ''} ${p.name?.[0]?.family || ''}`.trim() ||
                                      'Unknown',
                                  })),
                                ]}
                                searchable
                                clearable
                              />
                            )}
                          </Grid.Col>
                        </Grid>

                        {/* Room & Duration */}
                        <Grid>
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500} mb="xs">
                              Room
                            </Text>
                            <Select
                              value={service.room}
                              onChange={(val) => updateServiceConfig(index, { room: val || 'room-1' })}
                              data={[
                                { value: 'room-1', label: 'Treatment Room 1' },
                                { value: 'room-2', label: 'Treatment Room 2' },
                              ]}
                            />
                          </Grid.Col>
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500} mb="xs">
                              Duration (minutes)
                            </Text>
                            <NumberInput
                              value={service.duration}
                              onChange={(val) =>
                                updateServiceConfig(index, {
                                  duration: typeof val === 'number' ? val : service.duration,
                                })
                              }
                              min={15}
                              max={300}
                              step={15}
                            />
                          </Grid.Col>
                        </Grid>

                        {/* Equipment Requirements */}
                        {service.config.equipmentRequirements.length > 0 && (
                          <>
                            <Divider />
                            <Text size="sm" fw={500}>
                              Required Equipment
                            </Text>
                            <Stack gap="xs">
                              {service.config.equipmentRequirements.map((req, reqIndex) => {
                                const assigned = service.equipmentAssignments.find(
                                  (a) => a.requirementIndex === reqIndex
                                );
                                const compatibleEquipment = allEquipment.filter((d) => {
                                  // Filter by type if specified
                                  if (req.equipmentType) {
                                    return d.type?.text?.toLowerCase().includes(req.equipmentType.toLowerCase());
                                  }
                                  return true;
                                });

                                return (
                                  <Card key={reqIndex} withBorder p="xs">
                                    <Group justify="space-between" align="flex-start">
                                      <div>
                                        <Text size="sm" fw={500}>
                                          {req.equipmentName || req.equipmentType}
                                          {req.required && <span style={{ color: 'red' }}> *</span>}
                                        </Text>
                                        <Text size="xs" c="dimmed">
                                          {req.movable ? 'Can be moved between rooms' : 'Fixed in room'}
                                        </Text>
                                      </div>
                                      <Select
                                        placeholder="Select equipment..."
                                        value={assigned?.deviceId}
                                        onChange={(val) => {
                                          const newAssignments = [...service.equipmentAssignments];
                                          const existingIndex = newAssignments.findIndex(
                                            (a) => a.requirementIndex === reqIndex
                                          );
                                          if (existingIndex >= 0) {
                                            newAssignments[existingIndex] = {
                                              requirementIndex: reqIndex,
                                              deviceId: val || undefined,
                                            };
                                          } else {
                                            newAssignments.push({
                                              requirementIndex: reqIndex,
                                              deviceId: val || undefined,
                                            });
                                          }
                                          updateServiceConfig(index, { equipmentAssignments: newAssignments });
                                        }}
                                        data={[
                                          { value: '', label: 'Auto-assign' },
                                          ...compatibleEquipment.map((d) => {
                                            const info = getDeviceDisplayInfo(d.id || '', allEquipment);
                                            return {
                                              value: d.id || '',
                                              label: `${info.name}${info.serial ? ` (SN: ${info.serial})` : ''}`,
                                              disabled: !!(info.room && info.room !== getRoomDisplay(service.room)),
                                            };
                                          }),
                                        ]}
                                        w={250}
                                        searchable
                                      />
                                    </Group>
                                    {assigned?.deviceId &&
                                      (() => {
                                        const info = getDeviceDisplayInfo(assigned.deviceId, allEquipment);
                                        if (info.room && info.room !== getRoomDisplay(service.room)) {
                                          return (
                                            <Alert color="orange" mt="xs" py="xs">
                                              <Text size="xs">
                                                Warning: {info.name} is typically in {info.room} but this service is
                                                scheduled for {getRoomDisplay(service.room)}.
                                              </Text>
                                            </Alert>
                                          );
                                        }
                                        return null;
                                      })()}
                                  </Card>
                                );
                              })}
                            </Stack>
                          </>
                        )}

                        {/* Accompanying Services */}
                        {service.config.recommendedAccompanyingServices.length > 0 && (
                          <>
                            <Divider />
                            <Text size="sm" fw={500}>
                              Recommended Accompanying Services
                            </Text>
                            <Stack gap="xs">
                              {service.config.recommendedAccompanyingServices.map((rec, recIndex) => {
                                // Check if this accompanying service is already added
                                const isAlreadyAdded = selectedServices.some(
                                  (s) => s.activityDefinition.name === rec.serviceCode
                                );
                                const isAutoAdded = rec.timing === 'before';

                                return (
                                  <Card key={recIndex} withBorder p="xs" bg="gray.0">
                                    <Group justify="space-between">
                                      <Group gap="xs">
                                        <ThemeIcon
                                          size="sm"
                                          color={(() => {
                                            if (rec.timing === 'before') {
                                              return 'blue';
                                            }
                                            if (rec.timing === 'after') {
                                              return 'green';
                                            }
                                            return 'gray';
                                          })()}
                                        >
                                          <IconPlus size={12} />
                                        </ThemeIcon>
                                        <Text size="sm">{rec.serviceCode}</Text>
                                        <Badge size="xs">{rec.timing}</Badge>
                                        <Text size="xs" c="dimmed">
                                          {rec.offsetMinutes} min
                                        </Text>
                                        {isAlreadyAdded && (
                                          <Badge size="xs" color="green" variant="filled">
                                            Added
                                          </Badge>
                                        )}
                                        {isAutoAdded && !isAlreadyAdded && (
                                          <Badge size="xs" color="blue" variant="light">
                                            Auto-add
                                          </Badge>
                                        )}
                                      </Group>
                                      {rec.timing === 'after' && !isAlreadyAdded && (
                                        <Button
                                          size="xs"
                                          variant="light"
                                          onClick={() => {
                                            const accompanyingService = availableServices.find(
                                              (s) => s.name === rec.serviceCode
                                            );
                                            if (accompanyingService) {
                                              toggleService(accompanyingService);
                                            }
                                          }}
                                        >
                                          Add
                                        </Button>
                                      )}
                                      {rec.timing === 'after' && isAlreadyAdded && (
                                        <Button size="xs" variant="light" color="red" disabled>
                                          Added
                                        </Button>
                                      )}
                                    </Group>
                                  </Card>
                                );
                              })}
                            </Stack>
                          </>
                        )}

                        <Textarea
                          label="Notes"
                          placeholder="Special instructions for this service..."
                          value={service.notes || ''}
                          onChange={(e) => updateServiceConfig(index, { notes: e.target.value })}
                          minRows={2}
                        />
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </ScrollArea>
            )}
          </Stack>
        );
      }

      case 'schedule': {
        const startTime =
          selectedDate && selectedTime
            ? dayjs(selectedDate)
                .hour(parseInt(selectedTime.split(':')[0], 10))
                .minute(parseInt(selectedTime.split(':')[1], 10))
            : null;
        const { items: timelineItems, totalDuration } = startTime
          ? calculateTimeline(selectedServices, startTime)
          : { items: [], totalDuration: 0 };

        return (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Select date and time. Review the timeline preview below.
            </Text>

            <Group grow>
              <TextInput
                label="Date"
                type="date"
                value={selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : ''}
                onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                min={dayjs().format('YYYY-MM-DD')}
                required
              />

              <Select
                label="Time"
                placeholder="Select time"
                value={selectedTime}
                onChange={(t) => setSelectedTime(t || '09:00')}
                data={generateTimeSlots()}
                searchable
                required
              />
            </Group>

            {/* Timeline Preview */}
            {startTime && timelineItems.length > 0 && (
              <Card withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text fw={500}>Timeline Preview</Text>
                    <Badge>Total: {totalDuration} min</Badge>
                  </Group>

                  <Timeline active={-1} bulletSize={24}>
                    {timelineItems.map((item, idx) => (
                      <Timeline.Item
                        key={idx}
                        bullet={
                          item.type === 'service' ? (
                            <ThemeIcon size={24} color={item.service.config.color} radius="xl">
                              <IconCircleCheck size={14} />
                            </ThemeIcon>
                          ) : (
                            <ThemeIcon size={24} color="gray" variant="light" radius="xl">
                              <IconCircleDashed size={14} />
                            </ThemeIcon>
                          )
                        }
                        title={
                          <Group gap="xs">
                            <Text fw={500}>{item.title}</Text>
                            {item.type === 'service' && (
                              <>
                                <Badge size="xs" color="gray">
                                  {item.service.room}
                                </Badge>
                                {item.service.provider && (
                                  <Badge size="xs" color="blue">
                                    {item.service.provider.name?.[0]?.given?.[0]}
                                  </Badge>
                                )}
                              </>
                            )}
                          </Group>
                        }
                      >
                        <Text size="sm" c="dimmed">
                          {item.startTime.format('h:mm A')} - {item.endTime.format('h:mm A')} (
                          {item.endTime.diff(item.startTime, 'minute')} min)
                        </Text>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </Stack>
              </Card>
            )}
          </Stack>
        );
      }

      case 'review': {
        return (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Review all details before creating the booking.
            </Text>

            <Card withBorder>
              <Stack gap="xs">
                <Text fw={500}>Patient</Text>
                <Text>
                  {patient?.name?.[0]?.given?.[0]} {patient?.name?.[0]?.family}
                </Text>
              </Stack>
            </Card>

            <Card withBorder>
              <Stack gap="xs">
                <Text fw={500}>Schedule</Text>
                <Text>
                  {selectedDate && dayjs(selectedDate).format('MMMM D, YYYY')} at {selectedTime}
                </Text>
                <Text size="sm" c="dimmed">
                  {selectedServices.length} service(s) • Total duration calculated automatically
                </Text>
              </Stack>
            </Card>

            <Card withBorder>
              <Stack gap="xs">
                <Text fw={500}>Services</Text>
                {selectedServices.map((service, idx) => (
                  <Group key={idx} justify="space-between">
                    <Group gap="xs">
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: service.config.color,
                        }}
                      />
                      <Text>{service.activityDefinition.title}</Text>
                    </Group>
                    <Group gap="xs">
                      <Badge size="xs" color="gray">
                        {getRoomDisplay(service.room)}
                      </Badge>
                      <Badge size="xs" color="blue">
                        {service.duration} min
                      </Badge>
                    </Group>
                  </Group>
                ))}
              </Stack>
            </Card>

            <Textarea
              label="Notes"
              placeholder="Additional notes for this booking..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              minRows={3}
            />
          </Stack>
        );
      }

      default:
        return <Text>Unknown step</Text>;
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={<span style={{ fontSize: 'var(--mantine-font-size-md)', fontWeight: 500 }}>{editMode ? 'Edit Booking' : 'New Appointment'}</span>}
      size={900}
      fullScreen={isMobile}
    >
      <Stack gap="lg">
        <Stepper active={activeStep} onStepClick={setActiveStep}>
          <Stepper.Step
            label="Patient"
            description="Select patient"
            icon={<IconUser size={18} />}
            completedIcon={<IconCheck size={18} />}
          />
          <Stepper.Step
            label="Services"
            description="Choose services"
            icon={<IconDeviceHeartMonitor size={18} />}
            completedIcon={<IconCheck size={18} />}
          />
          <Stepper.Step
            label="Configure"
            description="Providers & equipment"
            icon={<IconSettings size={18} />}
            completedIcon={<IconCheck size={18} />}
          />
          <Stepper.Step
            label="Schedule"
            description="Date & time"
            icon={<IconCalendar size={18} />}
            completedIcon={<IconCheck size={18} />}
          />
          <Stepper.Step
            label="Review"
            description="Confirm details"
            icon={<IconCheck size={18} />}
            completedIcon={<IconCheck size={18} />}
          />
        </Stepper>

        <div style={{ minHeight: 300 }}>{renderStepContent()}</div>

        <Group justify="space-between" mt="md">
          <Button
            variant="light"
            leftSection={<IconChevronLeft size={16} />}
            onClick={prevStep}
            disabled={activeStep === 0}
          >
            Back
          </Button>

          {activeStep === steps.length - 1 ? (
            <Button onClick={handleSubmit} loading={isSubmitting} leftSection={<IconCheck size={16} />}>
              Create Booking
            </Button>
          ) : (
            <Button onClick={nextStep} disabled={!canProceed()} rightSection={<IconChevronRight size={16} />}>
              Next
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
