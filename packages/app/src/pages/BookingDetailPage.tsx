/**
 * Booking Detail Page
 * Shows detailed booking information with deposit management, status actions,
 * and audit trail for appointments.
 */

import {
  Title,
  Paper,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Divider,
  Grid,
  Card,
  NumberInput,
  Textarea,
  Timeline,
  TimelineItem,
  Modal,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { useMedplum } from '@medplum/react';
import type { Appointment, Patient, Practitioner, ActivityDefinition, ServiceRequest } from '@medplum/fhirtypes';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconCheck,
  IconX,
  IconRefresh,
  IconCoin,
  IconMail,
  IconMessage,
  IconEye,
  IconEdit,
  IconTrash,
  IconUserCheck,
  IconUserX,
} from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import dayjs from 'dayjs';
import { getMedSpaRole } from '../auth/role';
import {
  getDepositStatus,
  buildDepositInfoExtensions,
  formatDepositAmount,
  getDepositStatusColor,
  canRequestDeposit,
  canMarkPaid,
  canWaiveDeposit,
  DepositStatus,
} from '../utils/payments';
import { sendDepositRequestSMS, sendPaymentConfirmationSMS } from '../utils/sms';
import { sendDepositRequestEmail, sendPaymentConfirmationEmail } from '../utils/email';

// Appointment status configuration
const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'yellow', label: 'Pending Approval' },
  booked: { color: 'blue', label: 'Booked' },
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
  cancelled: ['booked'], // Uncancel
  noshow: ['booked'], // Undo no-show
};

interface StatusChangeAudit {
  from: string;
  to: string;
  changedAt: string;
  changedBy?: string;
}

interface AuditEntry {
  timestamp: Date;
  action: string;
  details?: string;
  user?: string;
}

export function BookingDetailPage(): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const role = getMedSpaRole(medplum);

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [providers, setProviders] = useState<Practitioner[]>([]);
  const [services, setServices] = useState<ActivityDefinition[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [depositAmount, setDepositAmount] = useState<number>(250);
  const [depositInfo, setDepositInfo] = useState<{
    status: DepositStatus;
    amount: number;
    requestedAt?: Date;
    paidAt?: Date;
    waivedAt?: Date;
    waivedReason?: string;
  }>({ status: 'pending', amount: 0 });
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);

  // Modal states
  const [waiveModalOpen, setWaiveModalOpen] = useState(false);
  const [waiveReason, setWaiveReason] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [uncancelModalOpen, setUncancelModalOpen] = useState(false);
  const [uncancelReason, setUncancelReason] = useState('');
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [undoPaymentModalOpen, setUndoPaymentModalOpen] = useState(false);
  const [undoPaymentReason, setUndoPaymentReason] = useState('');

  // Load appointment data
  const loadData = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      // Load appointment
      const appt = await medplum.readResource('Appointment', id);
      setAppointment(appt);

      // Get deposit info
      const depInfo = getDepositStatus(appt);
      setDepositInfo(depInfo);
      setDepositAmount(depInfo.amount || 250);

      // Load patient
      const patientParticipant = appt.participant?.find(
        (p) => p.actor?.reference?.startsWith('Patient/')
      );
      const patientRef = patientParticipant?.actor?.reference;
      if (patientRef) {
        const patientId = patientRef.split('/')[1];
        try {
          const pat = await medplum.readResource('Patient', patientId);
          setPatient(pat);
        } catch {
          // Patient not found
        }
      }

      // Load providers
      const practitionerParticipants = appt.participant?.filter(
        (p) => p.actor?.reference?.startsWith('Practitioner/')
      ) || [];
      const loadedProviders: Practitioner[] = [];
      for (const pp of practitionerParticipants) {
        const pid = pp.actor?.reference?.split('/')[1];
        if (pid) {
          try {
            const prov = await medplum.readResource('Practitioner', pid);
            loadedProviders.push(prov);
          } catch {
            // Skip if can't read
          }
        }
      }
      setProviders(loadedProviders);

      // Load services from ServiceRequests linked to this appointment via extension
      // ServiceRequests use linked-appointment extension, not a standard search param
      const srBundle = await medplum.search('ServiceRequest', {
        _count: '100',
      });
      const allSrs = (srBundle.entry || []).map((e) => e.resource as ServiceRequest);
      // Filter to only ServiceRequests linked to this appointment
      const srs = allSrs.filter((sr) =>
        sr.extension?.some(
          (e) =>
            e.url === 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment' &&
            e.valueReference?.reference === `Appointment/${id}`
        )
      );
      setServiceRequests(srs);

      // Load ActivityDefinitions for services
      const loadedServices: ActivityDefinition[] = [];
      for (const sr of srs) {
        const code = sr.code?.coding?.[0]?.code;
        if (code) {
          try {
            const adBundle = await medplum.search('ActivityDefinition', {
              'code:exact': code,
              status: 'active',
            });
            const ad = adBundle.entry?.[0]?.resource as ActivityDefinition;
            if (ad) {
              loadedServices.push(ad);
            }
          } catch {
            // Skip if can't load
          }
        }
      }
      setServices(loadedServices);

      // Build audit trail from extensions
      const audits: AuditEntry[] = [];

      // Status changes
      const statusChanges = appt.extension?.filter(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/status-change-audit'
      ) || [];

      for (const change of statusChanges) {
        const from = change.extension?.find((e) => e.url === 'from')?.valueString;
        const to = change.extension?.find((e) => e.url === 'to')?.valueString;
        const changedAt = change.extension?.find((e) => e.url === 'changedAt')?.valueDateTime;
        const changedBy = change.extension?.find((e) => e.url === 'changedBy')?.valueReference?.display;

        if (from && to && changedAt) {
          audits.push({
            timestamp: new Date(changedAt),
            action: `Status changed: ${statusConfig[from]?.label || from} → ${statusConfig[to]?.label || to}`,
            user: changedBy,
          });
        }
      }

      // Last edited
      const lastEdited = appt.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/last-edited'
      )?.valueDateTime;
      const editedBy = appt.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/edited-by'
      )?.valueReference;

      if (lastEdited) {
        audits.push({
          timestamp: new Date(lastEdited),
          action: 'Booking edited',
          user: editedBy?.display,
        });
      }

      // Cancellation reason
      const cancelReason = appt.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/cancellation-reason'
      )?.valueString;

      if (cancelReason && appt.status === 'cancelled') {
        const cancelledAt = appt.extension?.find(
          (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/status-change-audit'
        )?.extension?.find((e) => e.url === 'changedAt' && e.valueDateTime)?.valueDateTime;
        audits.push({
          timestamp: new Date(cancelledAt || appt.end || Date.now()),
          action: 'Booking cancelled',
          details: cancelReason,
        });
      }

      // Deposit history
      const depositInfoExt = appt.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
      );
      if (depositInfoExt) {
        const depositStatus = depositInfoExt.extension?.find((e) => e.url === 'status')?.valueString;
        const storedDepositAmount = depositInfoExt.extension?.find((e) => e.url === 'amount')?.valueInteger ?? 0;
        const requestedAt = depositInfoExt.extension?.find((e) => e.url === 'requestedAt')?.valueDateTime;
        const paidAt = depositInfoExt.extension?.find((e) => e.url === 'paidAt')?.valueDateTime;
        const paidBy = depositInfoExt.extension?.find((e) => e.url === 'paidBy')?.valueReference;
        const paymentType = depositInfoExt.extension?.find((e) => e.url === 'paymentType')?.valueString;
        const paymentNotes = depositInfoExt.extension?.find((e) => e.url === 'paymentNotes')?.valueString;
        const waivedAt = depositInfoExt.extension?.find((e) => e.url === 'waivedAt')?.valueDateTime;
        const waivedBy = depositInfoExt.extension?.find((e) => e.url === 'waivedBy')?.valueReference;
        const waivedReason = depositInfoExt.extension?.find((e) => e.url === 'waivedReason')?.valueString;

        if (requestedAt && depositStatus === 'requested') {
          audits.push({
            timestamp: new Date(requestedAt),
            action: 'Deposit requested',
            details: `Amount: $${storedDepositAmount}`,
          });
        }

        if (paidAt && depositStatus === 'paid') {
          const paymentDetails = [`Amount: $${storedDepositAmount}`];
          if (paymentType) paymentDetails.push(`Type: ${paymentType}`);
          if (paymentNotes) paymentDetails.push(`Notes: ${paymentNotes}`);
          audits.push({
            timestamp: new Date(paidAt),
            action: 'Deposit paid',
            details: paymentDetails.join(' • '),
            user: paidBy?.display,
          });
        }

        if (waivedAt && depositStatus === 'waived') {
          const waivedDetails = [`Amount: $${storedDepositAmount}`];
          if (waivedReason) waivedDetails.push(`Reason: ${waivedReason}`);
          audits.push({
            timestamp: new Date(waivedAt),
            action: 'Deposit waived',
            details: waivedDetails.join(' • '),
            user: waivedBy?.display,
          });
        }
      }

      // Uncancel reason (if present)
      const uncancelReason = appt.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/uncancel-reason'
      )?.valueString;
      if (uncancelReason && appt.status === 'booked') {
        const uncancelledAt = appt.extension?.find(
          (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/status-change-audit'
        )?.extension?.find((e) => e.url === 'changedAt' && e.valueDateTime && e.valueDateTime > (appt.meta?.lastUpdated || ''))?.valueDateTime;
        audits.push({
          timestamp: new Date(uncancelledAt || Date.now()),
          action: 'Booking uncancelled',
          details: uncancelReason,
        });
      }

      // Sort by timestamp (newest first)
      audits.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setAuditTrail(audits);
    } catch (err) {
      console.error('Error loading booking:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to load booking details',
      });
    } finally {
      setLoading(false);
    }
  }, [medplum, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update appointment status
  const updateStatus = useCallback(
    async (newStatus: string, reason?: string) => {
      if (!appointment) return;

      try {
        const updatedAppointment: Appointment = {
          ...appointment,
          status: newStatus as Appointment['status'],
        };

        // Add cancellation reason if cancelled
        if (newStatus === 'cancelled' && reason) {
          updatedAppointment.extension = [
            ...(appointment.extension || []),
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/cancellation-reason',
              valueString: reason,
            },
          ];
        }

        // Add uncancel reason if uncancelling
        if (newStatus === 'booked' && appointment.status === 'cancelled' && reason) {
          updatedAppointment.extension = [
            ...(appointment.extension || []),
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/uncancel-reason',
              valueString: reason,
            },
          ];
        }

// Get current user's name for audit trail
      const currentUser = medplum.getProfile();
      const userName = currentUser?.name?.[0]
        ? `${currentUser.name[0].given?.[0] || ''} ${currentUser.name[0].family || ''}`.trim()
        : 'Unknown';

      // Add status change audit
      const statusChangeExt = {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/status-change-audit',
        extension: [
          { url: 'from', valueString: appointment.status || 'unknown' },
          { url: 'to', valueString: newStatus },
          { url: 'changedAt', valueDateTime: new Date().toISOString() },
          {
            url: 'changedBy',
            valueReference: {
              reference: `Practitioner/${currentUser?.id}`,
              display: userName,
            },
          },
        ],
      };

        updatedAppointment.extension = [
          ...(updatedAppointment.extension || []),
          statusChangeExt,
        ];

await medplum.updateResource(updatedAppointment);
      setAppointment(updatedAppointment);

      // Close modals if status was changed from/to cancelled/noshow
      setCancelModalOpen(false);
      setUncancelModalOpen(false);

      showNotification({
        color: 'green',
        title: 'Success',
        message: `Booking ${newStatus === 'booked' ? 'approved' : `marked as ${statusConfig[newStatus]?.label || newStatus}`}`,
      });

      await loadData();
      } catch (err) {
        console.error('Error updating status:', err);
        showNotification({
          color: 'red',
          title: 'Error',
          message: 'Failed to update booking status',
        });
      }
    },
    [appointment, medplum, loadData]
  );

  // Update deposit amount
  const updateDepositAmount = useCallback(async () => {
    if (!appointment) return;

    try {
      const newDepositInfo = {
        ...depositInfo,
        amount: depositAmount,
      };

      const depositExt = buildDepositInfoExtensions(newDepositInfo);

      // Remove existing deposit extension if any
      const existingExts = appointment.extension?.filter(
        (e) => e.url !== 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
      ) || [];

      const updatedAppointment: Appointment = {
        ...appointment,
        extension: [...existingExts, depositExt],
      };

      await medplum.updateResource(updatedAppointment);
      setAppointment(updatedAppointment);
      setDepositInfo(newDepositInfo);

      showNotification({
        color: 'green',
        title: 'Success',
        message: 'Deposit amount updated',
      });
    } catch (err) {
      console.error('Error updating deposit:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to update deposit amount',
      });
    }
  }, [appointment, depositAmount, depositInfo, medplum]);

  // Send payment link (SMS + Email)
  const sendPaymentLink = useCallback(async () => {
    if (!appointment || !patient) return;

    try {
      // Update deposit status to requested
      const newDepositInfo = {
        ...depositInfo,
        status: 'requested' as DepositStatus,
        amount: depositAmount,
        requestedAt: new Date(),
      };

      const depositExt = buildDepositInfoExtensions(newDepositInfo);

      const existingExts = appointment.extension?.filter(
        (e) => e.url !== 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
      ) || [];

      const updatedAppointment: Appointment = {
        ...appointment,
        extension: [...existingExts, depositExt],
      };

      await medplum.updateResource(updatedAppointment);
      setAppointment(updatedAppointment);
      setDepositInfo(newDepositInfo);

      // Generate payment link (placeholder - will be Stripe URL)
      const paymentLink = `https://pay.studioassistant.io/d/${appointment.id}`;

      // Send SMS
      if (patient.telecom?.find((t) => t.system === 'phone')) {
        await sendDepositRequestSMS(patient, appointment, services, depositAmount, paymentLink);
      }

      // Send Email
      if (patient.telecom?.find((t) => t.system === 'email')) {
        await sendDepositRequestEmail(patient, appointment, services, depositAmount, paymentLink);
      }

      showNotification({
        color: 'green',
        title: 'Success',
        message: 'Payment link sent via SMS and email',
      });
    } catch (err) {
      console.error('Error sending payment link:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to send payment link',
      });
    }
  }, [appointment, patient, depositAmount, depositInfo, services, medplum]);

  // Mark deposit as paid
  const markAsPaid = useCallback(async () => {
    if (!appointment) return;

    try {
      // Get current user info
      const currentUser = medplum.getProfile();
      const userName = currentUser?.name?.[0]
        ? `${currentUser.name[0].given?.[0] || ''} ${currentUser.name[0].family || ''}`.trim()
        : 'Unknown';

      const newDepositInfo = {
        ...depositInfo,
        status: 'paid' as DepositStatus,
        paidAt: new Date(),
        paidBy: {
          reference: `Practitioner/${currentUser?.id}`,
          display: userName,
        },
        paymentType: 'manual' as const,
        paymentNotes: paymentNotes || undefined,
      };

      const depositExt = buildDepositInfoExtensions(newDepositInfo);

      const existingExts = appointment.extension?.filter(
        (e) => e.url !== 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
      ) || [];

      const updatedAppointment: Appointment = {
        ...appointment,
        extension: [...existingExts, depositExt],
      };

      await medplum.updateResource(updatedAppointment);
      setAppointment(updatedAppointment);
      setDepositInfo(newDepositInfo);

      // Send confirmation
      if (patient) {
        await sendPaymentConfirmationSMS(patient, updatedAppointment, services, depositAmount);
        await sendPaymentConfirmationEmail(patient, updatedAppointment, services, depositAmount);
      }

      showNotification({
        color: 'green',
        title: 'Success',
        message: 'Deposit marked as paid',
      });

      setMarkPaidModalOpen(false);
      setPaymentNotes('');

      // Refresh data to update activity history
      await loadData();
    } catch (err) {
      console.error('Error marking paid:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to mark deposit as paid',
      });
    }
  }, [appointment, depositInfo, services, depositAmount, patient, medplum, loadData]);

  // Waive deposit
  const waiveDeposit = useCallback(async () => {
    if (!appointment) return;

    try {
      // Get current user info
      const currentUser = medplum.getProfile();
      const userName = currentUser?.name?.[0]
        ? `${currentUser.name[0].given?.[0] || ''} ${currentUser.name[0].family || ''}`.trim()
        : 'Unknown';

      const newDepositInfo = {
        ...depositInfo,
        status: 'waived' as DepositStatus,
        waivedAt: new Date(),
        waivedReason: waiveReason,
        waivedBy: {
          reference: `Practitioner/${currentUser?.id}`,
          display: userName,
        },
      };

      const depositExt = buildDepositInfoExtensions(newDepositInfo);

      const existingExts = appointment.extension?.filter(
        (e) => e.url !== 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
      ) || [];

      const updatedAppointment: Appointment = {
        ...appointment,
        extension: [...existingExts, depositExt],
      };

      await medplum.updateResource(updatedAppointment);
      setAppointment(updatedAppointment);
      setDepositInfo(newDepositInfo);

      showNotification({
        color: 'green',
        title: 'Success',
        message: 'Deposit waived',
      });

      setWaiveModalOpen(false);
      setWaiveReason('');

      // Refresh data to update activity history
      await loadData();
    } catch (err) {
      console.error('Error waiving deposit:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to waive deposit',
      });
    }
  }, [appointment, depositInfo, waiveReason, medplum, loadData]);

  // Get available actions
  const getAvailableActions = () => {
    if (!appointment) return { canApprove: false, canArrive: false, canNoShow: false, canCancel: false, canUncancel: false, canUndoNoShow: false };

    const status = appointment.status || 'pending';
    const transitions = allowedTransitions[status] || [];

    // Only show approve for pending status
    const canApprove = status === 'pending' && transitions.includes('booked');

    return {
      canApprove,
      canArrive: transitions.includes('arrived'),
      canNoShow: transitions.includes('noshow'),
      canCancel: transitions.includes('cancelled'),
      canUncancel: status === 'cancelled',
      canUndoNoShow: status === 'noshow',
    };
  };

  const actions = getAvailableActions();

  // Format helpers
  const formatDate = (date: string | undefined) => {
    if (!date) return 'Not scheduled';
    return dayjs(date).format('MMMM D, YYYY');
  };

  const formatTime = (date: string | undefined) => {
    if (!date) return '';
    return dayjs(date).format('h:mm A');
  };

  const getDuration = (appt: Appointment) => {
    if (!appt.start || !appt.end) return '-';
    const minutes = dayjs(appt.end).diff(dayjs(appt.start), 'minutes');
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  const getRoom = (appt: Appointment) => {
    const roomExt = appt.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/room'
    )?.valueString;
    return roomExt === 'room-1' ? 'Room 1' : roomExt === 'room-2' ? 'Room 2' : '-';
  };

  if (loading) {
    return (
      <Stack p="md">
        <Text>Loading...</Text>
      </Stack>
    );
  }

  if (!appointment) {
    return (
      <Stack p="md">
        <Text>Booking not found</Text>
        <Button onClick={() => navigate('/bookings')}>Back to Bookings</Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md" p="md">
      {/* Header */}
      <Group justify="space-between">
        <Group>
          <ActionIcon variant="light" onClick={() => navigate('/bookings')}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Title order={3}>Booking Details</Title>
            <Text size="sm" c="dimmed">
              {formatDate(appointment.start)} • {formatTime(appointment.start)}
            </Text>
          </div>
        </Group>
        <Group>
          <Badge
            size="lg"
            color={statusConfig[appointment.status as keyof typeof statusConfig]?.color || 'gray'}
          >
            {statusConfig[appointment.status as keyof typeof statusConfig]?.label || appointment.status}
          </Badge>
          {actions.canApprove && (
            <Button color="green" onClick={() => updateStatus('booked')} leftSection={<IconCheck size={16} />}>
              Approve
            </Button>
          )}
          {actions.canCancel && (
            <Button color="red" variant="light" onClick={() => setCancelModalOpen(true)} leftSection={<IconX size={16} />}>
              Cancel
            </Button>
          )}
        </Group>
      </Group>

      <Grid>
        {/* Left Column - Booking Info */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            {/* Patient Info */}
            <Card withBorder>
              <Title order={5} mb="md">
                Patient Information
              </Title>
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">
                    Name
                  </Text>
                  <Text fw={500}>
                    {patient ? (
                      <a href={`/Patient/${patient.id}`} style={{ textDecoration: 'none' }}>
                        {patient.name?.[0]?.given?.join(' ')} {patient.name?.[0]?.family}
                      </a>
                    ) : (
                      'Unknown Patient'
                    )}
                  </Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">
                    Phone
                  </Text>
                  <Text>
                    {patient?.telecom?.find((t) => t.system === 'phone')?.value || '-'}
                  </Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">
                    Email
                  </Text>
                  <Text>
                    {patient?.telecom?.find((t) => t.system === 'email')?.value || '-'}
                  </Text>
                </Grid.Col>
              </Grid>
            </Card>

            {/* Appointment Details */}
            <Card withBorder>
              <Title order={5} mb="md">
                Appointment Details
              </Title>
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">
                    Services
                  </Text>
                  <Text>{services.map((s) => s.title).join(', ') || 'Unknown'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">
                    Duration
                  </Text>
                  <Text>{getDuration(appointment)}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">
                    Room
                  </Text>
                  <Text>{getRoom(appointment)}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">
                    Providers
                  </Text>
                  <Text>
                    {providers.map((p) => `${p.name?.[0]?.given?.[0]} ${p.name?.[0]?.family}`).join(', ') || '-'}
                  </Text>
                </Grid.Col>
              </Grid>
            </Card>

            {/* Status Actions */}
            <Card withBorder>
              <Title order={5} mb="md">
                Status Actions
              </Title>
              <Group>
                {actions.canArrive && (
                  <Button color="teal" onClick={() => updateStatus('arrived')} leftSection={<IconUserCheck size={16} />}>
                    Mark as Arrived
                  </Button>
                )}
                {actions.canNoShow && (
                  <Button color="gray" onClick={() => updateStatus('noshow')} leftSection={<IconUserX size={16} />}>
                    Mark as No-Show
                  </Button>
                )}
{actions.canUncancel && (
              <Button color="blue" variant="light" onClick={() => setUncancelModalOpen(true)} leftSection={<IconRefresh size={16} />}>
                Uncancel
              </Button>
            )}
            {actions.canUndoNoShow && (
              <Button color="blue" variant="light" onClick={() => updateStatus('booked')} leftSection={<IconRefresh size={16} />}>
                Undo No-Show
              </Button>
            )}
          </Group>
        </Card>

            {/* Audit Trail */}
            <Card withBorder>
              <Title order={5} mb="md">
                Activity History
              </Title>
              {auditTrail.length === 0 ? (
                <Text c="dimmed" size="sm">
                  No activity recorded
                </Text>
              ) : (
                <Timeline active={-1} bulletSize={24} lineWidth={2}>
                  {auditTrail.map((entry, index) => (
                    <Timeline.Item key={index} bullet={<IconEye size={12} />} title={entry.action}>
                      <Text size="xs" c="dimmed">
                        {dayjs(entry.timestamp).format('MMM D, YYYY h:mm A')}
                      </Text>
                      {entry.user && (
                        <Text size="xs" c="dimmed">
                          by {entry.user}
                        </Text>
                      )}
                      {entry.details && (
                        <Text size="sm" mt="xs">
                          {entry.details}
                        </Text>
                      )}
                    </Timeline.Item>
                  ))}
                </Timeline>
              )}
            </Card>
          </Stack>
        </Grid.Col>

        {/* Right Column - Deposit Management */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder>
            <Title order={5} mb="md">
              Deposit Management
            </Title>

            <Stack gap="md">
              {/* Deposit Status */}
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Status
                </Text>
                <Badge color={getDepositStatusColor(depositInfo.status)}>
                  {depositInfo.status.charAt(0).toUpperCase() + depositInfo.status.slice(1)}
                </Badge>
              </Group>

              {/* Deposit Amount */}
              <Group justify="space-between" align="flex-end">
                <NumberInput
                  label="Amount"
                  value={depositAmount}
                  onChange={(val) => setDepositAmount(Number(val) || 0)}
                  min={0}
                  step={25}
                  prefix="$"
                  disabled={depositInfo.status === 'paid' || depositInfo.status === 'waived'}
                  style={{ flex: 1 }}
                />
                {depositInfo.status !== 'paid' && depositInfo.status !== 'waived' && (
                  <Button size="sm" variant="light" onClick={updateDepositAmount}>
                    Save
                  </Button>
                )}
              </Group>

              <Divider />

              {/* Deposit Actions */}
              {canRequestDeposit(depositInfo.status) && (
                <Button
                  onClick={sendPaymentLink}
                  leftSection={<IconMessage size={16} />}
                  disabled={!patient?.telecom?.find((t) => t.system === 'phone')}
                >
                  Send Payment Link
                </Button>
              )}

              {canMarkPaid(depositInfo.status) && (
                <Button
                  color="green"
                  variant="light"
                  onClick={() => setMarkPaidModalOpen(true)}
                  leftSection={<IconCoin size={16} />}
                >
                  Mark as Paid
                </Button>
              )}

              {canWaiveDeposit(depositInfo.status) && (
                <Button
                  color="blue"
                  variant="light"
                  onClick={() => setWaiveModalOpen(true)}
                  leftSection={<IconX size={16} />}
                >
                  Waive Deposit
                </Button>
              )}

              {/* Payment History */}
              {(depositInfo.requestedAt || depositInfo.paidAt || depositInfo.waivedAt) && (
                <>
                  <Divider />
                  <Text size="sm" fw={500}>
                    Payment History
                  </Text>
                  {depositInfo.requestedAt && (
                    <Text size="xs" c="dimmed">
                      {dayjs(depositInfo.requestedAt).format('MMM D, YYYY h:mm A')} - Payment link requested
                    </Text>
                  )}
                  {depositInfo.paidAt && (
                    <Text size="xs" c="dimmed">
                      {dayjs(depositInfo.paidAt).format('MMM D, YYYY h:mm A')} - Payment received
                    </Text>
                  )}
                  {depositInfo.waivedAt && (
                    <Text size="xs" c="dimmed">
                      {dayjs(depositInfo.waivedAt).format('MMM D, YYYY h:mm A')} - Deposit waived
                      {depositInfo.waivedReason && ` (${depositInfo.waivedReason})`}
                    </Text>
                  )}
                </>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Waive Deposit Modal */}
      <Modal opened={waiveModalOpen} onClose={() => setWaiveModalOpen(false)} title="Waive Deposit">
        <Stack>
          <Text size="sm">Please provide a reason for waiving the deposit:</Text>
          <Textarea
            value={waiveReason}
            onChange={(e) => setWaiveReason(e.currentTarget.value)}
            placeholder="Reason for waiver..."
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setWaiveModalOpen(false)}>
              Cancel
            </Button>
            <Button color="blue" onClick={waiveDeposit} disabled={!waiveReason.trim()}>
              Waive Deposit
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Cancel Modal */}
      <Modal opened={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancel Booking">
        <Stack>
          <Text size="sm">Please provide a reason for cancelling this booking:</Text>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.currentTarget.value)}
            placeholder="Cancellation reason..."
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setCancelModalOpen(false)}>
              Abort
            </Button>
            <Button color="red" onClick={() => updateStatus('cancelled', cancelReason)}>
              Cancel Booking
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Uncancel Modal */}
      <Modal opened={uncancelModalOpen} onClose={() => setUncancelModalOpen(false)} title="Uncancel Booking">
        <Stack>
          <Text size="sm">Please provide a reason for uncancelling this booking:</Text>
          <Textarea
            value={uncancelReason}
            onChange={(e) => setUncancelReason(e.currentTarget.value)}
            placeholder="Uncancellation reason..."
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setUncancelModalOpen(false)}>
              Abort
            </Button>
            <Button color="blue" onClick={() => updateStatus('booked', uncancelReason)} disabled={!uncancelReason.trim()}>
              Uncancel Booking
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Mark Paid Modal */}
      <Modal opened={markPaidModalOpen} onClose={() => setMarkPaidModalOpen(false)} title="Mark Deposit as Paid">
        <Stack>
          <Text size="sm">Enter payment details:</Text>
          <Text size="sm" fw={500}>
            Amount: {formatDepositAmount(depositAmount)}
          </Text>
          <Textarea
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.currentTarget.value)}
            placeholder="Payment notes (e.g., cash, check number)..."
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setMarkPaidModalOpen(false)}>
              Cancel
            </Button>
            <Button color="green" onClick={markAsPaid}>
              Confirm Payment
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
