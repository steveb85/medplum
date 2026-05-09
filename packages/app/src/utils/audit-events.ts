// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { MedplumClient } from '@medplum/core';
import type { AuditEvent, Consent, Patient, Practitioner, ServiceRequest } from '@medplum/fhirtypes';
import type { DepositInfo, DepositStatus } from './payments';

// STRICT type: Only allow primitives that can safely become valueString
// Objects (which might have 'extension' properties) are NOT allowed
// This prevents FHIR constraint violations at compile time
type EntityDetails = Record<string, string | number | boolean | null | undefined>;

/**
 * Maps action codes to FHIR RESTful interaction codes
 * @param action - The action code (C, R, U, D, E)
 * @returns The corresponding FHIR RESTful interaction code
 */
function mapActionToCode(action: string): string {
  const mapping: Record<string, string> = {
    'C': 'create',
    'R': 'read',
    'U': 'update',
    'D': 'delete',
    'E': 'execute',
  };
  return mapping[action] || 'execute';
}

/**
 * Maps action codes to display names
 * @param action - The action code (C, R, U, D, E)
 * @returns The corresponding display name
 */
function mapActionToDisplay(action: string): string {
  const mapping: Record<string, string> = {
    'C': 'Create',
    'R': 'Read',
    'U': 'Update',
    'D': 'Delete',
    'E': 'Execute',
  };
  return mapping[action] || 'Execute';
}

/**
 * Creates a FHIR AuditEvent resource using Medplum client
 * Properly structures the AuditEvent according to FHIR R4 specification
 * @param medplum - Medplum client instance
 * @param params - Parameters for creating the AuditEvent
 * @param params.action - Action code (C, R, U, D, E)
 * @param params.patient - Patient resource
 * @param params.agent - Optional practitioner agent
 * @param params.resource - Optional service request resource
 * @param params.description - Description of the event
 * @param params.outcome - Outcome code ('0' = success)
 * @param params.entityDetails - Additional details to store
 * @returns The created AuditEvent resource
 */
async function createAuditEvent(
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
): Promise<AuditEvent> {
  const { action, patient, agent, resource, description, outcome, entityDetails } = params;

  // Build entity array with proper FHIR R4 structure
  const entity: any[] = [
    // Add patient as an entity (role is a Coding object, not wrapped in coding[])
    {
      what: { reference: `Patient/${patient.id}` },
      role: {
        system: 'http://terminology.hl7.org/CodeSystem/object-role',
        code: '1', // Patient
        display: 'Patient',
      },
    },
  ];

  // Add the service request as a second entity if provided
  if (resource) {
    entity.push({
      what: { reference: `ServiceRequest/${resource.id}` },
      role: {
        system: 'http://terminology.hl7.org/CodeSystem/object-role',
        code: '2',
        display: 'ServiceRequest',
      },
    });
  }

  // Add a third entity to store the details (avoids ext-1 constraint issues with extensions)
  // Using entity.detail array is cleaner and FHIR-compliant
  if (Object.keys(entityDetails).length > 0) {
    const detailArray = Object.entries(entityDetails).map(([key, value]) => ({
      type: key,  // Simple string type
      valueString: String(value ?? ''),
    }));
    
    entity.push({
      what: { display: 'Audit Details' },
      role: {
        system: 'http://terminology.hl7.org/CodeSystem/object-role',
        code: '21', // Report - appropriate for audit details
        display: 'Audit Details',
      },
      detail: detailArray,
    });
  }

  // Build agent array
  const agents: any[] = [
    {
      who: {
        reference: `Patient/${patient.id}`,
        display: patient.name?.[0]
          ? `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim()
          : 'Unknown Patient',
      },
      requestor: false,
    },
  ];

  // Add the staff agent if provided
  if (agent) {
    agents.push({
      who: {
        reference: `Practitioner/${agent.id}`,
        display: agent.name?.[0]
          ? `${agent.name[0].given?.join(' ') || ''} ${agent.name[0].family || ''}`.trim()
          : 'Unknown Staff',
      },
      requestor: true,
    });
  }

  // DEBUG: Log the exact entityDetails being used
  console.log('[audit-events] entityDetails:', JSON.stringify(entityDetails, null, 2));

  // FHIR R4: AuditEvent.subtype is Coding[] (not CodeableConcept[])
  // Store description in subtype[0].display (Coding.display property)
  const auditEvent: AuditEvent = {
    resourceType: 'AuditEvent',
    type: {
      system: 'http://terminology.hl7.org/CodeSystem/audit-event-type',
      code: 'rest',
      display: 'Restful Operation',
    },
    subtype: [
      {
        system: 'http://hl7.org/fhir/restful-interaction',
        code: mapActionToCode(action),
        display: description || mapActionToDisplay(action),
      },
    ],
    action: action as any,
    recorded: new Date().toISOString(),
    outcome: outcome as any,
    agent: agents,
    source: {
      observer: { display: 'Medplum App' },
      type: [
        {
          system: 'http://dicom.nema.org/resources/ontology/DCM',
          code: '110100',
          display: 'Application',
        },
      ],
    },
    entity: entity,
    // No extensions - details stored in entity[2].detail array (FHIR-compliant)
    extension: [],
  };

  // Debug: Log the exact AuditEvent being sent
  console.log('[audit-events] Creating AuditEvent:', JSON.stringify(auditEvent, null, 2).substring(0, 800));

  console.log('[audit-events] About to call medplum.createResource...');
  return medplum.createResource(auditEvent);
}

// Helper: Extract description from AuditEvent
// FHIR R4: AuditEvent.subtype is Coding[] - description stored in subtype[0].display
function getAuditEventDescription(event: AuditEvent): string {
  // PRIMARY: Read from subtype[0].display (Coding.display)
  const codingDisplay = event.subtype?.[0]?.display;
  if (codingDisplay) return codingDisplay;

  // FALLBACK: Read from extension (old format)
  const descExt = event.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/audit-description'
  );
  if (descExt?.valueString) return descExt.valueString;

  return '';
}

export function parseEntityDetails(event: AuditEvent): { details: EntityDetails; description: string } {
  const details: EntityDetails = {};
  const description = getAuditEventDescription(event);

  console.log('[audit-events] parseEntityDetails: description =', description);
  console.log('[audit-events] parseEntityDetails: event.entity count =', event.entity?.length);
  console.log('[audit-events] parseEntityDetails: event.entity =', JSON.stringify(event.entity, null, 2)?.substring(0, 800));

  // PRIMARY: Read from entity.detail array (entity[2] contains audit details)
  // This is the new FHIR-compliant format that avoids ext-1 constraint issues
  event.entity?.forEach((entity, idx) => {
    console.log(`[audit-events] Checking entity[${idx}]:`, entity.what?.reference || entity.what?.display);
    if (entity.detail && Array.isArray(entity.detail)) {
      console.log(`[audit-events] Found entity[${idx}].detail with ${entity.detail.length} items:`, JSON.stringify(entity.detail));
      entity.detail.forEach((detail: any) => {
        if (detail.valueString) {
          // Extract type from multiple possible formats
          let typeCode = '';

          // New format: type is a string
          if (typeof detail.type === 'string') {
            typeCode = detail.type;
          }
          // Old format: type is an object with coding array
          else if (detail.type?.coding?.[0]?.code) {
            typeCode = detail.type.coding[0].code;
          }
          // Legacy text format
          else if (detail.type?.text) {
            typeCode = detail.type.text;
          }

          console.log(`[audit-events] Extracted detail: ${typeCode} = ${detail.valueString}`);
          if (typeCode) {
            details[typeCode] = detail.valueString;
          }
        }
      });
    }
    // Also check for direct properties on entity (legacy format)
    if (entity.what?.reference) {
      details['resourceReference'] = entity.what.reference;
    }
  });

  console.log('[audit-events] Details extracted from entity:', details);

  // If details found in entity, return them
  if (Object.keys(details).length > 0) {
    return { details, description };
  }

  // FALLBACK: Read from extension (old format for backward compatibility)
  const auditDetailsExt = event.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/audit-details'
  );

  if (auditDetailsExt?.extension) {
    auditDetailsExt.extension.forEach((ext) => {
      if (ext.valueString && ext.url) {
        details[ext.url] = ext.valueString;
      }
    });
  }
  
  return { details, description };
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

export async function getDepositStatusFromAuditEvents(
  medplum: MedplumClient,
  patientId: string,
  serviceRequestId?: string
): Promise<DepositInfo> {
  // If no serviceRequestId, search ALL patient events (backward compatible)
  // If serviceRequestId, filter events to specific booking
  console.log('[audit-events] getDepositStatusFromAuditEvents: patientId=' + patientId + ', serviceRequestId=' + (serviceRequestId || '(all bookings)'));
  try {
    // Search AuditEvent by patient - use full reference format
    // Note: Medplum doesn't support _sort=recorded for AuditEvent
    console.log('[audit-events] Loading AuditEvents for patient:', `Patient/${patientId}`);
    const bundle = await medplum.search('AuditEvent', {
      patient: `Patient/${patientId}`,
      _count: '100',
    });
    console.log('[audit-events] AuditEvent search result: ' + bundle.total + ' events found, entry count: ' + (bundle.entry?.length || 0));
    if (bundle.entry && bundle.entry.length > 0) {
      console.log('[audit-events] First event sample:', JSON.stringify(bundle.entry[0].resource, null, 2).substring(0, 500));
    }

    const allEvents = (bundle.entry || []).map((e) => e.resource as AuditEvent);
    const depositEvents = allEvents.filter((event) => {
      // FIX: Read from subtype[0].text (CodeableConcept.text) where description is stored
      const description = getAuditEventDescription(event).toLowerCase();
      const isDepositOrPayment = description.includes('deposit') || description.includes('payment');
      
      // If serviceRequestId provided, filter to events for that specific booking
      if (serviceRequestId && isDepositOrPayment) {
        const hasServiceRequestEntity = event.entity?.some(
          (e) => e.what?.reference === `ServiceRequest/${serviceRequestId}`
        );
        return hasServiceRequestEntity;
      }
      
      // Otherwise, return all deposit/payment events (backward compatible)
      return isDepositOrPayment;
    });

    const chronologicalEvents = [...depositEvents].sort(
      (a, b) => new Date(a.recorded || '').getTime() - new Date(b.recorded || '').getTime()
    );

    let currentStatus: DepositStatus = 'pending';
    let currentAmount = 250; // Default deposit amount
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
      // FIX: Read description from subtype[0].display (Coding.display) where createAuditEvent stores it
      const description = (event.subtype?.[0]?.display || '').toLowerCase();
      lastEntityDetails = parseEntityDetails(event);

      if (description.includes('deposit requested')) {
        const amountMatch = description.match(/\$([\d.]+)/);
        currentAmount = amountMatch ? parseFloat(amountMatch[1]) : currentAmount;
        requestedAt = new Date(event.recorded);
        currentStatus = 'requested';
      } else if (description.includes('deposit paid')) {
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
      amount: 250, // Default deposit amount
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

export async function recordBookingCreated(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  createdBy: Practitioner,
  services: string[],
  reason?: string
): Promise<AuditEvent> {
  const createdByName = createdBy.name?.[0]
    ? String(createdBy.name[0].given?.[0] || '').trim() + ' ' + String(createdBy.name[0].family || '').trim()
    : 'Unknown Staff';

  return createAuditEvent(medplum, {
    action: 'C',
    patient,
    resource: serviceRequest,
    agent: createdBy,
    description: 'Booking created by ' + createdByName + ': ' + services.join(', ') + (reason ? ' (' + reason + ')' : ''),
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      services: services.join(', '),
      reason: reason || '',
      createdByName,
    },
  });
}

export async function recordBookingEdited(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  editedBy: Practitioner,
  changes: string,
  reason?: string
): Promise<AuditEvent> {
  const editedByName = editedBy.name?.[0]
    ? String(editedBy.name[0].given?.[0] || '').trim() + ' ' + String(editedBy.name[0].family || '').trim()
    : 'Unknown Staff';

  return createAuditEvent(medplum, {
    action: 'U',
    patient,
    resource: serviceRequest,
    agent: editedBy,
    description: 'Booking edited by ' + editedByName + ': ' + changes + (reason ? ' (' + reason + ')' : ''),
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      changes,
      reason: reason || '',
      editedByName,
    },
  });
}

export async function recordFinalPaymentRequested(
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
    action: 'E',
    patient,
    resource: serviceRequest,
    agent: requestedBy,
    description: 'Final payment requested via ' + method + ' by ' + requestedByName,
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      amount: String(amount),
      method,
      requestedByName,
    },
  });
}

export async function recordFinalPaymentReceived(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  amount: number,
  receivedBy: Practitioner,
  paymentType: 'manual' | 'online',
  actualAmount?: number,
  notes?: string
): Promise<AuditEvent> {
  const receivedByName = receivedBy.name?.[0]
    ? String(receivedBy.name[0].given?.[0] || '').trim() + ' ' + String(receivedBy.name[0].family || '').trim()
    : 'Unknown Staff';

  return createAuditEvent(medplum, {
    action: 'E',
    patient,
    resource: serviceRequest,
    agent: receivedBy,
    description: 'Final payment received via ' + paymentType + ' by ' + receivedByName,
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      amount: String(amount),
      paymentType,
      actualAmount: actualAmount ? String(actualAmount) : undefined,
      notes: notes || '',
      receivedByName,
    },
  });
}

export async function recordBookingCompleted(
  medplum: MedplumClient,
  patient: Patient,
  serviceRequest: ServiceRequest,
  completedBy: Practitioner,
  reason?: string
): Promise<AuditEvent> {
  const completedByName = completedBy.name?.[0]
    ? String(completedBy.name[0].given?.[0] || '').trim() + ' ' + String(completedBy.name[0].family || '').trim()
    : 'Unknown Staff';

  return createAuditEvent(medplum, {
    action: 'E',
    patient,
    resource: serviceRequest,
    agent: completedBy,
    description: 'Booking completed by ' + completedByName + (reason ? ': ' + reason : ''),
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      completedByName,
      reason: reason || '',
    },
  });
}

export async function recordDepositWaiveUndone(
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
    description: 'Deposit waive undone by ' + undoneByName + (reason ? ': ' + reason : ''),
    outcome: '0',
    entityDetails: {
      serviceRequestId: serviceRequest.id || '',
      amount: String(amount),
      undoneByName,
      reason: reason || '',
    },
  });
}
