// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Title, Paper, Stack, Group, Button, Select } from '@mantine/core';
import { useMedplum } from '@medplum/react';
import type { Appointment } from '@medplum/fhirtypes';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar as ReactBigCalendar, dayjsLocalizer } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { IconPlus } from '@tabler/icons-react';
import type { JSX } from 'react';
import { CreateAppointmentModal } from '../components/CreateAppointmentModal';

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Set up the localizer for react-big-calendar
const localizer = dayjsLocalizer(dayjs);

// NOTIFICATION_OPPORTUNITY: When a new appointment is created, 
// we could notify the assigned provider via Communication resource or in-app notification
// Location: In CreateAppointmentModal after successful creation

// NOTIFICATION_OPPORTUNITY: When coordinator uploads before photos,
// provider could be notified that treatment is ready to start
// Location: In BotoxTreatmentPage after photo upload

// NOTIFICATION_OPPORTUNITY: When provider completes treatment,
// coordinator could be notified for follow-up scheduling
// Location: In BotoxTreatmentPage after status transition to completed

export function CalendarPage(): JSX.Element {
  const medplum = useMedplum();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [view, setView] = useState<'month' | 'week' | 'day'>('week');
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);

// Load appointments
const loadCalendarData = useCallback(async () => {
try {
setLoading(true);

      // Calculate date range based on current view
      // Format dates without milliseconds for FHIR compatibility
      const startDate = dayjs(date).startOf(view === 'month' ? 'month' : view).format('YYYY-MM-DDTHH:mm:ss');
      const endDate = dayjs(date).endOf(view === 'month' ? 'month' : view).format('YYYY-MM-DDTHH:mm:ss');

      // Load appointments in date range
      // Use separate date parameters for FHIR search
      const appointmentsBundle = await medplum.search('Appointment', {
        'date:gt': startDate,
        'date:lt': endDate,
        _sort: 'date',
        _count: '100',
      });

      setAppointments((appointmentsBundle.entry || []).map(e => e.resource as Appointment));
    } catch (err) {
      console.error('Error loading calendar data:', err);
    } finally {
      setLoading(false);
    }
  }, [medplum, date, view]);

useEffect(() => {
// Load calendar data on mount and when dependencies change.
// This is the standard pattern for initializing data from an external API.
// eslint-disable-next-line react-hooks/set-state-in-effect
loadCalendarData().catch(console.error);
}, [loadCalendarData]);

  // Convert appointments to calendar events
  const events = useMemo(() => {
    return appointments.map((appointment) => {
      const patientParticipant = appointment.participant?.find(
        p => p.actor?.reference?.startsWith('Patient/')
      );

      const patientName = patientParticipant?.actor?.display || 'Unknown Patient';
      const serviceType = appointment.serviceType?.[0]?.text || 'Appointment';
      
      return {
        id: appointment.id,
        title: `${patientName} - ${serviceType}`,
        start: new Date(appointment.start || new Date()),
        end: new Date(appointment.end || new Date()),
        resource: appointment,
      };
    });
  }, [appointments]);

  // Handle clicking on an event
  const handleSelectEvent = useCallback((event: { resource: Appointment }) => {
    const patientParticipant = event.resource.participant?.find(
      p => p.actor?.reference?.startsWith('Patient/')
    );
    const patientId = patientParticipant?.actor?.reference?.split('/')[1];
    
    if (patientId) {
      // Navigate to patient's treatments tab
      window.location.href = `/Patient/${patientId}/treatments`;
    }
  }, []);

  // Handle clicking on a time slot
  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date }) => {
    setSelectedSlot(slotInfo);
    setIsModalOpen(true);
  }, []);

  // Handle opening modal from "New Appointment" button
  const handleOpenModal = useCallback(() => {
    setSelectedSlot(null);
    setIsModalOpen(true);
  }, []);

  // Handle modal success
  const handleModalSuccess = useCallback(() => {
    setIsModalOpen(false);
    setSelectedSlot(null);
    // Refresh calendar data
    loadCalendarData().catch(console.error);
  }, [loadCalendarData]);

  // Handle navigation (prev/next/today)
  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
  }, []);

// Handle view change
const handleViewChange = useCallback((newView: View) => {
// Only accept supported views, fallback to 'week' for unsupported views
if (newView === 'month' || newView === 'week' || newView === 'day') {
setView(newView);
} else {
setView('week');
}
}, []);

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" align="center">
        <Title order={3}>Calendar</Title>
        <Group>
          <Button.Group>
            <Button variant="default" onClick={() => setDate(dayjs(date).subtract(1, view).toDate())}>
              ←
            </Button>
            <Button variant="default" onClick={() => setDate(new Date())}>
              Today
            </Button>
            <Button variant="default" onClick={() => setDate(dayjs(date).add(1, view).toDate())}>
              →
            </Button>
          </Button.Group>
          <Select
            value={view}
            onChange={(value) => value && handleViewChange(value as typeof view)}
            data={[
              { value: 'month', label: 'Month' },
              { value: 'week', label: 'Week' },
              { value: 'day', label: 'Day' },
            ]}
            w={120}
          />
<Button
          leftSection={<IconPlus size={16} />}
          onClick={handleOpenModal}
        >
          New Appointment
        </Button>
        </Group>
      </Group>

<Paper withBorder p="md" style={{ height: 'calc(100vh - 200px)' }}>
      <ReactBigCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        view={view}
        onView={handleViewChange}
        date={date}
        onNavigate={handleNavigate}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        selectable
        popup
        style={{ height: '100%' }}
      />
    </Paper>

    <CreateAppointmentModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSuccess={handleModalSuccess}
      initialDate={selectedSlot?.start}
      initialTime={selectedSlot ? dayjs(selectedSlot.start).format('HH:mm') : undefined}
    />
  </Stack>
);
}
