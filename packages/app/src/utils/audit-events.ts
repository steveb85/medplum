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

  // Build audit-details extension from entityDetails
  // Validate that all values are primitives (no objects with 'extension' properties)
  Object.entries(entityDetails).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      throw new Error(
        `[audit-events] Invalid entityDetail "${key}": must be primitive (string|number|boolean), got ${typeof value}. ` +
        `Objects can cause FHIR constraint violations (ext-1). Value: ${JSON.stringify(value).substring(0, 100)}`
      );
    }
  });

  // Create child extensions - ensure CLEAN objects with ONLY url and valueString
  const childExtensions = Object.entries(entityDetails).map(([key, value]) => {
    // Create a plain object with NO prototype to avoid any property leakage
    const ext = Object.create(null);
    ext.url = key;
    ext.valueString = String(value ?? '');
    // Double-check: remove any 'extension' property that might have leaked
    if (ext.extension) {
      console.error(`[audit-events] WARNING: 'extension' property found on child extension for key "${key}" - removing it`);
      delete ext.extension;
    }
    return ext;
  });

  const auditDetailsExtension = {
    url: 'http://melissaknudson.com/fhir/StructureDefinition/audit-details',
    extension: childExtensions,
  };

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
        display: mapActionToDisplay(action),
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
          display: 'Application Activity',
        },
      ],
    },
    extension: [auditDetailsExtension],
    entity: entity.length > 0 ? entity : undefined,
  };

  // Debug: Log the exact AuditEvent being sent
  console.log('[audit-events] Creating AuditEvent:', JSON.stringify(auditEvent, null, 2).substring(0, 1000));

  // Pre-send validation: Check for FHIR constraint violations (ext-1)
  // Check extension[] array
  (auditEvent.extension || []).forEach((ext, extIndex) => {
    if ((ext as any).extension) {
      ((ext as any).extension || []).forEach((child: any, childIndex: number) => {
        if (child.extension && child.valueString) {
          console.error(
            `[audit-events] VIOLATION: extension[${extIndex}].extension[${childIndex}] has BOTH extension AND valueString! ` +
            `url: ${child.url}, valueString: ${child.valueString}, extension: ${JSON.stringify(child.extension).substring(0, 50)}`
          );
          console.error('[audit-events] Full auditEvent:', JSON.stringify(auditEvent, null, 2));
          throw new Error(
            `[audit-events] Cannot create AuditEvent: extension[${extIndex}].extension[${childIndex}] violates FHIR constraint ext-1 ` +
            `(cannot have both extension and value[x]). url: ${child.url}`
          );
        }
      });
    }
  });

  // Also check entity[] array (Medplum might move these to extension)
  (auditEvent.entity || []).forEach((ent, entIndex) => {
    if ((ent as any).extension) {
      ((ent as any).extension || []).forEach((child: any, childIndex: number) => {
        if (child.extension && child.valueString) {
          console.error(
            `[audit-events] VIOLATION: entity[${entIndex}].extension[${childIndex}] has BOTH extension AND valueString! ` +
            `url: ${child.url}`
          );
        }
      });
    }
  });

  return medplum.createResource(auditEvent);
}

function parseEntityDetails(event: AuditEvent): EntityDetails {
  const details: EntityDetails = {};
  
  // Read from extension (new format) - entityDetails stored in AuditEvent.extension
  const auditDetailsExt = event.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/audit-details'
  );
  
  if (auditDetailsExt?.extension) {
    auditDetailsExt.extension.forEach((ext) => {
      if (ext.valueString && ext.url) {
        details[ext.url] = ext.valueString;
      }
    });
    return details;
  }
  
  // Fallback to old format (entity.detail) for backward compatibility
  event.entity?.forEach((entity) => {
    if (entity.detail && Array.isArray(entity.detail)) {
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
    // Search AuditEvent by patient - use full reference format
    // Note: Medplum doesn't support _sort=recorded for AuditEvent
    console.log('[audit-events] Loading AuditEvents for patient:', `Patient/${patientId}`);
    const bundle = await medplum.search('AuditEvent', {
      patient: `Patient/${patientId}`,
      _count: '100',
    });
    console.log('[audit-events] AuditEvent search result:', bundle.total, 'events found');

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
