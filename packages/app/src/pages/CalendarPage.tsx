// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Title, Paper, Stack, Group, Button, Select } from '@mantine/core';
import { getReferenceString } from '@medplum/core';
import { useMedplum } from '@medplum/react';
import { useMediaQuery } from '@mantine/hooks';
import type { Appointment, Procedure } from '@medplum/fhirtypes';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar as ReactBigCalendar, momentLocalizer } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import moment from 'moment';
import 'moment-timezone';
import dayjs from 'dayjs';
import { IconPlus } from '@tabler/icons-react';
import type { JSX } from 'react';
// NOTE: CreateAppointmentModal removed - Phase 2 will implement multi-service booking

// Set moment to use local timezone
moment.tz.setDefault(Intl.DateTimeFormat().resolvedOptions().timeZone);

// Set up the localizer for react-big-calendar using moment
const localizer = momentLocalizer(moment);

// Calendar time range constants
// Using explicit Date constructor with year, month, day, hour, minute
// This creates dates in local time that will display as 8am-8pm
const CALENDAR_MIN_TIME = new Date(1970, 0, 1, 8, 0, 0); // 8:00 AM
const CALENDAR_MAX_TIME = new Date(1970, 0, 1, 20, 0, 0); // 8:00 PM

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
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [view, setView] = useState<'month' | 'week' | 'day'>('week');
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  // Auto-switch to day view on mobile
  useEffect(() => {
    if (isMobile && view !== 'day') {
      setView('day');
    }
  }, [isMobile, view]);

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
  const handleSelectEvent = useCallback(async (event: { resource: Appointment }) => {
    const patientParticipant = event.resource.participant?.find(
      p => p.actor?.reference?.startsWith('Patient/')
    );
    const patientId = patientParticipant?.actor?.reference?.split('/')[1];
    const appointment = event.resource;

    if (!patientId) return;

    // Try to find the linked procedure for this appointment
    try {
      const proceduresBundle = await medplum.search('Procedure', {
        subject: `Patient/${patientId}`,
        _sort: '-date',
        _count: '10',
      });

      // Find procedure with linked appointment extension
      const procedures = (proceduresBundle.entry || []).map(e => e.resource as Procedure);
      const linkedProcedure = procedures.find(p =>
        p.extension?.some(e =>
          e.url === 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment' &&
          e.valueReference?.reference === getReferenceString(appointment)
        )
      );

      if (linkedProcedure?.id) {
        // Navigate directly to the treatment
        window.location.href = `/Patient/${patientId}/botox-treatment?procedureId=${linkedProcedure.id}`;
      } else {
        // Fall back to treatments list
        window.location.href = `/Patient/${patientId}/treatments`;
      }
    } catch (err) {
      console.error('Error finding linked procedure:', err);
      // Fall back to treatments list
      window.location.href = `/Patient/${patientId}/treatments`;
    }
  }, [medplum]);

  // Handle clicking on a time slot
  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date }) => {
    setSelectedSlot(slotInfo);
    setIsModalOpen(true);
  }, []);

  // Handle opening modal from "New Appointment" button
  const handleOpenModal = useCallback(() => {
    // Use current date but reset to start of day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedSlot({ start: today, end: today });
    setIsModalOpen(true);
  }, []);

  // Handle modal success
  const handleModalSuccess = useCallback(() => {
    setIsModalOpen(false);
    setSelectedSlot(null);
    // Refresh calendar data
    loadCalendarData().catch(console.error);
  }, [loadCalendarData]);

  // Navigation button handlers (memoized to prevent infinite loops)
  const handlePrev = useCallback(() => {
    setDate((prevDate) => dayjs(prevDate).subtract(1, view).toDate());
  }, [view]);

  const handleToday = useCallback(() => {
    setDate(new Date());
  }, []);

  const handleNext = useCallback(() => {
    setDate((prevDate) => dayjs(prevDate).add(1, view).toDate());
  }, [view]);

  // Handle navigation (prev/next/today)
  const handleNavigate = useCallback((newDate: Date) => {
    setDate((prevDate) => {
      // Prevent unnecessary updates if the date hasn't changed
      if (newDate.getTime() === prevDate.getTime()) {
        return prevDate;
      }
      return newDate;
    });
  }, []);

  // Handle view change
  const handleViewChange = useCallback((newView: View) => {
    setView((prevView) => {
      // Only accept supported views, fallback to 'week' for unsupported views
      const validView = newView === 'month' || newView === 'week' || newView === 'day' ? newView : 'week';
      // Prevent unnecessary updates if the view hasn't changed
      if (validView === prevView) {
        return prevView;
      }
      return validView;
    });
  }, []);

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" align="center">
        <Title order={3}>Calendar</Title>
        <Group>
          <Button.Group>
            <Button variant="default" onClick={handlePrev}>
              ←
            </Button>
            <Button variant="default" onClick={handleToday}>
              Today
            </Button>
            <Button variant="default" onClick={handleNext}>
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
          {/* NOTE: New Appointment button removed - Phase 2 will implement multi-service booking
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleOpenModal}
          >
            New Appointment
          </Button>
          */}
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
          min={CALENDAR_MIN_TIME} // 8:00 AM
          max={CALENDAR_MAX_TIME} // 8:00 PM
          step={30}
          timeslots={2}
        />
      </Paper>

      {/* NOTE: CreateAppointmentModal removed - Phase 2 will implement multi-service booking
      <CreateAppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        initialDate={selectedSlot?.start}
        initialTime={selectedSlot ? moment(selectedSlot.start).format('HH:mm') : undefined}
        initialDuration={selectedSlot ? Math.max(15, moment(selectedSlot.end).diff(moment(selectedSlot.start), 'minutes')) : undefined}
      />
      */}
    </Stack>
  );
}
