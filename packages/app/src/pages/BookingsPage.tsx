// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { Appointment, Practitioner } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import {
  IconCalendarOff,
  IconCheck,
  IconDots,
  IconEye,
  IconSearch,
  IconUserCheck,
  IconUserX,
  IconX,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getDepositStatus,
  formatDepositAmount,
  getDepositStatusColor,
} from '../utils/payments';
import { getMedSpaRole } from '../auth/role';
import { createNotification } from '../notifications/utils';

// Appointment status configuration
// STATUS FLOW: pending (deposit required) → booked (deposit paid/waived) → arrived → fulfilled
const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'yellow', label: 'Pending (Deposit Required)' },
  booked: { color: 'blue', label: 'Booked (Deposit Paid)' },
  arrived: { color: 'teal', label: 'Arrived' },
  fulfilled: { color: 'green', label: 'Completed' },
  cancelled: { color: 'red', label: 'Cancelled' },
  noshow: { color: 'gray', label: 'No Show' },
};

// Status transition rules
const allowedTransitions: Record<string, string[]> = {
  pending: ['booked', 'cancelled'],
  booked: ['arrived', 'cancelled', 'noshow'],
  arrived: ['fulfilled', 'cancelled', 'noshow'],
  fulfilled: [],
  cancelled: [],
  noshow: [],
};

interface BookingRow {
  appointment: Appointment;
  patientName: string;
  patientId: string;
  services: string[];
}

export function BookingsPage(): JSX.Element {
  const medplum = useMedplum();
  const role = getMedSpaRole(medplum);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('upcoming');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal state for cancellation reason
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelBooking, setCancelBooking] = useState<BookingRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Load all appointments
  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);

      // Search for ALL appointments (practice-wide)
      const appointmentsBundle = await medplum.search('Appointment', {
        _sort: '-date',
        _count: '100',
      });

      const appointmentResources = (appointmentsBundle.entry || []).map((e) => e.resource as Appointment);

      // Build rows with patient info and services
      const rows: BookingRow[] = await Promise.all(
        appointmentResources.map(async (appointment) => {
          // Get patient reference
          const patientParticipant = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'));
          const patientRef = patientParticipant?.actor?.reference;
          let patientName = 'Unknown Patient';
          let patientId = '';

          if (patientRef?.startsWith('Patient/')) {
            patientId = patientRef.split('/')[1];
            try {
              const patient = await medplum.readResource('Patient', patientId);
              const name = patient.name?.[0];
              if (name) {
                const given = name.given?.join(' ') ?? '';
                const family = name.family ?? '';
                patientName = `${given} ${family}`.trim() || 'Unknown Patient';
              }
            } catch {
              // Patient not found, use unknown
            }
          }

          // Get services from appointment
          const services: string[] = [];
          if (appointment.serviceType) {
            for (const service of appointment.serviceType) {
              if (service.text) {
                services.push(service.text);
              }
            }
          }

          return { appointment, patientName, patientId, services };
        })
      );

      // Sort by start date (newest first for past, soonest first for upcoming)
      rows.sort((a, b) => {
        const dateA = new Date(a.appointment.start || 0).getTime();
        const dateB = new Date(b.appointment.start || 0).getTime();
        return dateB - dateA;
      });

      setBookings(rows);
    } catch (err) {
      console.error('Error loading bookings:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to load bookings',
      });
    } finally {
      setLoading(false);
    }
  }, [medplum]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBookings().catch(console.error);
  }, [loadBookings]);

  // Debounce search query
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchLoading(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update appointment status
  const updateStatus = useCallback(
    async (row: BookingRow, newStatus: string, reason?: string) => {
      try {
        setUpdatingId(row.appointment.id || null);

        const updatedAppointment: Appointment = {
          ...row.appointment,
          status: newStatus as Appointment['status'],
        };

        // Add cancellation reason extension if cancelled
        if (newStatus === 'cancelled' && reason) {
          updatedAppointment.extension = [
            ...(row.appointment.extension || []),
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/cancellation-reason',
              valueString: reason,
            },
          ];
        }

        // Add status change audit
        const statusChangeExt = {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/status-change-audit',
          extension: [
            { url: 'from', valueString: row.appointment.status || 'unknown' },
            { url: 'to', valueString: newStatus },
            { url: 'changedAt', valueDateTime: new Date().toISOString() },
            { url: 'changedBy', valueReference: { reference: `Practitioner/${medplum.getProfile()?.id}` } },
          ],
        };

        updatedAppointment.extension = [...(updatedAppointment.extension || []), statusChangeExt];

        await medplum.updateResource(updatedAppointment);

        // Send notification to providers
        if (newStatus === 'booked' || newStatus === 'cancelled') {
          try {
            // Get patient
            const patient = row.patientId ? await medplum.readResource('Patient', row.patientId) : undefined;

            // Get providers from appointment participants
            const practitionerParticipants =
              row.appointment.participant?.filter((p) => p.actor?.reference?.startsWith('Practitioner/')) || [];

            const providers: Practitioner[] = [];
            for (const pp of practitionerParticipants) {
              const pid = pp.actor?.reference?.split('/')[1];
              if (pid) {
                try {
                  const provider = await medplum.readResource('Practitioner', pid);
                  providers.push(provider);
                } catch {
                  // Skip if can't read
                }
              }
            }

            const mainProvider = providers[0];
            const assistant = providers[1];

            await createNotification(
              medplum,
              newStatus === 'booked' ? 'appointment-approved' : 'appointment-cancelled',
              {
                patient,
                appointment: updatedAppointment,
                provider: mainProvider,
                assistant,
                date: updatedAppointment.start,
                time: dayjs(updatedAppointment.start).format('h:mm A'),
                serviceType: row.services.join(', '),
              },
              medplum.getProfile() as Practitioner | undefined
            );
          } catch (notifyErr) {
            console.error('Error sending notification:', notifyErr);
          }
        }

        showNotification({
          color: 'green',
          title: 'Success',
          message: `Booking ${newStatus === 'booked' ? 'approved' : `marked as ${statusConfig[newStatus]?.label || newStatus}`}`,
        });

        // Refresh the list
        await loadBookings();
      } catch (err) {
        console.error('Error updating booking:', err);
        showNotification({
          color: 'red',
          title: 'Error',
          message: 'Failed to update booking status',
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [medplum, loadBookings]
  );

  // DEPRECATED: Old approve function - approval now requires deposit paid/waived
  // Booking stays PENDING until deposit requirement is met
  // See BookingDetailPage for deposit management workflow
  // const handleApprove = useCallback(
  //   (row: BookingRow) => {
  //     updateStatus(row, 'booked').catch(console.error);
  //   },
  //   [updateStatus]
  // );

  // Handle cancel with reason
  const handleCancel = useCallback((row: BookingRow) => {
    setCancelBooking(row);
    setCancelReason('');
    setCancelModalOpen(true);
  }, []);

  // Confirm cancellation
  const confirmCancel = useCallback(() => {
    if (cancelBooking) {
      updateStatus(cancelBooking, 'cancelled', cancelReason || undefined).catch(console.error);
      setCancelModalOpen(false);
      setCancelBooking(null);
    }
  }, [cancelBooking, cancelReason, updateStatus]);

  // Handle mark as arrived
  const handleArrived = useCallback(
    (row: BookingRow) => {
      updateStatus(row, 'arrived').catch(console.error);
    },
    [updateStatus]
  );

  // Handle mark as no-show
  const handleNoShow = useCallback(
    (row: BookingRow) => {
      updateStatus(row, 'noshow').catch(console.error);
    },
    [updateStatus]
  );

  // Helper functions (need to be defined before filteredBookings useMemo)

  // Format date from appointment
  const formatDate = (appointment: Appointment): string => {
    if (!appointment.start) {
      return 'Not scheduled';
    }
    return dayjs(appointment.start).format('MMM D, YYYY');
  };

  // Format time from appointment
  const formatTime = (appointment: Appointment): string => {
    if (!appointment.start) {
      return '';
    }
    return dayjs(appointment.start).format('h:mm A');
  };

  // Get duration
  const getDuration = (appointment: Appointment): string => {
    if (!appointment.start || !appointment.end) {
      return '-';
    }
    const start = dayjs(appointment.start);
    const end = dayjs(appointment.end);
    const minutes = end.diff(start, 'minutes');
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  // Get provider names
  const getProviders = (appointment: Appointment): string => {
    const providers = appointment.participant
      ?.filter((p) => p.actor?.reference?.startsWith('Practitioner/'))
      .map((p) => p.actor?.display || 'Provider')
      .slice(0, 2);
    return providers?.join(', ') || '-';
  };

  // Get duration in minutes (for sorting)
  const getDurationMinutes = (appointment: Appointment): number => {
    if (!appointment.start || !appointment.end) {
      return 0;
    }
    return dayjs(appointment.end).diff(dayjs(appointment.start), 'minutes');
  };

  // Filter bookings based on active tab and search query
  const filteredBookings = useMemo(() => {
    const now = dayjs();

    // First apply tab filter
    let filtered: BookingRow[];
    switch (activeTab) {
      case 'pending':
        filtered = bookings.filter((row) => row.appointment.status === 'pending');
        break;
      case 'upcoming':
        filtered = bookings.filter((row) => {
          const date = dayjs(row.appointment.start);
          const status = row.appointment.status;
          return (
            (date.isAfter(now) || date.isSame(now, 'day')) &&
            status !== 'cancelled' &&
            status !== 'fulfilled' &&
            status !== 'noshow'
          );
        });
        break;
      case 'past':
        filtered = bookings.filter((row) => {
          const date = dayjs(row.appointment.start);
          return (
            date.isBefore(now, 'day') ||
            row.appointment.status === 'fulfilled' ||
            row.appointment.status === 'cancelled' ||
            row.appointment.status === 'noshow'
          );
        });
        break;
      case 'all':
      default:
        filtered = bookings;
    }

    // Apply search filter if query exists
    if (debouncedQuery.trim()) {
      const needle = debouncedQuery.toLowerCase();
      filtered = filtered.filter((row) => {
        // Search patient name
        if (row.patientName.toLowerCase().includes(needle)) {
          return true;
        }
        // Search services
        if (row.services.some((s) => s.toLowerCase().includes(needle))) {
          return true;
        }
        // Search date
        const dateStr = formatDate(row.appointment).toLowerCase();
        if (dateStr.includes(needle)) {
          return true;
        }
        // Search providers
        const providers = getProviders(row.appointment).toLowerCase();
        if (providers.includes(needle)) {
          return true;
        }
        return false;
      });
    }

    return filtered;
    }, [bookings, activeTab, debouncedQuery]);

  // Handle view appointment
  const handleViewAppointment = (row: BookingRow): void => {
    if (row.appointment.id) {
      window.location.href = `/bookings/${row.appointment.id}`;
    }
  };

  // Handle click on patient name
  const handlePatientClick = (patientId: string): void => {
    if (patientId) {
      window.location.href = `/Patient/${patientId}`;
    }
  };

  // Get available actions for a booking
  const getAvailableActions = (
    row: BookingRow
  ): { canApprove: boolean; canArrive: boolean; canNoShow: boolean; canCancel: boolean } => {
    const status = row.appointment.status || 'pending';
    const transitions = allowedTransitions[status] || [];

    return {
      canApprove: transitions.includes('booked'),
      canArrive: transitions.includes('arrived'),
      canNoShow: transitions.includes('noshow'),
      canCancel: transitions.includes('cancelled'),
    };
  };

  return (
    <Stack gap="md" p="md">
      <Title order={3}>Bookings</Title>

      <Paper withBorder p="md">
        <Stack gap="md">
          {/* Search input */}
          <TextInput
            placeholder="Search by patient, service, provider, or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            rightSection={
              searchQuery && (
                <ActionIcon onClick={() => setSearchQuery('')} variant="transparent" color="gray">
                  <IconX size={14} />
                </ActionIcon>
              )
            }
          />

          <Tabs
            value={activeTab}
            onChange={(v) => {
              setActiveTab(v || 'all');
              setSearchQuery(''); // Clear search when switching tabs
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="all">All ({bookings.length})</Tabs.Tab>
              <Tabs.Tab value="pending">
                Pending Approval ({bookings.filter((row) => row.appointment.status === 'pending').length})
              </Tabs.Tab>
              <Tabs.Tab value="upcoming">
                Upcoming (
                {
                  bookings.filter((row) => {
                    const date = dayjs(row.appointment.start);
                    const status = row.appointment.status;
                    return (
                      (date.isAfter(dayjs()) || date.isSame(dayjs(), 'day')) &&
                      status !== 'cancelled' &&
                      status !== 'fulfilled' &&
                      status !== 'noshow'
                    );
                  }).length
                }
                )
              </Tabs.Tab>
              <Tabs.Tab value="past">
                Past (
                {
                  bookings.filter((row) => {
                    const date = dayjs(row.appointment.start);
                    return (
                      date.isBefore(dayjs(), 'day') ||
                      row.appointment.status === 'fulfilled' ||
                      row.appointment.status === 'cancelled' ||
                      row.appointment.status === 'noshow'
                    );
                  }).length
                }
                )
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="all" pt="md">
              {renderTable()}
            </Tabs.Panel>
            <Tabs.Panel value="pending" pt="md">
              {renderTable()}
            </Tabs.Panel>
            <Tabs.Panel value="upcoming" pt="md">
              {renderTable()}
            </Tabs.Panel>
            <Tabs.Panel value="past" pt="md">
              {renderTable()}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Paper>

      {/* Cancellation Modal */}
      <Modal opened={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancel Booking" size="sm">
        <Stack>
          <Text size="sm" c="dimmed">
            Please provide a reason for cancelling this booking:
          </Text>
          <Textarea
            placeholder="Cancellation reason..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.currentTarget.value)}
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setCancelModalOpen(false)}>
              Abort
            </Button>
            <Button color="red" onClick={confirmCancel}>
              Cancel Booking
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );

  function renderTable(): JSX.Element {
    if (loading) {
      return (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      );
    }

    if (searchLoading) {
      return (
        <Group justify="center" p="xl">
          <Loader size="sm" />
        </Group>
      );
    }

    if (filteredBookings.length === 0) {
      return (
        <Stack gap="xs" align="center" p="xl">
          <Text c="dimmed">
            {debouncedQuery ? `No bookings found matching "${debouncedQuery}"` : 'No bookings found'}
          </Text>
          {debouncedQuery && (
            <Text size="xs" c="dimmed">
              Try searching by patient name, service, provider, or date
            </Text>
          )}
        </Stack>
      );
    }

    return (
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Patient</Table.Th>
            <Table.Th>Services</Table.Th>
            <Table.Th>Date</Table.Th>
            <Table.Th>Time</Table.Th>
            <Table.Th>Duration</Table.Th>
            <Table.Th>Providers</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Deposit</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filteredBookings.map((row) => {
            const actions = getAvailableActions(row);
            const isUpdating = updatingId === row.appointment.id;

            return (
              <Table.Tr key={row.appointment.id}>
                <Table.Td>
                  {row.patientId ? (
                    <Text
                      component="a"
                      href={`/Patient/${row.patientId}`}
                      c="blue"
                      style={{ cursor: 'pointer', textDecoration: 'none' }}
                      onClick={(e) => {
                        e.preventDefault();
                        handlePatientClick(row.patientId);
                      }}
                    >
                      {row.patientName}
                    </Text>
                  ) : (
                    row.patientName
                  )}
                </Table.Td>
                <Table.Td>
                  <Tooltip label={row.services.join(', ')}>
                    <Text size="sm" lineClamp={1} style={{ maxWidth: 200 }}>
                      {row.services.join(', ') || 'Unknown'}
                    </Text>
                  </Tooltip>
                </Table.Td>
                <Table.Td>{formatDate(row.appointment)}</Table.Td>
                <Table.Td>{formatTime(row.appointment)}</Table.Td>
                <Table.Td>{getDuration(row.appointment)}</Table.Td>
                <Table.Td>{getProviders(row.appointment)}</Table.Td>
                <Table.Td>
                  <Badge color={statusConfig[row.appointment.status as keyof typeof statusConfig]?.color || 'gray'}>
                    {statusConfig[row.appointment.status as keyof typeof statusConfig]?.label || row.appointment.status}
                  </Badge>
          </Table.Td>
          <Table.Td>
            {(() => {
              const depositInfo = getDepositStatus(row.appointment);
              let label: string;
              if (depositInfo.status === 'paid') {
                label = `Paid: $${depositInfo.amount}`;
              } else if (depositInfo.status === 'waived') {
                label = 'Waived';
              } else if (depositInfo.status === 'requested') {
                label = `Requested: $${depositInfo.amount}`;
              } else {
                label = 'Pending';
              }
              return (
                <Badge color={getDepositStatusColor(depositInfo.status)} variant="light">
                  {label}
                </Badge>
              );
            })()}
          </Table.Td>
          <Table.Td>
            <Group gap="xs">
{/* Send Payment Link Button - only for pending bookings */}
              {/* NOTE: This does NOT approve the booking, it sends payment request to patient.
                  Booking stays PENDING until deposit is paid or waived.
                  TODO: When Stripe API integrated, this will initiate payment link creation */}
              {actions.canApprove && (
                <Tooltip label="Send deposit payment request to patient">
                  <Button
                    size="xs"
                    color="blue"
                    loading={isUpdating}
                    onClick={() => handleViewAppointment(row)}
                    leftSection={<IconCheck size={14} />}
                  >
                    Send Payment Link
                  </Button>
                </Tooltip>
              )}

                    {/* Action Menu */}
                    {(actions.canArrive || actions.canNoShow || actions.canCancel) && (
                      <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                          <ActionIcon variant="light" loading={isUpdating} disabled={isUpdating}>
                            <IconDots size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {actions.canArrive && (
                            <Menu.Item leftSection={<IconUserCheck size={14} />} onClick={() => handleArrived(row)}>
                              Mark as Arrived
                            </Menu.Item>
                          )}
                          {actions.canNoShow && (
                            <Menu.Item
                              leftSection={<IconUserX size={14} />}
                              color="orange"
                              onClick={() => handleNoShow(row)}
                            >
                              Mark as No-Show
                            </Menu.Item>
                          )}
                          {actions.canCancel && (
                            <Menu.Item
                              leftSection={<IconCalendarOff size={14} />}
                              color="red"
                              onClick={() => handleCancel(row)}
                            >
                              Cancel Booking
                            </Menu.Item>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    )}

                    {/* View Button */}
                    <Tooltip label="View booking">
                      <ActionIcon variant="subtle" onClick={() => handleViewAppointment(row)}>
                        <IconEye size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    );
  }
}
