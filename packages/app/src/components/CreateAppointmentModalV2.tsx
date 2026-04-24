// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Progress,
  Select,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
  Loader,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import { createReference, getReferenceString, normalizeErrorString } from '@medplum/core';
import type {
  ActivityDefinition,
  Appointment,
  Patient,
  Practitioner,
  ServiceRequest,
  Task,
} from '@medplum/fhirtypes';
import { ResourceInput, useMedplum, AsyncAutocomplete } from '@medplum/react';
import {
  IconAlertCircle,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMedSpaRole, isMainProviderEligible, isAssistantEligible } from '../auth/role';
import { createNotification } from '../notifications/utils';

// Step types
type Step = 'patient' | 'services' | 'schedule' | 'providers' | 'review';

interface ServiceConfig {
  numbingTime: number;
  defaultRoom: string;
  roomMovable: boolean;
  minPrice: number;
  maxPrice: number;
  pricePerUnit: boolean;
  unitType: string;
  gfeCategory: string;
  requiresConsult: boolean;
  icon: string;
  color: string;
  category: string;
}

interface SelectedService {
  activityDefinition: ActivityDefinition;
  config: ServiceConfig;
}

interface CreateAppointmentModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSlot?: { start: Date; end: Date } | null;
}

// Parse ActivityDefinition extension to ServiceConfig
function parseServiceConfig(activity: ActivityDefinition): ServiceConfig {
  const ext = activity.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/service-config'
  );

  return {
    numbingTime: ext?.extension?.find((e) => e.url === 'numbingTime')?.valueInteger ?? 0,
    defaultRoom: ext?.extension?.find((e) => e.url === 'defaultRoom')?.valueString ?? 'room-1',
    roomMovable: ext?.extension?.find((e) => e.url === 'roomMovable')?.valueBoolean ?? true,
    minPrice: ext?.extension?.find((e) => e.url === 'minPrice')?.valueInteger ?? 0,
    maxPrice: ext?.extension?.find((e) => e.url === 'maxPrice')?.valueInteger ?? 0,
    pricePerUnit: ext?.extension?.find((e) => e.url === 'pricePerUnit')?.valueBoolean ?? false,
    unitType: ext?.extension?.find((e) => e.url === 'unitType')?.valueString ?? 'unit',
    gfeCategory: ext?.extension?.find((e) => e.url === 'gfeCategory')?.valueString ?? '',
    requiresConsult: ext?.extension?.find((e) => e.url === 'requiresConsult')?.valueBoolean ?? false,
    icon: ext?.extension?.find((e) => e.url === 'icon')?.valueString ?? '',
    color: ext?.extension?.find((e) => e.url === 'color')?.valueString ?? 'blue',
    category: ext?.extension?.find((e) => e.url === 'category')?.valueString ?? 'other',
  };
}

// Check if patient has current GFE for a category
function checkGFEStatus(
  patient: Patient | null,
  gfeCategory: string
): { valid: boolean; expiresIn?: number } {
  if (!patient || !gfeCategory) return { valid: true };

  const consultExt = patient.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/consult-tracking'
  );

  if (!consultExt) return { valid: false };

  const expiryDate = consultExt.extension?.find((e) => e.url === 'consultExpiryDate')?.valueDate;
  if (!expiryDate) return { valid: false };

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
  if (!categoryExpiry) return { valid: false };

  const daysUntilExpiry = dayjs(categoryExpiry).diff(dayjs(), 'days');
  return { valid: daysUntilExpiry > 0, expiresIn: daysUntilExpiry };
}

// Calculate total duration from selected services
function calculateTotalDuration(services: SelectedService[]): number {
  return services.reduce((sum, svc) => sum + (svc.activityDefinition.timingDuration?.value ?? 30), 0);
}

// Calculate numbing time (max of all services)
function calculateNumbingTime(services: SelectedService[]): number {
  return Math.max(...services.map((svc) => svc.config.numbingTime));
}

// Get room assignment
function getRoomAssignment(services: SelectedService[]): { room: string; movable: boolean } {
  if (services.length === 0) return { room: 'room-1', movable: true };
  // Use primary (first) service's room
  const primary = services[0];
  return { room: primary.config.defaultRoom, movable: primary.config.roomMovable };
}

// Check service compatibility
function checkServiceCompatibility(services: SelectedService[]): string[] {
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

export function CreateAppointmentModalV2({
  isOpen,
  onClose,
  onSuccess,
  initialSlot,
}: CreateAppointmentModalV2Props): JSX.Element {
  const medplum = useMedplum();
  const role = getMedSpaRole(medplum);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Step tracking
  const [activeStep, setActiveStep] = useState<number>(0);
  const steps: Step[] = ['patient', 'services', 'schedule', 'providers', 'review'];

  // Step 1: Patient
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientGFEStatus, setPatientGFEStatus] = useState<{
    valid: boolean;
    expiresIn?: number;
  }>({ valid: true });
  const [addConsult, setAddConsult] = useState(false);

  // Step 2: Services
  const [availableServices, setAvailableServices] = useState<ActivityDefinition[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [serviceErrors, setServiceErrors] = useState<string[]>([]);

  // Step 3: Schedule
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('09:00');
  const [selectedRoom, setSelectedRoom] = useState<string>('room-1');
  const [duration, setDuration] = useState<number>(30);
  const [customDuration, setCustomDuration] = useState<number | null>(null);
  const [durationOverrideOpen, setDurationOverrideOpen] = useState(false);
  const [numbingTime, setNumbingTime] = useState<number>(0);

  // Step 4: Providers
  const [mainProvider, setMainProvider] = useState<Practitioner | null>(null);
  const [assistantProvider, setAssistantProvider] = useState<Practitioner | null>(null);
  const [allPractitioners, setAllPractitioners] = useState<Practitioner[]>([]);
  const [practitionersLoading, setPractitionersLoading] = useState(false);

  // Step 5: Review
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load available services on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadServices = async (): Promise<void> => {
      try {
        const result = await medplum.searchResources('ActivityDefinition', {
          _sort: 'name',
          _count: '100',
        });
        // Filter active services client-side
        const activeServices = (result as ActivityDefinition[]).filter(
          s => s.status === 'active'
        );
        setAvailableServices(activeServices);
      } catch (err) {
        console.error('Error loading services:', err);
      }
    };

    loadServices().catch(console.error);

    // Load all practitioners for provider selection
    const loadPractitioners = async (): Promise<void> => {
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
    };
    loadPractitioners().catch(console.error);

    // Set initial slot from calendar if provided
    if (initialSlot) {
      setSelectedDate(initialSlot.start);
      const hours = initialSlot.start.getHours().toString().padStart(2, '0');
      const minutes = initialSlot.start.getMinutes().toString().padStart(2, '0');
      setSelectedTime(`${hours}:${minutes}`);

      // Calculate duration from slot
      const durationMs = initialSlot.end.getTime() - initialSlot.start.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));
      if (durationMinutes > 0) {
        setDuration(durationMinutes);
        setCustomDuration(durationMinutes);
      }
    }
  }, [isOpen, medplum, initialSlot]);

  // Check GFE when patient changes
  useEffect(() => {
    if (!patient) {
      setPatientGFEStatus({ valid: true });
      return;
    }

    // Check general consult status
    const consultExt = patient.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/consult-tracking'
    );

    if (!consultExt) {
      setPatientGFEStatus({ valid: false });
      return;
    }

    const expiryDate = consultExt.extension?.find((e) => e.url === 'consultExpiryDate')?.valueDate;
    if (!expiryDate) {
      setPatientGFEStatus({ valid: false });
      return;
    }

    const daysUntilExpiry = dayjs(expiryDate).diff(dayjs(), 'days');
    setPatientGFEStatus({ valid: daysUntilExpiry > 0, expiresIn: daysUntilExpiry });
  }, [patient]);

  // Update duration and numbing when services change
  useEffect(() => {
    const totalDuration = calculateTotalDuration(selectedServices);
    const totalNumbing = calculateNumbingTime(selectedServices);
    setDuration(totalDuration);
    setNumbingTime(totalNumbing);

    // Auto-assign room from primary service
    const { room } = getRoomAssignment(selectedServices);
    if (selectedServices.length > 0) {
      setSelectedRoom(room);
    }

    // Check compatibility
    const issues = checkServiceCompatibility(selectedServices);
    setServiceErrors(issues);

    // Reset custom duration when services change
    setCustomDuration(null);
  }, [selectedServices]);

  // Service selection handler
  const toggleService = useCallback((activity: ActivityDefinition) => {
    const config = parseServiceConfig(activity);

    setSelectedServices((current) => {
      const exists = current.find((s) => s.activityDefinition.id === activity.id);
      if (exists) {
        return current.filter((s) => s.activityDefinition.id !== activity.id);
      }
      return [...current, { activityDefinition: activity, config }];
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

  // Validation for each step
  const canProceed = useCallback((): boolean => {
    switch (steps[activeStep]) {
      case 'patient':
        return !!patient;
      case 'services':
        return selectedServices.length > 0 && serviceErrors.length === 0;
      case 'schedule':
        return !!selectedDate && !!selectedTime;
      case 'providers':
        return !!mainProvider;
      case 'review':
        return true;
      default:
        return false;
    }
  }, [activeStep, steps, patient, selectedServices, serviceErrors, selectedDate, selectedTime, mainProvider]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!patient || !selectedDate || !mainProvider) return;

    setIsSubmitting(true);

    try {
      const startTime = dayjs(selectedDate)
        .hour(parseInt(selectedTime.split(':')[0]))
        .minute(parseInt(selectedTime.split(':')[1]));
      const endTime = startTime.add(duration, 'minute');

      // Determine initial status based on user role
      // Providers can auto-approve their own bookings
      // Coordinators must have bookings approved by providers
      const userRole = getMedSpaRole(medplum);
      const initialStatus = userRole === 'provider' || userRole === 'assistant' ? 'booked' : 'pending';

      // 1. Create Appointment
      const appointment: Appointment = {
        resourceType: 'Appointment',
        status: initialStatus,
        serviceType: [{ text: selectedServices.map((s) => s.activityDefinition.title).join(', ') }],
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        description: notes || undefined,
        participant: [
          {
            actor: createReference(patient),
            status: 'tentative',
          },
          {
            actor: createReference(mainProvider),
            status: 'tentative',
          },
        ],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/room',
            valueString: selectedRoom,
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/numbing-time',
            valueInteger: numbingTime,
          },
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

      if (assistantProvider) {
        appointment.participant.push({
          actor: createReference(assistantProvider),
          status: 'tentative',
        });
      }

      const savedAppointment = await medplum.createResource(appointment);

      // Send notification to providers about new booking
      try {
        await createNotification(medplum, 'appointment-created', {
          patient,
          appointment: savedAppointment,
          provider: mainProvider ?? undefined,
          assistant: assistantProvider ?? undefined,
          date: savedAppointment.start,
          time: dayjs(savedAppointment.start).format('h:mm A'),
          serviceType: selectedServices.map((s) => s.activityDefinition.title).join(', '),
        }, medplum.getProfile() as Practitioner | undefined);
      } catch (notifyErr) {
        console.error('Error sending notification:', notifyErr);
      }

      // 2. Create ServiceRequests for each service
      const serviceRequests: ServiceRequest[] = [];
      for (let i = 0; i < selectedServices.length; i++) {
        const svc = selectedServices[i];
const serviceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        status: 'draft',
        intent: 'order',
        code: svc.activityDefinition.code,
        subject: createReference(patient),
        requester: { reference: getReferenceString(mainProvider) },
        authoredOn: new Date().toISOString(),
        supportingInfo: [{ reference: getReferenceString(savedAppointment) }],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/service-position',
            valueInteger: i + 1,
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/numbing-required',
            valueBoolean: svc.config.numbingTime > 0,
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
            valueReference: { reference: getReferenceString(savedAppointment) },
          },
        ],
      };
        const saved = await medplum.createResource(serviceRequest);
        serviceRequests.push(saved);
      }

      // 3. Create Task for numbing if needed
      if (numbingTime > 0 && assistantProvider) {
        const numbingStart = startTime.subtract(numbingTime, 'minute');
        const numbingTask: Task = {
          resourceType: 'Task',
          status: 'draft',
          intent: 'order',
          code: { text: 'Apply numbing cream' },
          focus: { reference: getReferenceString(serviceRequests[0]) }, // Link to first service
          for: createReference(patient),
          requester: { reference: getReferenceString(mainProvider) },
          owner: createReference(assistantProvider),
          executionPeriod: {
            start: numbingStart.toISOString(),
            end: startTime.toISOString(),
          },
          extension: [
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/numbing-duration',
              valueInteger: numbingTime,
            },
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
              valueReference: { reference: getReferenceString(savedAppointment) },
            },
          ],
        };
        await medplum.createResource(numbingTask);
      }

      // 4. Add annual consult if requested
      if (addConsult) {
        const consultService = availableServices.find((s) => s.name === 'consultation');
        if (consultService) {
          const consultRequest: ServiceRequest = {
            resourceType: 'ServiceRequest',
            status: 'draft',
            intent: 'order',
            code: consultService.code,
            subject: createReference(patient),
            requester: { reference: getReferenceString(mainProvider) },
            authoredOn: new Date().toISOString(),
            supportingInfo: [{ reference: getReferenceString(savedAppointment) }],
            extension: [
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/service-position',
                valueInteger: selectedServices.length + 1,
              },
              {
                url: 'http://melissaknudson.com/fhir/StructureDefinition/is-consult',
                valueBoolean: true,
              },
            ],
          };
          await medplum.createResource(consultRequest);
        }
      }

      showNotification({
        title: initialStatus === 'booked' ? 'Booking Confirmed' : 'Booking Requested',
        message: initialStatus === 'booked' 
          ? `Booking for ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family} confirmed`
          : `Booking for ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family} created and pending approval`,
        color: 'green',
      });

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
    duration,
    selectedServices,
    selectedRoom,
    numbingTime,
    mainProvider,
    assistantProvider,
    notes,
    addConsult,
    availableServices,
    medplum,
    onSuccess,
    onClose,
  ]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveStep(0);
      setPatient(null);
      setSelectedServices([]);
      setSelectedDate(null);
      setSelectedTime('09:00');
      setSelectedRoom('room-1');
      setMainProvider(null);
      setAssistantProvider(null);
      setNotes('');
      setAddConsult(false);
    }
  }, [isOpen]);

  // Render step content
  const renderStepContent = (): JSX.Element => {
    switch (steps[activeStep]) {
      case 'patient':
        return (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Select a patient for this appointment.
            </Text>

            <div>
              <Text size="sm" fw={500} mb="xs">
                Patient <span style={{ color: 'red' }}>*</span>
              </Text>
              <ResourceInput
                resourceType="Patient"
                name="patient"
                placeholder="Search for patient..."
                onChange={(value) => setPatient(value as Patient | null)}
              />
            </div>

            {patient && (
              <>
                {!patientGFEStatus.valid && (
                  <Alert color="red" icon={<IconAlertCircle size={16} />}>
                    <Text fw={500}>Annual Consult Expired</Text>
                    <Text size="sm">
                      This patient requires a current annual consultation before booking
                      treatments.
                    </Text>
                    <Checkbox
                      mt="sm"
                      label="Include Annual Consultation in this booking"
                      checked={addConsult}
                      onChange={(e) => setAddConsult(e.currentTarget.checked)}
                    />
                  </Alert>
                )}

                {patientGFEStatus.valid && patientGFEStatus.expiresIn !== undefined && patientGFEStatus.expiresIn < 30 && (
                  <Alert color="orange" icon={<IconAlertCircle size={16} />}>
                    <Text fw={500}>Consult Expires Soon</Text>
                    <Text size="sm">
                      Annual consultation expires in {patientGFEStatus.expiresIn} days. Consider
                      scheduling a renewal.
                    </Text>
                    <Checkbox
                      mt="sm"
                      label="Include Annual Consultation in this booking"
                      checked={addConsult}
                      onChange={(e) => setAddConsult(e.currentTarget.checked)}
                    />
                  </Alert>
                )}

                {patientGFEStatus.valid && (patientGFEStatus.expiresIn === undefined || patientGFEStatus.expiresIn >= 30) && (
                  <Alert color="green" icon={<IconCheck size={16} />}>
                    <Text fw={500}>Annual Consult Current</Text>
                    <Text size="sm">Patient has a valid annual consultation.</Text>
                  </Alert>
                )}
              </>
            )}
          </Stack>
        );

      case 'services':
        return (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Select one or more services for this appointment. Services will be performed
              sequentially.
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

            <Stack gap="xs">
              {availableServices.length === 0 ? (
                <Text ta="center" c="dimmed" py="xl">
                  Loading services...
                </Text>
              ) : (
                availableServices
                  .filter((s) => s.status === 'active')
                  .map((service) => {
                    const isSelected = selectedServices.some(
                      (s) => s.activityDefinition.id === service.id
                    );
                    const config = parseServiceConfig(service);

                    // Check GFE for this service
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
                        <Text fw={500} lineClamp={1}>{service.title}</Text>
                        <Text size="xs" c="dimmed">
                          {service.timingDuration?.value ?? 30} min
                          {config.numbingTime > 0 && ` • ${config.numbingTime} min numbing`}
                        </Text>
                      </div>
                    </Group>
                    <Group gap="xs" style={{ flexShrink: 0, minWidth: '80px', justifyContent: 'flex-end' }}>
                      {!gfeStatus.valid && config.gfeCategory && (
                        <Tooltip label="GFE expired">
                          <Badge color="red" size="sm" style={{ flexShrink: 0 }}>
                            GFE
                          </Badge>
                        </Tooltip>
                      )}
                      {isSelected && (
                        <div style={{ width: 24, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                          <IconCheck size={20} color="var(--mantine-color-blue-5)" />
                        </div>
                      )}
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
                  <Group justify="space-between">
                    <Text fw={500}>Total Duration:</Text>
                    {durationOverrideOpen ? (
                      <Group gap="xs">
                      <NumberInput
                        value={customDuration ?? duration}
                        onChange={(val) => setCustomDuration(typeof val === 'number' ? val : duration)}
                        min={15}
                        max={300}
                        step={15}
                        w={80}
                        size="xs"
                        suffix=" min"
                      />
                        <Button size="xs" variant="light" onClick={() => setDurationOverrideOpen(false)}>
                          Done
                        </Button>
                      </Group>
                    ) : (
                      <Tooltip label="Click to override duration">
                        <Button
                          variant="light"
                          size="xs"
                          onClick={() => setDurationOverrideOpen(true)}
                        >
                          {customDuration ?? duration} min
                          {numbingTime > 0 && ` (+${numbingTime} numbing)`}
                        </Button>
                      </Tooltip>
                    )}
                  </Group>
                  {!durationOverrideOpen && customDuration !== null && (
                    <Text size="xs" c="orange" ta="right">
                      Custom: {customDuration} min (was {duration})
                    </Text>
                  )}
                </Stack>
              </Card>
            )}
          </Stack>
        );

      case 'schedule':
        return (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Select date, time, and room for the appointment.
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

            <Select
              label="Room"
              description="Auto-assigned from primary service"
              value={selectedRoom}
              onChange={(r) => setSelectedRoom(r || 'room-1')}
              data={[
                { value: 'room-1', label: 'Treatment Room 1' },
                { value: 'room-2', label: 'Treatment Room 2' },
              ]}
              leftSection={<IconBuilding size={16} />}
            />

            {selectedDate && selectedTime && (
              <Card withBorder bg="gray.0">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text>Start:</Text>
                    <Text fw={500}>
                      {dayjs(selectedDate).format('MMM D')} at {selectedTime}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text>End:</Text>
                    <Text fw={500}>
                      {dayjs(selectedDate)
                        .hour(parseInt(selectedTime.split(':')[0]))
                        .minute(parseInt(selectedTime.split(':')[1]))
                        .add(duration, 'minute')
                        .format('h:mm A')}
                    </Text>
                  </Group>
                  {numbingTime > 0 && (
                    <Group justify="space-between">
                      <Text c="orange">Numbing starts:</Text>
                      <Text c="orange" fw={500}>
                        {dayjs(selectedDate)
                          .hour(parseInt(selectedTime.split(':')[0]))
                          .minute(parseInt(selectedTime.split(':')[1]))
                          .subtract(numbingTime, 'minute')
                          .format('h:mm A')}
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Card>
            )}
          </Stack>
        );

      case 'providers':
        // Filter practitioners for each role
        const eligibleMainProviders = allPractitioners.filter(p => isMainProviderEligible(p));
        const eligibleAssistants = allPractitioners.filter(p => isAssistantEligible(p));

        const toOption = (p: Practitioner) => ({
          value: p.id || '',
          label: `${p.name?.[0]?.given?.[0] || ''} ${p.name?.[0]?.family || ''}`.trim() || 'Unknown',
          resource: p,
        });

        return (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Assign providers for this appointment.
            </Text>

            <div>
              <Text size="sm" fw={500} mb="xs">
                Main Provider <span style={{ color: 'red' }}>*</span>
              </Text>
              {practitionersLoading ? (
                <Loader size="sm" />
              ) : (
                <Select
                  placeholder="Select main provider..."
                  value={mainProvider?.id}
                  onChange={(id) => {
                    const p = eligibleMainProviders.find(pr => pr.id === id);
                    setMainProvider(p || null);
                  }}
                  data={eligibleMainProviders.map(p => ({
                    value: p.id || '',
                    label: `${p.name?.[0]?.given?.[0] || ''} ${p.name?.[0]?.family || ''}`.trim() || 'Unknown',
                  }))}
                  searchable
                  required
                />
              )}
            </div>

            <div>
              <Text size="sm" fw={500} mb="xs">
                Assistant (Optional)
              </Text>
              <Text size="xs" c="dimmed" mb="xs">
                {numbingTime > 0
                  ? 'Recommended for numbing'
                  : 'For assistance if needed'}
              </Text>
              {practitionersLoading ? (
                <Loader size="sm" />
              ) : (
                <Select
                  placeholder="Select assistant..."
                  value={assistantProvider?.id || null}
                  onChange={(id) => {
                    const p = eligibleAssistants.find(pr => pr.id === id);
                    setAssistantProvider(p || null);
                  }}
                  data={eligibleAssistants.map(p => ({
                    value: p.id || '',
                    label: `${p.name?.[0]?.given?.[0] || ''} ${p.name?.[0]?.family || ''}`.trim() || 'Unknown',
                  }))}
                  searchable
                  clearable
                />
              )}
            </div>
          </Stack>
        );

      case 'review':
        return (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Review booking details before submitting.
            </Text>

            <Card withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text c="dimmed">Patient:</Text>
                  <Text fw={500}>
                    {patient?.name?.[0]?.given?.[0]} {patient?.name?.[0]?.family}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text c="dimmed">Services:</Text>
                  <Text fw={500}>
                    {selectedServices.map((s) => s.activityDefinition.title).join(', ')}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text c="dimmed">Date & Time:</Text>
                  <Text fw={500}>
                    {selectedDate &&
                      dayjs(selectedDate).format('MMM D')} at {selectedTime}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text c="dimmed">Duration:</Text>
                  <Text fw={500}>{duration} minutes</Text>
                </Group>

                {numbingTime > 0 && (
                  <Group justify="space-between">
                    <Text c="dimmed">Numbing:</Text>
                    <Text fw={500}>{numbingTime} minutes</Text>
                  </Group>
                )}

                <Group justify="space-between">
                  <Text c="dimmed">Room:</Text>
                  <Text fw={500}>
                    {selectedRoom === 'room-1' ? 'Room 1' : 'Room 2'}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text c="dimmed">Main Provider:</Text>
                  <Text fw={500}>
                    {mainProvider?.name?.[0]?.given?.[0]} {mainProvider?.name?.[0]?.family}
                  </Text>
                </Group>

                {assistantProvider && (
                  <Group justify="space-between">
                    <Text c="dimmed">Assistant:</Text>
                    <Text fw={500}>
                      {assistantProvider?.name?.[0]?.given?.[0]}{' '}
                      {assistantProvider?.name?.[0]?.family}
                    </Text>
                  </Group>
                )}

                {addConsult && (
                  <Group justify="space-between">
                    <Text c="dimmed">Additional:</Text>
                    <Badge color="blue">Annual Consultation</Badge>
                  </Group>
                )}
              </Stack>
            </Card>

            <Textarea
              label="Notes"
              placeholder="Add any notes about this appointment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              minRows={3}
            />

            <Alert color="blue" icon={<IconBuilding size={16} />}>
              <Text size="sm">
                This booking will be created with status &quot;Pending&quot; and requires staff
                approval. A $250 deposit will be requested after approval.
              </Text>
            </Alert>
          </Stack>
        );

      default:
        return <Text>Unknown step</Text>;
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="New Appointment"
      size={isMobile ? '100%' : 'xl'}
      fullScreen={isMobile}
      styles={isMobile ? undefined : {
        content: { minWidth: '900px', maxWidth: '1200px' },
        body: { overflowX: 'hidden' },
      }}
    >
      <Stack>
        {/* Progress indicator */}
        <Progress value={((activeStep + 1) / steps.length) * 100} size="sm" />

        {/* Step indicator */}
        <Stepper
          active={activeStep}
          size={isMobile ? 'xs' : 'sm'}
          styles={{
            root: { overflowX: 'auto' },
            steps: {
              gap: isMobile ? 4 : 12,
              flexWrap: 'nowrap',
              justifyContent: 'center',
            },
            step: {
              flex: isMobile ? '0 0 auto' : '0 0 auto',
              minWidth: 'auto',
            },
            stepLabel: {
              fontSize: isMobile ? '10px' : '12px',
              whiteSpace: 'nowrap',
            },
            stepDescription: { display: 'none' },
            stepIcon: {
              width: isMobile ? 20 : 24,
              height: isMobile ? 20 : 24,
              fontSize: isMobile ? '10px' : '12px',
            },
            separator: {
              marginLeft: isMobile ? 2 : 4,
              marginRight: isMobile ? 2 : 4,
              minWidth: isMobile ? 8 : 20,
            },
          }}
        >
          <Stepper.Step label="Patient" />
          <Stepper.Step label="Services" />
          <Stepper.Step label="Schedule" />
          <Stepper.Step label="Providers" />
          <Stepper.Step label="Review" />
        </Stepper>

        {/* Step content */}
        <div style={{ minHeight: 300 }}>{renderStepContent()}</div>

        {/* Navigation buttons */}
        <Group justify="space-between" mt="md">
          <Button variant="light" color="gray" onClick={prevStep} disabled={activeStep === 0}>
            Back
          </Button>

          {activeStep === steps.length - 1 ? (
            <Button onClick={handleSubmit} loading={isSubmitting} disabled={!canProceed()}>
              Create Booking
            </Button>
          ) : (
            <Button onClick={nextStep} disabled={!canProceed()}>
              Next
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}

// Helper function to generate time slots
function generateTimeSlots(): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];
  for (let hour = 8; hour < 20; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const label = dayjs().hour(hour).minute(minute).format('h:mm A');
      slots.push({ value: timeString, label });
    }
  }
  return slots;
}
