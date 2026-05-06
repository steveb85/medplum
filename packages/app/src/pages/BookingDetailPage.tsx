// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Modal,
  NumberInput,
  Stack,
  Text,
  Textarea,
  Timeline,
  Title,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { ActivityDefinition, Appointment, Patient, Practitioner, ServiceRequest } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import {
  IconArrowLeft,
  IconCoin,
  IconEdit,
  IconEye,
  IconMessage,
  IconRefresh,
  IconUserCheck,
  IconUserX,
  IconX,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMedSpaRole } from '../auth/role';
import {
  getDepositStatusFromAuditEvents,
  recordDepositAmountChanged,
  recordDepositPaid,
  recordDepositRequested,
  recordDepositWaived,
  recordPaymentUndone,
  recordRefundIssued,
  recordBookingStatusChange,
} from '../utils/audit-events';
import { sendDepositRequestEmail, sendPaymentConfirmationEmail } from '../utils/email';
import type { DepositStatus } from '../utils/payments';
import { formatDepositAmount, getDepositStatusColor } from '../utils/payments';
import { sendDepositRequestSMS, sendPaymentConfirmationSMS } from '../utils/sms';
import { CreateAppointmentModalV3 } from '../components/CreateAppointmentModalV3';
import { ServiceCard } from '../components/ServiceCard';
import type { ServiceStatus, ServiceCardData } from '../components/ServiceCard';

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

// WORKFLOW: Pending → Booked (via deposit paid/waived) → Arrived → Fulfilled
// - All bookings start as PENDING (regardless of who creates them)
// - Provider "sends payment link" → deposit: requested, booking: still PENDING
// - Patient pays OR provider marks as paid → deposit: paid, booking: BOOKED
// - Deposit waived → deposit: waived, booking: BOOKED
// - Provider creates booking → still goes to PENDING (deposit requirement enforced)
const allowedTransitions: Record<string, string[]> = {
  pending: ['booked', 'cancelled'], // Booked = deposit paid/waived
  booked: ['arrived', 'cancelled', 'noshow'],
  arrived: ['fulfilled', 'cancelled', 'noshow'],
  fulfilled: [],
  cancelled: ['booked', 'pending'], // Uncancel - restores to pre-cancellation status
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

export function BookingDetailPage(): ReactElement {
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
    paidBy?: { reference: string; display?: string };
    actualPaidAmount?: number;
    paymentType?: 'online' | 'manual';
    paymentNotes?: string;
    isUndone?: boolean;
    undoneAt?: Date;
    undoneBy?: { reference: string; display?: string };
    undoneReason?: string;
    paymentLinkSentAt?: Date;
  }>({ status: 'pending', amount: 0 });
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);

  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [waiveModalOpen, setWaiveModalOpen] = useState(false);
  const [waiveReason, setWaiveReason] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [uncancelModalOpen, setUncancelModalOpen] = useState(false);
  const [uncancelReason, setUncancelReason] = useState('');
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [manualPaymentAmount, setManualPaymentAmount] = useState<number>(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [undoPaymentModalOpen, setUndoPaymentModalOpen] = useState(false);
  const [undoPaymentReason, setUndoPaymentReason] = useState('');
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState('');

  // Convert serviceRequests to ServiceCardData format
  const serviceCardData: ServiceCardData[] = useMemo(() => {
    return serviceRequests.map((sr) => {
      const service = services.find(
        (s) => s.code?.coding?.[0]?.code === sr.code?.coding?.[0]?.code
      );

      // Determine status from extensions or defaults
      const statusExt = sr.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/serviceStatus'
      );
      // Map status to ServiceStatus type (handles type conversion)
      const rawStatus = statusExt?.valueString || 'pending';
      const status: ServiceStatus = (['pending', 'in-progress', 'completed', 'cancelled'] as const).includes(rawStatus as any)
        ? rawStatus as ServiceStatus
        : 'pending';

      return {
        serviceRequest: sr,
        service: service as ActivityDefinition,
        photos: [], // TODO: Load photos linked to this ServiceRequest
        status,
      };
    });
  }, [serviceRequests, services]);

  // Handler functions for ServiceCards (placeholder implementations)
  const handleStartService = useCallback((serviceRequestId: string) => {
    console.log('Start service:', serviceRequestId);
    showNotification({ color: 'blue', title: 'Info', message: 'Start service functionality coming soon' });
  }, []);

  const handleCompleteService = useCallback((serviceRequestId: string) => {
    console.log('Complete service:', serviceRequestId);
    showNotification({ color: 'green', title: 'Info', message: 'Complete service functionality coming soon' });
  }, []);

  const handleUpdateTreatmentData = useCallback((serviceRequestId: string, data: Record<string, unknown>) => {
    console.log('Update treatment data:', serviceRequestId, data);
  }, []);

  const handleUploadPhotos = useCallback((serviceRequestId: string) => {
    console.log('Upload photos:', serviceRequestId);
    showNotification({ color: 'blue', title: 'Info', message: 'Photo upload functionality coming soon' });
  }, []);

  const handleDeletePhoto = useCallback((serviceRequestId: string, photoId: string) => {
    console.log('Delete photo:', serviceRequestId, photoId);
  }, []);

  const handleUpdatePhotoMetadata = useCallback((serviceRequestId: string, photoId: string, metadata: unknown) => {
    console.log('Update photo metadata:', serviceRequestId, photoId, metadata);
  }, []);

  // Load appointment data
  const loadData = useCallback(async () => {
    if (!id) {
      return;
    }

    try {
      setLoading(true);

      // Load appointment
      const appt = await medplum.readResource('Appointment', id);
      setAppointment(appt);

      // Load patient
      const patientParticipant = appt.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'));
      const patientRef = patientParticipant?.actor?.reference;
      let patientId = '';
      if (patientRef) {
        patientId = patientRef.split('/')[1];
        try {
          const pat = await medplum.readResource('Patient', patientId);
          setPatient(pat);
        } catch {
          // Patient not found
        }
      }

      // Get deposit info from FHIR AuditEvents (single source of truth)
      const depInfo = await getDepositStatusFromAuditEvents(medplum, patientId);
      setDepositInfo(depInfo);
      setDepositAmount(depInfo.amount || 250);

      // Load providers
      const practitionerParticipants =
        appt.participant?.filter((p) => p.actor?.reference?.startsWith('Practitioner/')) || [];
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

      // Build audit trail from FHIR AuditEvents
      const audits: AuditEntry[] = [];

      try {
         // Query AuditEvents for this patient
        // Use just the patient ID (Medplum handles reference search correctly)
        const auditBundle = await medplum.search('AuditEvent', {
          patient: patientId,  // patientId is just the ID part
          _count: '500',
        });

        const auditEvents = (auditBundle.entry || []).map((e) => e.resource as any).sort((a: any, b: any) => {
          return new Date(b.recorded || 0).getTime() - new Date(a.recorded || 0).getTime();
        });

        // Filter to ALL booking-related events (broader match)
        const relevantEvents = auditEvents.filter((event: any) => {
          const desc = (event.description || '').toLowerCase();
          return (
            desc.includes('deposit') ||
            desc.includes('payment') ||
            desc.includes('refund') ||
            desc.includes('booking') ||  // Catches "booking status changed", "booking cancelled", etc.
            desc.includes('treatment')
          );
        });

        for (const event of relevantEvents) {
          const desc = event.description || '';
          const timestamp = new Date(event.recorded || Date.now());

          // Extract user from agent
          const agent = event.agent?.[0];
          const user =
            agent?.who?.display || agent?.name?.[0]
              ? `${agent.name[0].given?.[0] || ''} ${agent.name[0].family || ''}`.trim()
              : 'System';

          // Parse entity details
          const details: Record<string, string> = {};
          event.entity?.forEach((entity: any) => {
            entity.detail?.forEach((d: any) => {
              if (d.type && d.valueString) {
                details[d.type] = d.valueString;
              }
            });
          });

          // Map to AuditEntry based on description
          if (desc.includes('deposit paid')) {
            const amount = details.amount || '0';
            const paymentType = details.paymentType || 'manual';
            const notes = details.notes;
            audits.push({
              timestamp,
              action: 'Deposit paid',
              details: `Amount: $${amount} • Type: ${paymentType}${notes ? ' • Notes: ' + notes : ''}`,
              user,
            });
          } else if (desc.includes('deposit requested')) {
            const amount = details.amount || '0';
            const method = details.method || 'sms';
            audits.push({
              timestamp,
              action: 'Payment link sent',
              details: `Amount: $${amount} • Via: ${method}`,
              user,
            });
          } else if (desc.includes('deposit waived')) {
            const amount = details.amount || '0';
            const waivedReason = details.waivedReason;
            audits.push({
              timestamp,
              action: 'Deposit waived',
              details: `Amount: $${amount}${waivedReason ? ' • Reason: ' + waivedReason : ''}`,
              user,
            });
          } else if (desc.includes('payment undone')) {
            const amount = details.amount || '0';
            const reason = details.reason;
            audits.push({
              timestamp,
              action: 'Payment undone',
              details: `Amount: $${amount}${reason ? ' • Reason: ' + reason : ''}`,
              user,
            });
          } else if (desc.includes('refund')) {
            const amount = details.amount || '0';
            const reason = details.reason;
            audits.push({
              timestamp,
              action: 'Refund issued',
              details: `Amount: $${amount}${reason ? ' • Reason: ' + reason : ''}`,
              user,
            });
          } else if (desc.includes('deposit amount changed')) {
            const previousAmount = details.previousAmount || '0';
            const newAmount = details.newAmount || '0';
            audits.push({
              timestamp,
              action: 'Deposit amount changed',
              details: `From $${previousAmount} to $${newAmount}`,
              user,
            });
          } else if (desc.includes('booking status changed')) {
            const previousStatus = details.previousStatus || 'unknown';
            const newStatus = details.newStatus || 'unknown';
            const reason = details.reason;
            audits.push({
              timestamp,
              action: `Status changed: ${statusConfig[previousStatus]?.label || previousStatus} → ${statusConfig[newStatus]?.label || newStatus}`,
              details: reason,
              user,
            });
          } else if (desc.includes('treatment service')) {
            audits.push({
              timestamp,
              action: desc,
              user,
            });
          }
        }

        // Also check for status-change-audit extensions as fallback (legacy data)
        const statusChanges =
          appt.extension?.filter(
            (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/status-change-audit'
          ) || [];

        for (const change of statusChanges) {
          const from = change.extension?.find((e) => e.url === 'from')?.valueString;
          const to = change.extension?.find((e) => e.url === 'to')?.valueString;
          const changedAt = change.extension?.find((e) => e.url === 'changedAt')?.valueDateTime;
          const changedBy = change.extension?.find((e) => e.url === 'changedBy')?.valueReference?.display;

          if (from && to && changedAt) {
            // Check if we already have this event from AuditEvents
            const exists = audits.some(
              (a) => a.timestamp.getTime() === new Date(changedAt).getTime() && a.action.includes('Status changed')
            );
            if (!exists) {
              audits.push({
                timestamp: new Date(changedAt),
                action: `Status changed: ${statusConfig[from]?.label || from} → ${statusConfig[to]?.label || to}`,
                user: changedBy,
              });
            }
          }
        }
      } catch (err) {
        console.error('Error loading audit trail:', err);
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
    const load = async (): Promise<void> => {
      await loadData();
    };
    load().catch(() => {});
  }, [loadData]);

  // Update appointment status
  const updateStatus = useCallback(
    async (newStatus: string, reason?: string) => {
      if (!appointment) {
        return;
      }

      try {
        const updatedAppointment: Appointment = {
          ...appointment,
          status: newStatus as Appointment['status'],
        };

        // Add cancellation reason if cancelled
        // Also track what status we had BEFORE cancellation, so we can restore it on uncancel
        // TODO: When Stripe API is integrated, add logic here to cancel payment intent
        // if booking is cancelled while deposit is in 'requested' state
        // Example:
        // if (newStatus === 'cancelled' && depositInfo.status === 'requested' && depositInfo.paymentIntentId) {
        //   await stripe.paymentIntents.cancel(depositInfo.paymentIntentId);
        // }
        if (newStatus === 'cancelled' && reason) {
          updatedAppointment.extension = [
            ...(appointment.extension || []),
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/cancellation-reason',
              valueString: reason,
            },
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/pre-cancellation-status',
              valueString: appointment.status || 'pending', // Store what we were before cancellation
            },
          ];
        }

        // Add uncancel reason if uncancelling
        // NOTE: Uncancel should restore to the previous state BEFORE cancellation
        // If cancelled while PENDING (deposit not paid) → restore to PENDING
        // If cancelled while BOOKED (deposit paid) → restore to BOOKED
        // We determine this by checking if deposit was paid before cancellation
        if (newStatus === 'booked' && appointment.status === 'cancelled' && reason) {
          updatedAppointment.extension = [
            ...(appointment.extension || []),
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/uncancel-reason',
              valueString: reason,
            },
          ];
        }

        // Get current user for audit trail
        const currentUser = medplum.getProfile();
        const currentUserPractitioner = {
          resourceType: 'Practitioner' as const,
          id: currentUser?.id || '',
          name: currentUser?.name,
        };

        // Record status change via AuditEvent (FHIR-compliant, auditable)
        if (patient && serviceRequests.length > 0) {
          await recordBookingStatusChange(
            medplum,
            patient,
            serviceRequests[0],
            appointment.status || 'unknown',
            newStatus,
            currentUserPractitioner,
            reason
          );
        }

        await medplum.updateResource(updatedAppointment);
        setAppointment(updatedAppointment);

        showNotification({
          color: 'green',
          title: 'Success',
          message: `Booking ${newStatus === 'booked' ? 'confirmed (deposit paid)' : `marked as ${statusConfig[newStatus]?.label || newStatus}`}`,
        });

        // Refresh data to update activity history
        await loadData();
      } catch (err) {
        console.error('Error updating deposit:', err);
        showNotification({
          color: 'red',
          title: 'Error',
          message: 'Failed to update deposit amount',
        });
      }
    },
    [appointment, medplum, loadData, patient, serviceRequests]
  );

  // Update deposit amount
  const updateDepositAmount = useCallback(async () => {
    if (!appointment || !patient) {
      return;
    }

    try {
      const currentUser = medplum.getProfile();
      const userName = currentUser?.name?.[0]
        ? `${currentUser.name[0].given?.[0] || ''} ${currentUser.name[0].family || ''}`.trim()
        : 'Unknown';

      const currentUserPractitioner = {
        resourceType: 'Practitioner' as const,
        id: currentUser?.id || '',
        name: currentUser?.name,
      };

      // Record amount change via AuditEvent
      await recordDepositAmountChanged(
        medplum,
        patient,
        serviceRequests[0],
        depositInfo.amount || depositAmount,
        depositAmount,
        currentUserPractitioner
      );

      showNotification({
        color: 'green',
        title: 'Success',
        message: 'Deposit amount updated',
      });

      await loadData();
    } catch (err) {
      console.error('Error updating deposit:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to update deposit amount',
      });
    }
  }, [appointment, depositAmount, depositInfo.amount, medplum, loadData, patient, serviceRequests]);

  // Send payment link (SMS + Email)
  const sendPaymentLink = useCallback(async () => {
    if (!appointment || !patient) {
      return;
    }

    try {
      const currentUser = medplum.getProfile();
      const userName = currentUser?.name?.[0]
        ? `${currentUser.name[0].given?.[0] || ''} ${currentUser.name[0].family || ''}`.trim()
        : 'Unknown';

      const currentUserPractitioner = {
        resourceType: 'Practitioner' as const,
        id: currentUser?.id || '',
        name: currentUser?.name,
      };

      let method: 'sms' | 'email' | 'sms+email';
      const hasPhone = !!patient.telecom?.find((t) => t.system === 'phone');
      const hasEmail = !!patient.telecom?.find((t) => t.system === 'email');
      if (hasPhone && hasEmail) {
        method = 'sms+email';
      } else if (hasPhone) {
        method = 'sms';
      } else {
        method = 'email';
      }

      // Record deposit requested via AuditEvent
      await recordDepositRequested(
        medplum,
        patient,
        serviceRequests[0],
        depositAmount,
        method,
        currentUserPractitioner
      );

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

      await loadData();
    } catch (err) {
      console.error('Error sending payment link:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to send payment link',
      });
    }
  }, [appointment, patient, depositAmount, services, medplum, loadData, serviceRequests]);

  // Mark deposit as paid
  const markAsPaid = useCallback(async () => {
    if (!appointment || !patient) {
      return;
    }

    try {
      const currentUser = medplum.getProfile();
      const userName = currentUser?.name?.[0]
        ? `${currentUser.name[0].given?.[0] || ''} ${currentUser.name[0].family || ''}`.trim()
        : 'Unknown';

      const actualPaidAmount = manualPaymentAmount || depositAmount;

      const currentUserPractitioner = {
        resourceType: 'Practitioner' as const,
        id: currentUser?.id || '',
        name: currentUser?.name,
      };

      // Record payment via AuditEvent
      await recordDepositPaid(
        medplum,
        patient,
        serviceRequests[0],
        depositAmount,
        currentUserPractitioner,
        'manual',
        actualPaidAmount,
        paymentNotes || undefined
      );

      // Send confirmation with the actual amount paid
      if (patient) {
        await sendPaymentConfirmationSMS(patient, appointment, services, actualPaidAmount);
        await sendPaymentConfirmationEmail(patient, appointment, services, actualPaidAmount);
      }

      // Update booking status to booked (deposit requirement met)
      if (appointment.status === 'pending') {
        await updateStatus('booked', 'Deposit paid');
      }

      showNotification({
        color: 'green',
        title: 'Success',
        message: 'Deposit marked as paid',
      });

      setMarkPaidModalOpen(false);
      setManualPaymentAmount(0);
      setPaymentNotes('');

      await loadData();
    } catch (err) {
      console.error('Error marking paid:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to mark deposit as paid',
      });
    }
  }, [
    appointment,
    services,
    depositAmount,
    patient,
    medplum,
    loadData,
    manualPaymentAmount,
    paymentNotes,
    updateStatus,
    serviceRequests,
  ]);

  // Waive deposit
  const waiveDeposit = useCallback(async () => {
    if (!appointment || !patient) {
      return;
    }

    try {
      const currentUser = medplum.getProfile();
      const userName = currentUser?.name?.[0]
        ? `${currentUser.name[0].given?.[0] || ''} ${currentUser.name[0].family || ''}`.trim()
        : 'Unknown';

      const currentUserPractitioner = {
        resourceType: 'Practitioner' as const,
        id: currentUser?.id || '',
        name: currentUser?.name,
      };

      // Record waiver via AuditEvent
      await recordDepositWaived(
        medplum,
        patient,
        serviceRequests[0],
        depositAmount,
        currentUserPractitioner,
        waiveReason || undefined
      );

      // Update booking status to booked (deposit requirement met via waiver)
      if (appointment.status === 'pending') {
        await updateStatus('booked', 'Deposit waived');
      }

      showNotification({
        color: 'green',
        title: 'Success',
        message: 'Deposit waived',
      });

      setWaiveModalOpen(false);
      setWaiveReason('');

      await loadData();
    } catch (err) {
      console.error('Error waiving deposit:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to waive deposit',
      });
    }
  }, [appointment, waiveReason, medplum, loadData, updateStatus, patient, serviceRequests, depositAmount]);

  // Undo manual payment
  const undoPayment = useCallback(async () => {
    if (!appointment || !patient) {
      return;
    }

    try {
      const currentUser = medplum.getProfile();
      const userName = currentUser?.name?.[0]
        ? `${currentUser.name[0].given?.[0] || ''} ${currentUser.name[0].family || ''}`.trim()
        : 'Unknown';

      const currentUserPractitioner = {
        resourceType: 'Practitioner' as const,
        id: currentUser?.id || '',
        name: currentUser?.name,
      };

      // Record undo via AuditEvent
      await recordPaymentUndone(
        medplum,
        patient,
        serviceRequests[0],
        depositAmount,
        currentUserPractitioner,
        undoPaymentReason || undefined
      );

      // Revert booking status to pending (deposit no longer paid)
      if (appointment.status === 'booked') {
        await updateStatus('pending', 'Payment undone');
      }

      showNotification({
        color: 'green',
        title: 'Success',
        message: 'Payment undone',
      });

      setUndoPaymentModalOpen(false);
      setUndoPaymentReason('');

      await loadData();
    } catch (err) {
      console.error('Error undoing payment:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to undo payment',
      });
    }
  }, [appointment, undoPaymentReason, medplum, loadData, updateStatus, patient, serviceRequests, depositAmount]);

  // Issue refund
  const issueRefund = useCallback(async () => {
    if (!appointment || !patient) {
      return;
    }

    try {
      const currentUser = medplum.getProfile();
      const userName = currentUser?.name?.[0]
        ? `${currentUser.name[0].given?.[0] || ''} ${currentUser.name[0].family || ''}`.trim()
        : 'Unknown';

      const currentUserPractitioner = {
        resourceType: 'Practitioner' as const,
        id: currentUser?.id || '',
        name: currentUser?.name,
      };

      // TODO: When implementing Stripe integration, add API call to Stripe here
      // to process the actual refund transaction. For now, this only updates
      // the internal tracking.
      // Example future code:
      // if (depositInfo.paymentType === 'online') {
      //   await stripe.refunds.create({ payment_intent: depositInfo.paymentIntentId, amount: refundAmount * 100 });
      // }

      // Record refund via AuditEvent
      await recordRefundIssued(
        medplum,
        patient,
        serviceRequests[0],
        refundAmount,
        currentUserPractitioner,
        refundReason || undefined
      );

      showNotification({
        color: 'green',
        title: 'Success',
        message: `Refund of $${refundAmount} issued`,
      });

      setRefundModalOpen(false);
      setRefundAmount(0);
      setRefundReason('');

      await loadData();
    } catch (err) {
      console.error('Error issuing refund:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to issue refund',
      });
    }
  }, [appointment, refundAmount, refundReason, medplum, loadData, patient, serviceRequests]);

  // Get the status to restore when uncancelling
  // This restores the booking to whatever state it was in BEFORE cancellation
  const getUncancelTargetStatus = useCallback((): 'pending' | 'booked' | 'arrived' => {
    if (!appointment) {
      return 'pending';
    }

    // Get the pre-cancellation status from extension
    const preCancelStatus = appointment.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/pre-cancellation-status'
    )?.valueString;

    if (preCancelStatus === 'booked') {
      return 'booked';
    }
    if (preCancelStatus === 'arrived') {
      return 'arrived';
    }
    return 'pending'; // Default to pending if no pre-cancellation status or was pending
  }, [appointment]);

  // Handle uncancel with proper status restoration
  const handleUncancel = useCallback(
    async (reason: string) => {
      const targetStatus = getUncancelTargetStatus();
      await updateStatus(targetStatus, reason);
    },
    [updateStatus, getUncancelTargetStatus]
  );

  // Get available actions
  const getAvailableActions = (): {
    canSendPaymentLink: boolean;
    canMarkPaid: boolean;
    canWaive: boolean;
    canRefund: boolean;
    canUndoPayment: boolean;
    canArrive: boolean;
    canNoShow: boolean;
    canCancel: boolean;
    canUncancel: boolean;
    canUndoNoShow: boolean;
  } => {
    if (!appointment) {
      return {
        canSendPaymentLink: false,
        canMarkPaid: false,
        canWaive: false,
        canRefund: false,
        canUndoPayment: false,
        canArrive: false,
        canNoShow: false,
        canCancel: false,
        canUncancel: false,
        canUndoNoShow: false,
      };
    }

    const status = appointment.status || 'pending';
    const transitions = allowedTransitions[status] || [];

    // Payment actions
    const canSendPaymentLink = status === 'pending' && depositInfo.status === 'pending';
    const canMarkPaid = status === 'pending' && depositInfo.status === 'requested';
    const canWaive = status === 'pending' && (depositInfo.status === 'pending' || depositInfo.status === 'requested');
    const canRefund =
      (status === 'pending' || status === 'booked') &&
      depositInfo.status === 'paid' &&
      depositInfo.paymentType === 'manual' &&
      !depositInfo.isUndone;
    const canUndoPayment =
      depositInfo.status === 'paid' && depositInfo.paymentType === 'manual' && !depositInfo.isUndone;

    return {
      canSendPaymentLink,
      canMarkPaid,
      canWaive,
      canRefund,
      canUndoPayment,
      canArrive: status === 'booked' && transitions.includes('arrived'),
      canNoShow: (status === 'booked' || status === 'arrived') && transitions.includes('noshow'),
      canCancel: transitions.includes('cancelled'),
      canUncancel: status === 'cancelled',
      canUndoNoShow: status === 'noshow',
    };
  };

  const actions = getAvailableActions();

  // Format helpers
  const formatDate = (date: string | undefined): string => {
    if (!date) {
      return 'Not scheduled';
    }
    return dayjs(date).format('MMMM D, YYYY');
  };

  const formatTime = (date: string | undefined): string => {
    if (!date) {
      return '';
    }
    return dayjs(date).format('h:mm A');
  };

  const getDuration = (appt: Appointment): string => {
    if (!appt.start || !appt.end) {
      return '-';
    }
    const minutes = dayjs(appt.end).diff(dayjs(appt.start), 'minutes');
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  const getRoom = (appt: Appointment): string => {
    const roomExt = appt.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/room'
    )?.valueString;
    if (roomExt === 'room-1') {
      return 'Room 1';
    }
    if (roomExt === 'room-2') {
      return 'Room 2';
    }
    return '-';
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
        <Badge size="lg" color={statusConfig[appointment.status as keyof typeof statusConfig]?.color || 'gray'}>
          {statusConfig[appointment.status as keyof typeof statusConfig]?.label || appointment.status}
        </Badge>
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
                  <Text>{patient?.telecom?.find((t) => t.system === 'phone')?.value || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">
                    Email
                  </Text>
                  <Text>{patient?.telecom?.find((t) => t.system === 'email')?.value || '-'}</Text>
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

             {/* Services Section */}
             <Card withBorder>
               <Title order={5} mb="md">
                 Services ({serviceCardData.length})
               </Title>
               <Stack gap="md">
                 {serviceCardData.length > 0 ? (
                    serviceCardData.map((cardData, index) => (
                      <ServiceCard
                        key={cardData.serviceRequest?.id || index}
                        data={cardData}
                        index={index}
                        patient={patient as Patient}
                        mainProvider={providers[0]}
                        assistantProvider={providers[1]}
                        readonly={appointment?.status === 'cancelled' || appointment?.status === 'fulfilled'}
                        onStartService={handleStartService}
                        onCompleteService={handleCompleteService}
                        onUpdateTreatmentData={handleUpdateTreatmentData}
                        onUploadPhotos={handleUploadPhotos}
                        onDeletePhoto={handleDeletePhoto}
                        onUpdatePhotoMetadata={handleUpdatePhotoMetadata}
                      />
                    ))
                 ) : (
                   <Text c="dimmed" ta="center" py="md">
                     No services found for this booking
                   </Text>
                 )}
               </Stack>
             </Card>

            {/* Unified Actions Card */}
            <Card withBorder>
              <Title order={5} mb="md">
                Actions
              </Title>

              <Stack gap="lg">
                {/* Edit Booking */}
                {appointment.status !== 'fulfilled' && appointment.status !== 'cancelled' && (
                  <Button
                    variant="light"
                    color="blue"
                    onClick={() => setEditModalOpen(true)}
                    leftSection={<IconEdit size={16} />}
                  >
                    Edit Booking
                  </Button>
                )}

                {/* Status Actions - Primary */}
                {(actions.canArrive || actions.canNoShow || actions.canUncancel || actions.canUndoNoShow) && (
                  <Stack gap="xs">
                    <Text size="sm" fw={500} c="dimmed">
                      Status
                    </Text>
                    <Group>
                      {actions.canArrive && (
                        <Button
                          color="teal"
                          onClick={() => updateStatus('arrived')}
                          leftSection={<IconUserCheck size={16} />}
                        >
                          Mark as Arrived
                        </Button>
                      )}
                      {actions.canNoShow && (
                        <Button
                          color="gray"
                          onClick={() => updateStatus('noshow')}
                          leftSection={<IconUserX size={16} />}
                        >
                          Mark as No-Show
                        </Button>
                      )}
                      {actions.canUndoNoShow && (
                        <Button
                          color="blue"
                          variant="light"
                          onClick={() => updateStatus('booked')}
                          leftSection={<IconRefresh size={16} />}
                        >
                          Undo No-Show
                        </Button>
                      )}
                      {actions.canUncancel && (
                        <Button
                          color="blue"
                          variant="light"
                          onClick={() => setUncancelModalOpen(true)}
                          leftSection={<IconRefresh size={16} />}
                        >
                          Uncancel
                        </Button>
                      )}
                      {actions.canUncancel && (
                        <Text size="xs" c="dimmed">
                          Will restore to:{' '}
                          {(() => {
                            const status = getUncancelTargetStatus();
                            if (status === 'booked') {
                              return 'Booked';
                            }
                            if (status === 'arrived') {
                              return 'Arrived';
                            }
                            return 'Pending';
                          })()}
                        </Text>
                      )}
                    </Group>
                  </Stack>
                )}

                {/* Deposit Actions - Secondary */}
                {(actions.canSendPaymentLink ||
                  actions.canMarkPaid ||
                  actions.canWaive ||
                  actions.canRefund ||
                  actions.canUndoPayment) && (
                  <Stack gap="xs">
                    <Text size="sm" fw={500} c="dimmed">
                      Deposit
                    </Text>
                    <Group>
                      {actions.canSendPaymentLink && (
                        <Button
                          onClick={sendPaymentLink}
                          leftSection={<IconMessage size={16} />}
                          disabled={!patient?.telecom?.find((t) => t.system === 'phone')}
                        >
                          Send Payment Link
                        </Button>
                      )}
                      {actions.canMarkPaid && (
                        <Button
                          color="green"
                          variant="light"
                          onClick={() => setMarkPaidModalOpen(true)}
                          leftSection={<IconCoin size={16} />}
                        >
                          Mark as Paid
                        </Button>
                      )}
                      {actions.canWaive && (
                        <Button
                          color="orange"
                          variant="light"
                          onClick={() => setWaiveModalOpen(true)}
                          leftSection={<IconX size={16} />}
                        >
                          Waive Deposit
                        </Button>
                      )}
                      {actions.canRefund && (
                        <Button
                          color="red"
                          variant="light"
                          onClick={() => setRefundModalOpen(true)}
                          leftSection={<IconRefresh size={16} />}
                        >
                          Issue Refund
                        </Button>
                      )}
                      {actions.canUndoPayment && (
                        <Button
                          color="orange"
                          variant="light"
                          onClick={() => setUndoPaymentModalOpen(true)}
                          leftSection={<IconRefresh size={16} />}
                        >
                          Undo Payment
                        </Button>
                      )}
                    </Group>
                  </Stack>
                )}

                {/* Booking Management - Tertiary */}
                {actions.canCancel && (
                  <Stack gap="xs">
                    <Text size="sm" fw={500} c="dimmed">
                      Booking
                    </Text>
                    <Group>
                      <Button
                        color="red"
                        variant="light"
                        onClick={() => setCancelModalOpen(true)}
                        leftSection={<IconX size={16} />}
                      >
                        Cancel Booking
                      </Button>
                    </Group>
                  </Stack>
                )}
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        {/* Right Column - Deposit Management & Activity History */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            {/* Deposit Management - Info Only */}
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

                {/* Deposit Amount - Editable if not paid/waived */}
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
              </Stack>
            </Card>

            {/* Activity History */}
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
            <Button color="blue" onClick={async () => {
              await waiveDeposit();
              setWaiveModalOpen(false);
            }} disabled={!waiveReason.trim()}>
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
            <Button color="red" onClick={async () => {
              await updateStatus('cancelled', cancelReason);
              setCancelModalOpen(false);
            }}>
              Cancel Booking
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Uncancel Modal */}
      <Modal opened={uncancelModalOpen} onClose={() => setUncancelModalOpen(false)} title="Uncancel Booking">
        <Stack>
          <Text size="sm">Please provide a reason for uncancelling this booking:</Text>
          <Text size="xs" c="dimmed">
            This booking will be restored to:{' '}
            <strong>
              {(() => {
                const status = getUncancelTargetStatus();
                if (status === 'booked') {
                  return 'Booked (Deposit Paid)';
                }
                if (status === 'arrived') {
                  return 'Arrived';
                }
                return 'Pending (Deposit Required)';
              })()}
            </strong>
          </Text>
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
            <Button
              color="blue"
              onClick={() => {
                handleUncancel(uncancelReason)
                  .then(() => {
                    setUncancelModalOpen(false);
                    setUncancelReason('');
                  })
                  .catch(console.error);
              }}
              disabled={!uncancelReason.trim()}
            >
              Uncancel Booking
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Mark Paid Modal */}
      <Modal opened={markPaidModalOpen} onClose={() => setMarkPaidModalOpen(false)} title="Mark Deposit as Paid">
        <Stack>
          <Text size="sm">Enter payment details:</Text>
          <NumberInput
            label="Amount Received"
            description={`Requested amount is $${depositAmount}. You can adjust if needed.`}
            value={manualPaymentAmount || depositAmount}
            onChange={(val) => setManualPaymentAmount(Number(val) || 0)}
            min={0}
            step={25}
            prefix="$"
          />
          {/* TODO: When implementing final payment reconciliation,
              compare manualPaymentAmount with depositAmount
              and handle overpayment/underpayment scenarios */}
          <Textarea
            label="Payment Notes"
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.currentTarget.value)}
            placeholder="Payment notes (e.g., cash, check number)..."
            minRows={2}
          />
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => {
                setMarkPaidModalOpen(false);
                setManualPaymentAmount(0);
                setPaymentNotes('');
              }}
            >
              Cancel
            </Button>
            <Button color="green" onClick={async () => {
              await markAsPaid();
              setMarkPaidModalOpen(false);
            }}>
              Confirm Payment
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Undo Payment Modal */}
      <Modal opened={undoPaymentModalOpen} onClose={() => setUndoPaymentModalOpen(false)} title="Undo Manual Payment">
        <Stack>
          <Text size="sm">This will mark the deposit as requested again. Please provide a reason:</Text>
          <Text size="sm" fw={500}>
            Amount: {formatDepositAmount(depositInfo.amount)}
          </Text>
          <Textarea
            value={undoPaymentReason}
            onChange={(e) => setUndoPaymentReason(e.currentTarget.value)}
            placeholder="Reason for undoing payment (e.g., wrong amount entered)..."
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setUndoPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button color="orange" onClick={async () => {
              await undoPayment();
              setUndoPaymentModalOpen(false);
            }} disabled={!undoPaymentReason.trim()}>
              Undo Payment
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Booking Modal */}
      <CreateAppointmentModalV3
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          setEditModalOpen(false);
          loadData().catch(() => {
            // Error already handled inside loadData
          });
        }}
        editMode
        editAppointment={appointment || undefined}
        editServiceRequests={serviceRequests}
      />
    </Stack>
  );
}
