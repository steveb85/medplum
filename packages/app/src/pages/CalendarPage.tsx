// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  Badge,
  Button,
  Chip,
  Group,
  Text as MantineText,
  MultiSelect,
  Paper,
  Select,
  Stack,
  Title,
  Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { getReferenceString } from '@medplum/core';
import type { Appointment, Device, Practitioner, ServiceRequest } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconFilter, IconPlus, IconTool } from '@tabler/icons-react';
import dayjs from 'dayjs';
import moment from 'moment';
import 'moment-timezone';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EventProps, View } from 'react-big-calendar';
import { Calendar as ReactBigCalendar, momentLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CreateAppointmentModalV3 } from '../components/CreateAppointmentModalV3';
import { EXTENSION_URLS } from '../utils/fhir-extensions';
import './CalendarPage.css';

const EXTENSION_URL_SERVICE_POSITION = 'http://melissaknudson.com/fhir/StructureDefinition/service-position';

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return `rgba(0,0,0,${alpha})`;
  }
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
}

function getDeviceName(device: Device): string {
  return device.deviceName?.[0]?.name || device.id || 'Unknown';
}

function getPractitionerColor(practitionerId: string, practitioners: Practitioner[]): string {
  const practitioner = practitioners.find((p) => p.id === practitionerId);
  if (!practitioner?.extension) {
    return '#1a73e8'; // Default blue
  }
  const colorExt = practitioner.extension.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color'
  );
  return colorExt?.valueString || '#1a73e8';
}

moment.tz.setDefault(Intl.DateTimeFormat().resolvedOptions().timeZone);
const localizer = momentLocalizer(moment);

const CALENDAR_MIN_TIME = new Date(2024, 0, 1, 8, 0, 0);
const CALENDAR_MAX_TIME = new Date(2024, 0, 1, 20, 0, 0);

const ROOM_LABELS: Record<string, string> = {
  'room-1': 'R1',
  'room-2': 'R2',
  'room-3': 'R3',
};

const ROOM_COLORS: Record<string, string> = {
  'room-1': '#e3f2fd', // Light blue
  'room-2': '#e8f5e9', // Light green
  'room-3': '#fff3e0', // Light orange
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#fcc419',
  booked: '#228be6',
  arrived: '#20c997',
  fulfilled: '#40c057',
  cancelled: '#fa5252',
  noshow: '#868e96',
};

interface CalendarServiceEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    appointment: Appointment;
    serviceRequest: ServiceRequest;
    patientName: string;
    serviceName: string;
    room: string;
    equipment: string[];
    status: string;
    appointmentId: string;
    sequence: number;
  };
}

function parseServiceEvent(
  appointment: Appointment,
  sr: ServiceRequest,
  allServiceRequests: ServiceRequest[],
  allEquipment: Device[]
): CalendarServiceEvent {
  const patientParticipant = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'));
  const patientName = patientParticipant?.actor?.display || 'Unknown Patient';

  const serviceName = sr.code?.text || sr.code?.coding?.[0]?.display || 'Service';

  const roomExt = sr.extension?.find((e) => e.url === EXTENSION_URLS.serviceRequest.assignedRoom);
  const room = (roomExt?.valueString as string) || 'room-1';

  const equipmentExts = sr.extension?.filter((e) => e.url === EXTENSION_URLS.serviceRequest.assignedEquipment) || [];
  const equipment = equipmentExts
    .map((e) => e.valueReference?.reference)
    .filter(Boolean)
    .map((ref) => {
      const deviceId = ref?.split('/')[1];
      const device = allEquipment.find((d) => d.id === deviceId);
      return device ? getDeviceName(device) : deviceId || '';
    });

  const statusExt = sr.extension?.find((e) => e.url === EXTENSION_URLS.serviceRequest.serviceStatus);
  const status = (statusExt?.valueString as string) || appointment.status || 'pending';

  const sequenceExt = sr.extension?.find((e) => e.url === EXTENSION_URL_SERVICE_POSITION);
  const sequence = (sequenceExt?.valueInteger as number) || 1;

  const sortedServices = allServiceRequests
    .filter((s) => {
      const srApptExt = s.extension?.find((e) => e.url === EXTENSION_URLS.common.linkedAppointment);
      return srApptExt?.valueReference?.reference === getReferenceString(appointment);
    })
    .sort((a, b) => {
      const seqA = (a.extension?.find((e) => e.url === EXTENSION_URL_SERVICE_POSITION)?.valueInteger as number) || 1;
      const seqB = (b.extension?.find((e) => e.url === EXTENSION_URL_SERVICE_POSITION)?.valueInteger as number) || 1;
      return seqA - seqB;
    });

  const serviceIndex = sortedServices.findIndex((s) => s.id === sr.id);
  const apptStart = moment(appointment.start || new Date());

  // Calculate sequential start/end times using each service's actual duration
  let serviceStart: moment.Moment | null = null;
  let serviceEnd: moment.Moment | null = null;
  let currentTime = apptStart.clone();
  for (let i = 0; i < sortedServices.length; i++) {
    const svc = sortedServices[i];
    const durationExt = svc.extension?.find((e) => e.url === EXTENSION_URLS.serviceRequest.actualDuration);
    const duration = (durationExt?.valueInteger as number) || 60;
    if (i === serviceIndex) {
      serviceStart = currentTime.clone();
      serviceEnd = currentTime.clone().add(duration, 'minutes');
      break;
    }
    currentTime = currentTime.add(duration, 'minutes');
  }

  if (!serviceStart || !serviceEnd) {
    serviceStart = apptStart.clone();
    serviceEnd = apptStart.clone().add(60, 'minutes');
  }

  return {
    id: `${appointment.id || 'appt'}-${sr.id || 'sr'}`,
    title: `${patientName} - ${serviceName}`,
    start: serviceStart.toDate(),
    end: serviceEnd.toDate(),
    resource: {
      appointment,
      serviceRequest: sr,
      patientName,
      serviceName,
      room,
      equipment,
      status,
      appointmentId: appointment.id || '',
      sequence,
    },
  };
}

function ServiceCalendarEvent({
  event,
  practitioners,
}: EventProps<CalendarServiceEvent> & { practitioners: Practitioner[] }): JSX.Element {
  const { resource } = event;
  const roomLabel = ROOM_LABELS[resource.room] || resource.room.replace('room-', 'R');
  const statusColor = STATUS_COLORS[resource.status] || '#868e96';
  const roomColor = ROOM_COLORS[resource.room] || '#f8f9fa';
  const getProviderInfo = (): { initials: string; color: string } => {
    const performers = resource.serviceRequest.performer || [];
    // Try to get main provider first, then assistant
    const mainProvider = performers[0];
    const assistant = performers[1]?.display;
    const nameToUse = mainProvider?.display || assistant || '';
    if (!mainProvider?.reference) {
      return { initials: '', color: '#1a73e8' };
    }
    const practitionerId = mainProvider.reference.split('/')[1];
    const color = getPractitionerColor(practitionerId || '', practitioners);
    if (!nameToUse) {
      return { initials: '', color };
    }
    const nameParts = nameToUse.split(' ');
    const initials = nameParts.map((p: string) => p[0]).join('');
    return { initials: initials.toUpperCase(), color };
  };
  const { initials: providerInitials, color: providerColor } = getProviderInfo();
  return (
    <Tooltip
      label={
        <div>
          <div>
            <strong>{resource.patientName}</strong>
          </div>
          <div>{resource.serviceName}</div>
          <div>
            Room: {roomLabel} | Seq: #{resource.sequence}
          </div>
          {resource.equipment.length > 0 && <div>Equipment: {resource.equipment.join(', ')}</div>}
          <div>Status: {resource.status}</div>
        </div>
      }
      withArrow
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 4px',
          borderRadius: 4,
          borderLeft: `3px solid ${statusColor}`,
          backgroundColor: roomColor,
          color: '#000',
          fontSize: 12,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {providerInitials && (
          <Badge
            size="xs"
            variant="filled"
            color={providerColor}
            style={{ fontSize: 9, padding: '0 3px', minWidth: 24, textAlign: 'center' }}
          >
            {providerInitials}
          </Badge>
        )}
        {resource.equipment.length > 0 && <IconTool size={12} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{resource.patientName}</span>
      </div>
    </Tooltip>
  );
}

export function CalendarPage(): JSX.Element {
  const medplum = useMedplum();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [view, setView] = useState<'month' | 'week' | 'day'>('week');
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [equipment, setEquipment] = useState<Device[]>([]);

  const [showFilters, setShowFilters] = useState(false);
  const [roomFilter, setRoomFilter] = useState<string[]>([]);
  const [providerFilter, setProviderFilter] = useState<string[]>([]);
  const [equipmentFilter, setEquipmentFilter] = useState<string[]>([]);

  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);

  useEffect(() => {
    const set = async (): Promise<void> => {
      setView('day');
    };
    if (isMobile && view !== 'day') {
      set().catch(console.error);
    }
  }, [isMobile, view]);

  const loadCalendarData = useCallback(async () => {
    try {
      setLoading(true);

      const startDate = dayjs(date)
        .startOf(view === 'month' ? 'month' : view)
        .format('YYYY-MM-DDTHH:mm:ss');
      const endDate = dayjs(date)
        .endOf(view === 'month' ? 'month' : view)
        .format('YYYY-MM-DDTHH:mm:ss');

      const [apptsBundle, srsBundle, equipBundle, pracBundle] = await Promise.all([
        medplum.search('Appointment', {
          'date:gt': startDate,
          'date:lt': endDate,
          _sort: 'date',
          _count: '100',
        }),
        medplum.search('ServiceRequest', {
          _count: '500',
        }),
        medplum.search('Device', { _count: '50' }),
        medplum.search('Practitioner', { _count: '50' }),
      ]);

      setAppointments((apptsBundle.entry || []).map((e) => e.resource as Appointment));
      setServiceRequests((srsBundle.entry || []).map((e) => e.resource as ServiceRequest));
      setEquipment((equipBundle.entry || []).map((e) => e.resource as Device));
      setPractitioners((pracBundle.entry || []).map((e) => e.resource as Practitioner));
    } catch (err) {
      console.error('Error loading calendar data:', err);
    } finally {
      setLoading(false);
    }
  }, [medplum, date, view]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCalendarData().catch(console.error);
  }, [loadCalendarData]);

  const allRooms = useMemo(() => {
    const rooms = new Set<string>();
    serviceRequests.forEach((sr) => {
      const roomExt = sr.extension?.find((e) => e.url === EXTENSION_URLS.serviceRequest.assignedRoom);
      if (roomExt?.valueString) {
        rooms.add(roomExt.valueString);
      }
    });
    return Array.from(rooms).sort();
  }, [serviceRequests]);

  const allEquipmentOptions = useMemo(() => {
    return equipment.map((e) => ({
      value: e.id || '',
      label: getDeviceName(e),
    }));
  }, [equipment]);

  const allProviders = useMemo(() => {
    return practitioners
      .filter((p) => p.id && p.name)
      .map((p) => ({
        value: p.id || '',
        label: `${p.name?.[0]?.given?.[0] || ''} ${p.name?.[0]?.family || ''}`.trim() || p.id || '',
      }));
  }, [practitioners]);

  const events = useMemo(() => {
    const result: CalendarServiceEvent[] = [];
    for (const appt of appointments) {
      const linkedSRs = serviceRequests.filter((sr) => {
        const srApptExt = sr.extension?.find((e) => e.url === EXTENSION_URLS.common.linkedAppointment);
        return srApptExt?.valueReference?.reference === getReferenceString(appt);
      });
      for (const sr of linkedSRs) {
        result.push(parseServiceEvent(appt, sr, serviceRequests, equipment));
      }
    }

    return result.filter((e) => {
      if (roomFilter.length > 0 && !roomFilter.includes(e.resource.room)) {
        return false;
      }
      if (providerFilter.length > 0) {
        const sr = e.resource.serviceRequest;
        const performers = sr.performer || [];
        const hasMatchingProvider = performers.some((p) => {
          const performerId = p.reference?.split('/')[1];
          return performerId && providerFilter.includes(performerId);
        });
        if (!hasMatchingProvider) {
          return false;
        }
      }
      if (equipmentFilter.length > 0) {
        const hasMatchingEquipment = e.resource.equipment.some((eqName) => {
          return equipment.some((eq) => {
            const eqLabel = getDeviceName(eq);
            return eqLabel === eqName && equipmentFilter.includes(eq.id || '');
          });
        });
        if (!hasMatchingEquipment) {
          return false;
        }
      }
      return true;
    });
  }, [appointments, serviceRequests, equipment, roomFilter, providerFilter, equipmentFilter]);

  const handleSelectEvent = useCallback((event: { resource: CalendarServiceEvent['resource'] }) => {
    const appointment = event.resource.appointment;
    if (appointment.id) {
      window.location.href = `/bookings/${appointment.id}`;
    }
  }, []);

  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date }) => {
    setSelectedSlot(slotInfo);
    setIsModalOpen(true);
  }, []);

  const handleOpenModal = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedSlot({ start: today, end: today });
    setIsModalOpen(true);
  }, []);

  const handleModalSuccess = useCallback(() => {
    setIsModalOpen(false);
    setSelectedSlot(null);
    loadCalendarData().catch(console.error);
  }, [loadCalendarData]);

  const handlePrev = useCallback(() => {
    setDate((prevDate) => dayjs(prevDate).subtract(1, view).toDate());
  }, [view]);

  const handleToday = useCallback(() => {
    setDate(new Date());
  }, []);

  const handleNext = useCallback(() => {
    setDate((prevDate) => dayjs(prevDate).add(1, view).toDate());
  }, [view]);

  const handleNavigate = useCallback((newDate: Date) => {
    setDate((prevDate) => {
      if (newDate.getTime() === prevDate.getTime()) {
        return prevDate;
      }
      return newDate;
    });
  }, []);

  const handleViewChange = useCallback((newView: View) => {
    setView((prevView) => {
      const validView = newView === 'month' || newView === 'week' || newView === 'day' ? newView : 'week';
      if (validView === prevView) {
        return prevView;
      }
      return validView;
    });
  }, []);

  const roomLabels = useMemo(() => {
    return allRooms.map((room) => ({
      value: room,
      label: ROOM_LABELS[room] || room,
    }));
  }, [allRooms]);

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
          <Button
            variant={showFilters ? 'filled' : 'default'}
            leftSection={<IconFilter size={16} />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={handleOpenModal}>
            New Appointment
          </Button>
        </Group>
      </Group>

      {showFilters && (
        <Paper withBorder p="md">
          <Stack gap="md">
            <Group grow>
              <div>
                <MantineText size="sm" fw={500} mb="xs">
                  Rooms
                </MantineText>
                <MultiSelect
                  data={roomLabels}
                  value={roomFilter}
                  onChange={setRoomFilter}
                  placeholder="Filter by room..."
                  clearable
                  w="100%"
                />
              </div>
              <div>
                <MantineText size="sm" fw={500} mb="xs">
                  Providers
                </MantineText>
                <MultiSelect
                  data={allProviders}
                  value={providerFilter}
                  onChange={setProviderFilter}
                  placeholder="Filter by provider..."
                  clearable
                  searchable
                  w="100%"
                />
              </div>
              <div>
                <MantineText size="sm" fw={500} mb="xs">
                  Equipment
                </MantineText>
                <MultiSelect
                  data={allEquipmentOptions}
                  value={equipmentFilter}
                  onChange={setEquipmentFilter}
                  placeholder="Filter by equipment..."
                  clearable
                  searchable
                  w="100%"
                />
              </div>
            </Group>
            {(roomFilter.length > 0 || providerFilter.length > 0 || equipmentFilter.length > 0) && (
              <Group>
                <MantineText size="xs" c="dimmed">
                  Active filters:
                </MantineText>
                {roomFilter.map((room) => (
                  <Chip
                    key={room}
                    size="xs"
                    checked={true}
                    onChange={() => setRoomFilter(roomFilter.filter((r) => r !== room))}
                  >
                    Room: {ROOM_LABELS[room] || room}
                  </Chip>
                ))}
                {providerFilter.map((pid) => {
                  const provider = practitioners.find((p) => p.id === pid);
                  return (
                    <Chip
                      key={pid}
                      size="xs"
                      checked={true}
                      onChange={() => setProviderFilter(providerFilter.filter((p) => p !== pid))}
                    >
                      Provider: {provider?.name?.[0]?.given?.[0]} {provider?.name?.[0]?.family}
                    </Chip>
                  );
                })}
                {equipmentFilter.map((eid) => {
                  const eq = equipment.find((e) => e.id === eid);
                  return (
                    <Chip
                      key={eid}
                      size="xs"
                      checked={true}
                      onChange={() => setEquipmentFilter(equipmentFilter.filter((e) => e !== eid))}
                    >
                      Equipment: {eq ? getDeviceName(eq) : eid}
                    </Chip>
                  );
                })}
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    setRoomFilter([]);
                    setProviderFilter([]);
                    setEquipmentFilter([]);
                  }}
                >
                  Clear all
                </Button>
              </Group>
            )}
          </Stack>
        </Paper>
      )}

      <Paper withBorder p="md" style={{ height: 'calc(100vh - 100px)' }}>
        <ReactBigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          dayLayoutAlgorithm="no-overlap"
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
          min={CALENDAR_MIN_TIME}
          max={CALENDAR_MAX_TIME}
          step={15}
          timeslots={4}
          components={{
            event: (props) => ServiceCalendarEvent({ ...props, practitioners }),
          }}
        />
      </Paper>

      <CreateAppointmentModalV3
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSlot(null);
        }}
        onSuccess={handleModalSuccess}
        initialSlot={selectedSlot}
      />
    </Stack>
  );
}
