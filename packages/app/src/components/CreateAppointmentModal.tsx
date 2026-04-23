// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  TextInput,
  Textarea,
  NumberInput,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import { createReference, getReferenceString, normalizeErrorString } from '@medplum/core';
import type { Appointment, Patient, Practitioner, Procedure } from '@medplum/fhirtypes';
import { AsyncAutocomplete, ResourceInput, useMedplum } from '@medplum/react';
import { IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { getMedSpaRole } from '../auth/role';
import { createNotification } from '../notifications/utils';
import type { NotificationData } from '../notifications/templates';

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: Date;
  initialTime?: string;
  initialDuration?: number;
  // Edit mode props
  mode?: 'create' | 'edit';
  appointment?: Appointment;
  procedure?: Procedure;
}

// Service types - extendable in future
const SERVICE_TYPES = [
  { value: 'Botox Cosmetic', label: 'Botox Cosmetic', code: 'botox-cosmetic' },
  { value: 'Filler', label: 'Filler', code: 'filler' },
  { value: 'Laser', label: 'Laser', code: 'laser' },
  { value: 'Consultation', label: 'Consultation', code: 'consultation' },
];

// Helper function to check if a practitioner is a provider (RN - can be main provider)
function isProvider(practitioner: Practitioner): boolean {
  return practitioner.qualification?.some(
    (q) => q.code?.coding?.some((c) => c.code === 'RN')
  ) ?? false;
}

// Helper function to check if a practitioner is an assistant (can be assistant only)
function isAssistant(practitioner: Practitioner): boolean {
  return practitioner.qualification?.some(
    (q) => q.code?.coding?.some((c) => c.code === 'assistant')
  ) ?? false;
}

// Helper function to get display name for practitioner
function getPractitionerDisplay(practitioner: Practitioner): string {
  const name = practitioner.name?.[0];
  if (name) {
    const given = name.given?.join(' ') ?? '';
    const family = name.family ?? '';
    return `${given} ${family}`.trim() || 'Unknown';
  }
  return 'Unknown';
}

// Duration options in minutes (15 min increments up to 1 hour, then 30 min increments up to 6 hours)
const DURATIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
  { value: '150', label: '2.5 hours' },
  { value: '180', label: '3 hours' },
  { value: '210', label: '3.5 hours' },
  { value: '240', label: '4 hours' },
  { value: '270', label: '4.5 hours' },
  { value: '300', label: '5 hours' },
  { value: '330', label: '5.5 hours' },
  { value: '360', label: '6 hours' },
];

// Generate time slots (15-minute increments)
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

export function CreateAppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  initialDate = new Date(),
  initialTime = '09:00',
  initialDuration = 30,
  mode = 'create',
  appointment,
  procedure,
}: CreateAppointmentModalProps): JSX.Element {
  const medplum = useMedplum();
  const role = getMedSpaRole(medplum);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [patient, setPatient] = useState<Patient | null>(null);
  const [date, setDate] = useState<Date>(initialDate);
  const [time, setTime] = useState<string>(initialTime);
  const [duration, setDuration] = useState<number>(initialDuration);
  const [serviceType, setServiceType] = useState<string>('Botox Cosmetic');
  const [mainProvider, setMainProvider] = useState<Practitioner | null>(null);
  const [assistantProvider, setAssistantProvider] = useState<Practitioner | null>(null);
  const [notes, setNotes] = useState('');

  const timeSlots = useMemo(() => generateTimeSlots(), []);

  // Normalize date to midnight (remove time component)
  const normalizeDate = useCallback((d: Date | string): Date => {
    const normalized = new Date(d);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }, []);

  // Track previous isOpen state to detect transitions
  const prevIsOpenRef = useRef(isOpen);

  // Track when prefilled data is loaded (for forcing remount of inputs)
  const [prefillKey, setPrefillKey] = useState(0);

  // Load existing data in edit mode
  useEffect(() => {
    if (mode === 'edit' && isOpen && appointment && procedure) {
      const loadData = async (): Promise<void> => {
        const promises: Promise<unknown>[] = [];

        // Load patient
        const patientRef = procedure.subject;
        if (patientRef?.reference?.startsWith('Patient/')) {
          const patientId = patientRef.reference.split('/')[1];
          promises.push(
            medplum.readResource('Patient', patientId).then(setPatient).catch(console.error)
          );
        }

        // Load providers
        const performers = procedure.performer || [];
        performers.forEach((p, index) => {
          if (p.actor?.reference?.startsWith('Practitioner/')) {
            const providerId = p.actor.reference.split('/')[1];
            promises.push(
              medplum.readResource('Practitioner', providerId).then((practitioner) => {
                if (index === 0) {
                  setMainProvider(practitioner);
                } else {
                  setAssistantProvider(practitioner);
                }
              }).catch(console.error)
            );
          }
        });

        // Wait for all async data to load
        await Promise.all(promises);

        // Parse date/time from appointment
        if (appointment.start) {
          const startDate = dayjs(appointment.start);
          setDate(normalizeDate(startDate.toDate()));
          setTime(startDate.format('HH:mm'));

          // Calculate duration
          if (appointment.end) {
            const durationMinutes = dayjs(appointment.end).diff(startDate, 'minute');
            setDuration(durationMinutes);
          }
        }

        // Load service type
        const serviceName = procedure.code?.text || appointment.serviceType?.[0]?.text || 'Botox Cosmetic';
        setServiceType(serviceName);

        // Load notes
        const noteText = procedure.note?.[0]?.text || appointment.description || '';
        setNotes(noteText);

        // Force remount of inputs with prefilled values
        setPrefillKey((prev) => prev + 1);
      };

      loadData().catch(console.error);
    }
  }, [mode, isOpen, appointment, procedure, medplum, normalizeDate]);

  // Reset form when modal opens in create mode (isOpen transitions from false to true)
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    // Only reset when modal transitions from closed to open in create mode
    if (isOpen && !wasOpen && mode === 'create') {
      setDate(normalizeDate(initialDate));
      setTime(initialTime);
      setDuration(initialDuration);
      setErrors({});
      setPatient(null);
      setMainProvider(null);
      setAssistantProvider(null);
      setNotes('');
      setServiceType('Botox Cosmetic');
    }
  }, [isOpen, initialDate, initialTime, initialDuration, normalizeDate, mode]);

  // Validation
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!patient) {
      newErrors.patient = 'Patient is required';
    }
    if (!date) {
      newErrors.date = 'Date is required';
    }
    if (!time) {
      newErrors.time = 'Time is required';
    }
    if (!serviceType) {
      newErrors.serviceType = 'Service type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [patient, date, time, serviceType]);

  // Get service code from service type
  const getServiceCode = useCallback((type: string): string => {
    const service = SERVICE_TYPES.find(s => s.value === type);
    return service?.code || type.toLowerCase().replace(' ', '-');
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!validateForm()) {return;}
    if (!patient || !date || !time) {return;}

    setIsSubmitting(true);

    try {
      // Calculate start and end times
      const [hours, minutes] = time.split(':').map(Number);
      const startDateTime = dayjs(date).hour(hours).minute(minutes).second(0);
      const endDateTime = startDateTime.add(duration, 'minute');

      // 1. Create Appointment
      const appointment: Appointment = {
        resourceType: 'Appointment',
        status: 'booked',
        serviceType: [{ text: serviceType }],
        description: notes || undefined,
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
        participant: [
          {
            actor: createReference(patient),
            status: 'accepted',
          },
        ],
      };

      // Add main provider if selected
      if (mainProvider) {
        appointment.participant.push({
          actor: createReference(mainProvider),
          status: 'accepted',
        });
      }

      // Add assistant provider if selected
      if (assistantProvider) {
        appointment.participant.push({
          actor: createReference(assistantProvider),
          status: 'accepted',
        });
      }

      const savedAppointment = await medplum.createResource(appointment);

// 2. Create linked Procedure (Treatment)
    const serviceCode = getServiceCode(serviceType);
    const procedure: Procedure = {
      resourceType: 'Procedure',
      status: 'preparation',
      code: {
        text: serviceType,
        coding: [
          {
            system: 'http://melissaknudson.com/treatments',
            code: serviceCode,
            display: serviceType,
          },
        ],
      },
      subject: createReference(patient),
      // Set providers as performers - main provider first, assistant second
      // This allows checking assignments for status transitions
      performer:
        mainProvider || assistantProvider
          ? [
              ...(mainProvider ? [{ actor: createReference(mainProvider) }] : []),
              ...(assistantProvider ? [{ actor: createReference(assistantProvider) }] : []),
            ]
          : undefined,
      // Note: performedPeriod is NOT set here - it will be set when treatment starts
      extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
            valueReference: createReference(savedAppointment),
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/treatment-status',
            valueString: 'preparation',
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/created-by',
            valueReference: medplum.getProfile()
              ? createReference(medplum.getProfile() as Practitioner)
              : undefined,
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/scheduled-datetime',
            valueDateTime: startDateTime.toISOString(),
          },
        ],
        note: notes
          ? [
              {
                text: notes,
                time: new Date().toISOString(),
              },
            ]
          : undefined,
      };

      const savedProcedure = await medplum.createResource(procedure);

      // Show toast notification
      showNotification({
        title: 'Appointment Booked',
        message: `${serviceType} appointment scheduled for ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family} on ${startDateTime.format('MMM D, YYYY')} at ${startDateTime.format('h:mm A')}`,
        color: 'green',
      });

      // Create in-app notification for assigned providers
      const user = medplum.getProfile() as Practitioner | undefined;
      const notificationData: NotificationData = {
        patient,
        appointment: savedAppointment,
        procedure: savedProcedure,
        provider: mainProvider || undefined,
        assistant: assistantProvider || undefined,
        date: startDateTime.toISOString(),
        time: startDateTime.format('h:mm A'),
        serviceType,
      };

      await createNotification(medplum, 'appointment-created', notificationData, user);

      // Reset form
      setPatient(null);
      setNotes('');
      setMainProvider(null);
      setAssistantProvider(null);

      onSuccess();
    } catch (err) {
      showNotification({
        title: 'Error booking appointment',
        message: normalizeErrorString(err),
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateForm,
    patient,
    date,
    time,
    duration,
    serviceType,
    mainProvider,
    assistantProvider,
    notes,
    getServiceCode,
    medplum,
    onSuccess,
  ]);

  // Handle update in edit mode
  const handleUpdate = useCallback(async (): Promise<void> => {
    if (!validateForm()) { return; }
    if (!patient || !date || !time || !appointment || !procedure) { return; }
    if (procedure.status !== 'preparation') {
      showNotification({
        title: 'Cannot Edit',
        message: 'Only scheduled treatments can be edited',
        color: 'red',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate start and end times
      const [hours, minutes] = time.split(':').map(Number);
      const startDateTime = dayjs(date).hour(hours).minute(minutes).second(0);
      const endDateTime = startDateTime.add(duration, 'minute');

      const serviceCode = getServiceCode(serviceType);
      const oldServiceType = procedure.code?.text || '';
      const serviceTypeChanged = oldServiceType !== serviceType;

      // 1. Update Appointment
      const updatedAppointment: Appointment = {
        ...appointment,
        serviceType: [{ text: serviceType }],
        description: notes || undefined,
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
        participant: [
          {
            actor: createReference(patient),
            status: 'accepted',
          },
        ],
      };

      // Add main provider if selected
      if (mainProvider) {
        updatedAppointment.participant.push({
          actor: createReference(mainProvider),
          status: 'accepted',
        });
      }

      // Add assistant provider if selected
      if (assistantProvider) {
        updatedAppointment.participant.push({
          actor: createReference(assistantProvider),
          status: 'accepted',
        });
      }

      const savedAppointment = await medplum.updateResource(updatedAppointment);

      // 2. Update Procedure (Treatment)
      const updatedProcedure: Procedure = {
        ...procedure,
        code: {
          text: serviceType,
          coding: [
            {
              system: 'http://melissaknudson.com/treatments',
              code: serviceCode,
              display: serviceType,
            },
          ],
        },
      subject: createReference(patient),
      performer:
        mainProvider || assistantProvider
          ? [
              ...(mainProvider ? [{ actor: createReference(mainProvider) }] : []),
              ...(assistantProvider ? [{ actor: createReference(assistantProvider) }] : []),
            ]
          : undefined,
      extension: [
          // Keep existing extensions
          ...(procedure.extension?.filter(e => 
            !['http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
              'http://melissaknudson.com/fhir/StructureDefinition/treatment-status',
              'http://melissaknudson.com/fhir/StructureDefinition/scheduled-datetime'
            ].includes(e.url)
          ) || []),
          { url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment', valueReference: createReference(savedAppointment) },
          { url: 'http://melissaknudson.com/fhir/StructureDefinition/treatment-status', valueString: 'preparation' },
          // Add edit history
          ...(procedure.extension?.filter(e => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/edit-history').length ? [] : []),
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/last-edited',
            valueDateTime: new Date().toISOString(),
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/edited-by',
            valueReference: medplum.getProfile() ? createReference(medplum.getProfile() as Practitioner) : undefined,
          },
          { url: 'http://melissaknudson.com/fhir/StructureDefinition/scheduled-datetime', valueDateTime: startDateTime.toISOString() },
        ],
        note: notes
          ? [
              {
                text: notes,
                time: new Date().toISOString(),
              },
            ]
          : undefined,
      };

      const savedProcedure = await medplum.updateResource(updatedProcedure);

      // Show toast notification
      showNotification({
        title: 'Booking Updated',
        message: `${serviceType} appointment updated for ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family} on ${startDateTime.format('MMM D, YYYY')} at ${startDateTime.format('h:mm A')}`,
        color: 'green',
      });

      // Check if service type changed - if so, redirect to new treatment page
      if (serviceTypeChanged) {
        onSuccess();
        // Let the parent component handle navigation
        return;
      }

      onSuccess();
    } catch (err) {
      showNotification({
        title: 'Error updating appointment',
        message: normalizeErrorString(err),
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateForm,
    patient,
    date,
    time,
    duration,
    serviceType,
    mainProvider,
    assistantProvider,
    notes,
    getServiceCode,
    medplum,
    onSuccess,
    appointment,
    procedure,
  ]);

  // Clear form errors when modal closes (transition end)
  const handleCloseTransition = useCallback(() => {
    // Just clear errors, actual reset happens when modal opens
    setErrors({});
  }, []);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Booking' : 'New Appointment'}
      size="lg"
      onExitTransitionEnd={handleCloseTransition}
    >
      <Stack gap="md">
        {/* Patient Selection */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Patient <span style={{ color: 'red' }}>*</span>
          </Text>
          <ResourceInput
            key={`patient-${prefillKey}`}
            resourceType="Patient"
            name="patient"
            defaultValue={patient ?? undefined}
            placeholder="Search for patient..."
            onChange={(value) => setPatient(value as Patient | null)}
          />
          {errors.patient && (
            <Text size="xs" color="red" mt="xs">
              {errors.patient}
            </Text>
          )}
        </div>

        {/* Date and Time */}
        <Group grow>
          <div>
            <Text size="sm" fw={500} mb="xs">
              Date <span style={{ color: 'red' }}>*</span>
            </Text>
              <DatePickerInput
                value={date}
                onChange={(d) => setDate(d ? normalizeDate(d) : normalizeDate(new Date()))}
                placeholder="Select date"
                leftSection={<IconCalendar size={16} />}
                error={errors.date}
              />
          </div>
          <div>
            <Text size="sm" fw={500} mb="xs">
              Time <span style={{ color: 'red' }}>*</span>
            </Text>
            <Select
              value={time}
              onChange={(t) => setTime(t || '')}
              data={timeSlots}
              placeholder="Select time"
              error={errors.time}
              searchable
            />
          </div>
        </Group>

        {/* Duration */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Duration
          </Text>
          <Select
            value={String(duration)}
            onChange={(d) => setDuration(Number(d) || 30)}
            data={DURATIONS}
          />
        </div>

        {/* Service Type */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Service Type <span style={{ color: 'red' }}>*</span>
          </Text>
          <Select
            value={serviceType}
            onChange={(s) => setServiceType(s || 'Botox Cosmetic')}
            data={SERVICE_TYPES.map((s) => ({ value: s.value, label: s.label }))}
            error={errors.serviceType}
          />
        </div>

        {/* Main Provider (Optional) */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Main Provider
          </Text>
          <AsyncAutocomplete<Practitioner>
            key={`mainProvider-${prefillKey}`}
            name="mainProvider"
            placeholder="Select main provider (optional)..."
            defaultValue={mainProvider ?? undefined}
            toOption={(p) => ({ value: p.id ?? '', label: getPractitionerDisplay(p), resource: p })}
            loadOptions={async (input, signal) => {
              const searchParams = new URLSearchParams({
                name: input ?? '',
                _count: '20',
              });
              const results = await medplum.searchResources('Practitioner', searchParams, { signal });
              // Only actual providers (RN) can be main provider
              return results.filter((p) => isProvider(p));
            }}
            onChange={(items) => setMainProvider(items[0] ?? null)}
            clearable
          />
        </div>

        {/* Assistant Provider (Optional) */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Assistant Provider
          </Text>
          <AsyncAutocomplete<Practitioner>
            key={`assistantProvider-${prefillKey}`}
            name="assistantProvider"
            placeholder="Select assistant provider (optional)..."
            defaultValue={assistantProvider ?? undefined}
            toOption={(p) => ({ value: p.id ?? '', label: getPractitionerDisplay(p), resource: p })}
            loadOptions={async (input, signal) => {
              const searchParams = new URLSearchParams({
                name: input ?? '',
                _count: '20',
              });
              const results = await medplum.searchResources('Practitioner', searchParams, { signal });
              // Providers (RN) and assistants can be selected as assistants
              return results.filter((p) => isProvider(p) || isAssistant(p));
            }}
            onChange={(items) => setAssistantProvider(items[0] ?? null)}
            clearable
          />
        </div>

        {/* Notes */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Notes
          </Text>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about the appointment..."
            minRows={3}
          />
        </div>

      {/* Action Buttons */}
      <Group justify="space-between" mt="md">
        <Button variant="light" color="gray" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={mode === 'edit' ? handleUpdate : handleSubmit} 
          loading={isSubmitting} 
          disabled={!patient || !date || !time}
        >
          {mode === 'edit' ? 'Save Changes' : 'Book Appointment'}
        </Button>
      </Group>
      </Stack>
    </Modal>
  );
}
