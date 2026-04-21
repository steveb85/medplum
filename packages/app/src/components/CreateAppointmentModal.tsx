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
import { ResourceInput, useMedplum } from '@medplum/react';
import { IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState, useCallback, useMemo } from 'react';
import type { JSX } from 'react';
import { getMedSpaRole } from '../auth/role';

// NOTIFICATION_OPPORTUNITY: Send notification to assigned provider(s)
// when appointment is created
// Location: After successful creation of Appointment + Procedure

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: Date;
  initialTime?: string;
}

// Service types - extendable in future
const SERVICE_TYPES = [
  { value: 'Botox Cosmetic', label: 'Botox Cosmetic', code: 'botox-cosmetic' },
  { value: 'Filler', label: 'Filler', code: 'filler' },
  { value: 'Laser', label: 'Laser', code: 'laser' },
  { value: 'Consultation', label: 'Consultation', code: 'consultation' },
];

// Duration options in minutes
const DURATIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
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
}: CreateAppointmentModalProps): JSX.Element {
  const medplum = useMedplum();
  const role = getMedSpaRole(medplum);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [patient, setPatient] = useState<Patient | null>(null);
  const [date, setDate] = useState<Date>(initialDate);
  const [time, setTime] = useState<string>(initialTime);
  const [duration, setDuration] = useState<number>(30);
  const [serviceType, setServiceType] = useState<string>('Botox Cosmetic');
  const [mainProvider, setMainProvider] = useState<Practitioner | null>(null);
  const [assistantProvider, setAssistantProvider] = useState<Practitioner | null>(null);
  const [notes, setNotes] = useState('');

  const timeSlots = useMemo(() => generateTimeSlots(), []);

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
        performedPeriod: {
          start: undefined,
          end: undefined,
        },
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

      await medplum.createResource(procedure);

      showNotification({
        title: 'Appointment Booked',
        message: `${serviceType} appointment scheduled for ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family} on ${startDateTime.format('MMM D, YYYY')} at ${startDateTime.format('h:mm A')}`,
        color: 'green',
      });

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

  // Reset form when modal opens
  const handleOpen = useCallback(() => {
    setDate(initialDate);
    setTime(initialTime);
    setErrors({});
  }, [initialDate, initialTime]);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="New Appointment"
      size="lg"
      onExitTransitionEnd={handleOpen}
    >
      <Stack gap="md">
        {/* Patient Selection */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Patient <span style={{ color: 'red' }}>*</span>
          </Text>
<ResourceInput
              resourceType="Patient"
              name="patient"
              placeholder="Search for patient..."
              onChange={(value) => setPatient(value as Patient | null)}
              defaultValue={patient ?? undefined}
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
              onChange={(d:any) => setDate(d || new Date())}
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
<ResourceInput
              resourceType="Practitioner"
              name="mainProvider"
              placeholder="Select main provider (optional)..."
              onChange={(value) => setMainProvider(value as Practitioner | null)}
              defaultValue={mainProvider ?? undefined}
            />
        </div>

        {/* Assistant Provider (Optional) */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Assistant Provider
          </Text>
<ResourceInput
              resourceType="Practitioner"
              name="assistantProvider"
              placeholder="Select assistant provider (optional)..."
              onChange={(value) => setAssistantProvider(value as Practitioner | null)}
              defaultValue={assistantProvider ?? undefined}
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
          <Button onClick={handleSubmit} loading={isSubmitting} disabled={!patient || !date || !time}>
            Book Appointment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
