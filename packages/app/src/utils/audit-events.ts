// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { MedplumClient } from '@medplum/core';
import type { AuditEvent, Consent, Patient, Practitioner, ServiceRequest } from '@medplum/fhirtypes';
import type { DepositInfo, DepositStatus } from './payments';

type EntityDetails = Record<string, any>;

declare function createAuditEvent(
  medplum: MedplumClient,
  params: {
    action: string;
    patient: Patient;
    agent?: Practitioner;
    resource?: ServiceRequest;
    description: string;
    outcome: string;
    entityDetails: EntityDetails;
  }
): Promise<AuditEvent>;

function parseEntityDetails(event: AuditEvent): EntityDetails {
  const details: EntityDetails = {};
  event.entity?.forEach((entity) => {
    entity.detail?.forEach((detail) => {
      if (detail.valueString) {
        details[detail.type || ''] = detail.valueString;
      }
    });
  });
  return details;
}

export async function recordDepositPaid(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  amount: number,
  paidBy: Practitioner,
  paymentType: 'manual' | 'online',
  actualPaidAmount?: number,
  notes?: string
): Promise<AuditEvent> {
  const paidByName = paidBy.name?.[0]
    ? String(paidBy.name[0].given?.[0] || '').trim() + ' ' + String(paidBy.name[0].family || '').trim()
    : 'Unknown Staff';

  return createAuditEvent(medplum, {
    action: 'E',
    patient,
    resource: serviceRequest,
    agent: paidBy,
    description: 'Deposit paid via ' + paymentType + ' by ' + paidByName,
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      amount: String(amount),
      paymentType,
      notes: notes || '',
      paidByName,
    },
  });
}

export async function recordDepositRequested(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  amount: number,
  method: 'sms' | 'email' | 'sms+email',
  requestedBy: Practitioner
): Promise<AuditEvent> {
  const requestedByName = requestedBy.name?.[0]
    ? String(requestedBy.name[0].given?.[0] || '').trim() + ' ' + String(requestedBy.name[0].family || '').trim()
    : 'Unknown Staff';

  return createAuditEvent(medplum, {
    action: 'R',
    patient,
    resource: serviceRequest,
    agent: requestedBy,
    description: 'Deposit requested via ' + method + ' by ' + requestedByName,
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      amount: String(amount),
      method,
      requestedByName,
    },
  });
}

export async function getDepositStatusFromAuditEvents(medplum: MedplumClient, patientId: string): Promise<DepositInfo> {
  try {
    const bundle = await medplum.search('AuditEvent', {
      patient: 'Patient/' + patientId,
      _sort: '-recorded',
      _count: '100',
    });

    const allEvents = (bundle.entry || []).map((e) => e.resource as AuditEvent);
    const depositEvents = allEvents.filter((event) => {
      const description = ((event as any).description || '').toLowerCase();
      return (
        description.includes('deposit') ||
        description.includes('payment') ||
        event.entity?.some((e) => (e.detail || []).some((d) => d.type === 'serviceRequestId'))
      );
    });

    const chronologicalEvents = [...depositEvents].sort(
      (a, b) => new Date(a.recorded || '').getTime() - new Date(b.recorded || '').getTime()
    );

    let currentStatus: DepositStatus = 'pending';
    let currentAmount = 50;
    let requestedAt: Date | undefined;
    let paidAt: Date | undefined;
    let waivedAt: Date | undefined;
    let waivedBy: any;
    let paymentType: any;
    let actualPaidAmount: number | undefined;
    let isUndone = false;
    let undoneAt: Date | undefined;
    let lastEntityDetails: any;

    for (const event of chronologicalEvents) {
      const description = ((event as any).description || '').toLowerCase();
      lastEntityDetails = parseEntityDetails(event);

      if (description.includes('deposit payment link sent')) {
        const amountMatch = description.match(/\$([\d.]+)/);
        currentAmount = amountMatch ? parseFloat(amountMatch[1]) : currentAmount;
        requestedAt = new Date(event.recorded);
        currentStatus = 'requested';
      } else if (description.includes('deposit of $') && description.includes('paid via')) {
        const amountMatch = description.match(/\$([\d.]+)/);
        currentAmount = amountMatch ? parseFloat(amountMatch[1]) : currentAmount;
        actualPaidAmount = lastEntityDetails.actualPaidAmount
          ? parseFloat(lastEntityDetails.actualPaidAmount.toString())
          : currentAmount;
        paymentType = lastEntityDetails.paymentType;
        paidAt = new Date(event.recorded);
        currentStatus = 'paid';
        isUndone = false;
      } else if (description.includes('deposit waived')) {
        const amountMatch = description.match(/\$([\d.]+)/);
        currentAmount = amountMatch ? parseFloat(amountMatch[1]) : currentAmount;
        waivedAt = new Date(event.recorded);
        waivedBy = lastEntityDetails.waivedBy;
        currentStatus = 'waived';
        isUndone = false;
      } else if (description.includes('payment undone') || description.includes('deposit undone')) {
        isUndone = true;
        undoneAt = new Date(event.recorded);
        currentStatus = 'requested';
      }
    }

    return {
      status: currentStatus,
      amount: currentAmount,
      requestedAt,
      paidAt,
      paymentNotes: lastEntityDetails?.paymentNotes,
      waivedAt,
      waivedBy,
      waivedReason: lastEntityDetails?.waivedReason,
      isUndone,
      undoneAt,
      paymentType,
      actualPaidAmount,
    };
  } catch (err) {
    return {
      status: 'pending',
      amount: 50,
    };
  }
}

export async function recordDepositAmountChanged(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  previousAmount: number,
  newAmount: number,
  changedBy: Practitioner
): Promise<AuditEvent> {
  return createAuditEvent(medplum, {
    action: 'U',
    patient,
    resource: serviceRequest,
    agent: changedBy,
    description: 'Deposit amount changed',
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      previousAmount: String(previousAmount),
      newAmount: String(newAmount),
    },
  });
}

export async function recordDepositWaived(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  amount: number,
  waivedBy: Practitioner,
  reason?: string
): Promise<AuditEvent> {
  return createAuditEvent(medplum, {
    action: 'E',
    patient,
    resource: serviceRequest,
    agent: waivedBy,
    description: 'Deposit waived' + (reason ? ': ' + reason : ''),
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      amount: String(amount),
      reason: reason || '',
    },
  });
}

export async function recordPaymentLinkSent(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  amount: number,
  method: 'sms' | 'email' | 'sms+email',
  sentBy: Practitioner
): Promise<AuditEvent> {
  return createAuditEvent(medplum, {
    action: 'E',
    patient,
    resource: serviceRequest,
    agent: sentBy,
    description: 'Payment link sent via ' + method,
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      amount: String(amount),
      method,
    },
  });
}

export async function recordConsentSigned(
  medplum: MedplumClient,
  patient: Patient,
  consent: Consent,
  serviceRequest: ServiceRequest,
  signedByRole: string
): Promise<AuditEvent> {
  const consentActor = consent.provision?.actor?.[0]?.reference?.display;
  const patientName = patient.name?.[0];
  const signedByName = consentActor || (patientName ? `${patientName.given?.[0] || ''} ${patientName.family || ''}`.trim() : 'Patient');

  const consentCategory = consent.category?.[0]?.coding?.[0]?.code || 'general';

  return createAuditEvent(medplum, {
    action: 'E',
    patient,
    resource: serviceRequest,
    description: consentCategory + ' consent signed by ' + signedByName + ' (' + signedByRole + ')',
    outcome: '0',
    entityDetails: {
      consentId: consent.id || '',
      consentCategory,
      signedByRole,
      signedByName,
    },
  });
}

export async function recordServiceStarted(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  startedBy: Practitioner
): Promise<AuditEvent> {
  const startedByName = startedBy.name?.[0]
    ? String(startedBy.name[0].given?.[0] || '').trim() + ' ' + String(startedBy.name[0].family || '').trim()
    : 'Unknown Staff';

  return createAuditEvent(medplum, {
    action: 'S',
    patient,
    resource: serviceRequest,
    agent: startedBy,
    description: 'Treatment service started by ' + startedByName,
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      startedByName,
    },
  });
}

export async function recordServiceCompleted(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  completedBy: Practitioner
): Promise<AuditEvent> {
  const completedByName = completedBy.name?.[0]
    ? String(completedBy.name[0].given?.[0] || '').trim() + ' ' + String(completedBy.name[0].family || '').trim()
    : 'Unknown Staff';

  return createAuditEvent(medplum, {
    action: 'E',
    patient,
    resource: serviceRequest,
    agent: completedBy,
    description: 'Treatment service completed by ' + completedByName,
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      completedByName,
    },
  });
}

export async function recordTreatmentMilestone(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  milestone: string,
  recordedBy?: Practitioner
): Promise<AuditEvent> {
  const recordedByName = recordedBy?.name?.[0]
    ? String(recordedBy.name[0].given?.[0] || '').trim() + ' ' + String(recordedBy.name[0].family || '').trim()
    : 'System';

  return createAuditEvent(medplum, {
    action: 'E',
    patient,
    resource: serviceRequest,
    agent: recordedBy,
    description: 'Treatment milestone: ' + milestone + ' recorded by ' + recordedByName,
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      milestone,
      recordedByName,
    },
  });
}

export async function recordBookingStatusChange(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  previousStatus: string,
  newStatus: string,
  changedBy: Practitioner,
  reason?: string
): Promise<AuditEvent> {
  const changedByName = changedBy.name?.[0]
    ? String(changedBy.name[0].given?.[0] || '').trim() + ' ' + String(changedBy.name[0].family || '').trim()
    : 'Unknown Staff';

  return createAuditEvent(medplum, {
    action: 'U',
    patient,
    resource: serviceRequest,
    agent: changedBy,
    description:
      'Booking status changed from ' +
      previousStatus +
      ' to ' +
      newStatus +
      ' by ' +
      changedByName +
      (reason ? ': ' + reason : ''),
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      previousStatus,
      newStatus,
      changedByName,
      reason: reason || '',
    },
  });
}

export async function recordPaymentUndone(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  amount: number,
  undoneBy: Practitioner,
  reason?: string
): Promise<AuditEvent> {
  const undoneByName = undoneBy.name?.[0]
    ? String(undoneBy.name[0].given?.[0] || '').trim() + ' ' + String(undoneBy.name[0].family || '').trim()
    : 'Unknown Staff';

  return createAuditEvent(medplum, {
    action: 'U',
    patient,
    resource: serviceRequest,
    agent: undoneBy,
    description: 'Payment undone (reverted to requested) by ' + undoneByName + (reason ? ': ' + reason : ''),
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      amount: String(amount),
      undoneByName,
      reason: reason || '',
    },
  });
}

export async function recordRefundIssued(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  amount: number,
  refundedBy: Practitioner,
  reason?: string
): Promise<AuditEvent> {
  const refundedByName = refundedBy.name?.[0]
    ? String(refundedBy.name[0].given?.[0] || '').trim() + ' ' + String(refundedBy.name[0].family || '').trim()
    : 'Unknown Staff';

  return createAuditEvent(medplum, {
    action: 'U',
    patient,
    resource: serviceRequest,
    agent: refundedBy,
    description: 'Refund of $' + amount + ' issued by ' + refundedByName + (reason ? ': ' + reason : ''),
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      amount: String(amount),
      refundedByName,
      reason: reason || '',
    },
  });
}
