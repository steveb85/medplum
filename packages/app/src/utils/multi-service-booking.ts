// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Multi-Service Booking Utilities
 *
 * Handles creation and management of bookings with multiple services.
 * Each service becomes a separate ServiceRequest with its own room, equipment,
 * provider, and timing configuration.
 */

import { createReference } from '@medplum/core';
import type {
  ActivityDefinition,
  Appointment,
  Device,
  Location,
  Patient,
  Practitioner,
  Reference,
  ServiceRequest,
} from '@medplum/fhirtypes';
import dayjs from 'dayjs';
import type { ServiceRequestDetails } from './fhir-extensions';
import { buildServiceRequestExtensions, parseServiceConfig } from './fhir-extensions';

// ============================================================================
// Types
// ============================================================================

export interface ServiceConfiguration {
  activityDefinition: ActivityDefinition;
  duration: number; // Override duration (minutes)
  assignedRoom?: Reference<Location>;
  assignedEquipment?: Reference<Device>[];
  assignedProvider?: Reference<Practitioner>;
  serviceSequence: number;
  linkedServiceIds?: string[]; // References to other services in same booking
}

export interface CalculatedServiceTiming {
  sequence: number;
  startTime: Date;
  endTime: Date;
  serviceConfig: ServiceConfiguration;
}

export interface MultiServiceBookingInput {
  patient: Patient;
  services: ServiceConfiguration[];
  baseStartTime: Date;
  notes?: string;
  depositAmount?: number;
}

export interface MultiServiceBookingResult {
  appointment: Appointment;
  serviceRequests: ServiceRequest[];
  totalDuration: number;
  serviceTimings: CalculatedServiceTiming[];
}

export interface ConflictCheck {
  type: 'provider' | 'room' | 'equipment';
  resourceId: string;
  resourceName: string;
  conflictingTime: Date;
  severity: 'warning' | 'error';
  message: string;
}

// ============================================================================
// Timing Calculations
// ============================================================================

/**
 * Calculate timing for sequential services
 * Each service starts after the previous one ends
 * @param services - List of services with durations and sequence
 * @param baseStartTime - Start time for the first service
 * @returns List of calculated timings for each service
 */
export function calculateSequentialTimings(
  services: ServiceConfiguration[],
  baseStartTime: Date
): CalculatedServiceTiming[] {
  const sorted = [...services].sort((a, b) => a.serviceSequence - b.serviceSequence);
  const timings: CalculatedServiceTiming[] = [];

  let currentTime = dayjs(baseStartTime);

  for (const service of sorted) {
    const endTime = currentTime.add(service.duration, 'minute');

    timings.push({
      sequence: service.serviceSequence,
      startTime: currentTime.toDate(),
      endTime: endTime.toDate(),
      serviceConfig: service,
    });

    currentTime = endTime;
  }

  return timings;
}

/**
 * Calculate total duration for all services
 * @param services - List of services with durations
 * @returns Total duration in minutes
 */
export function calculateTotalDuration(services: ServiceConfiguration[]): number {
  return services.reduce((sum, svc) => sum + svc.duration, 0);
}

// ============================================================================
// Service Configuration Helpers
// ============================================================================

/**
 * Build default service configuration from ActivityDefinition
 * @param activityDefinition  - The ActivityDefinition to build from
 * @param sequence - The sequence number for this service in the booking
 * @param defaultProvider - default provider to assign (optional)
 * @returns ServiceConfiguration with defaults applied
 */
export function buildDefaultServiceConfig(
  activityDefinition: ActivityDefinition,
  sequence: number,
  defaultProvider?: Practitioner
): ServiceConfiguration {
  const config = parseServiceConfig(activityDefinition);

  return {
    activityDefinition,
    duration: activityDefinition.timingDuration?.value ?? 30,
    assignedRoom: config.defaultRoom ? { reference: `Location/${config.defaultRoom}` } : undefined,
    assignedProvider: defaultProvider ? createReference(defaultProvider) : undefined,
    serviceSequence: sequence,
    assignedEquipment: [],
  };
}

/**
 * Auto-suggest accompanying services based on recommendations
 * @param primaryService - The primary service for which to suggest accompaniments
 * @param availableServices - List of available services to choose from
 * @returns List of suggested accompanying services
 */
export function suggestAccompanyingServices(
  primaryService: ActivityDefinition,
  availableServices: ActivityDefinition[]
): ActivityDefinition[] {
  const config = parseServiceConfig(primaryService);
  const suggestions: ActivityDefinition[] = [];

  for (const rec of config.recommendedAccompanyingServices) {
    const found = availableServices.find((s) => s.name === rec.serviceCode);
    if (found) {
      suggestions.push(found);
    }
  }

  return suggestions;
}

// ============================================================================
// Booking Creation
// ============================================================================

/**
 * Create a multi-service booking
 * Creates one Appointment as container + multiple ServiceRequests
 * @param input - Input data for the booking
 * @returns Created Appointment and ServiceRequests ready for submission
 */
export function createMultiServiceBooking(input: MultiServiceBookingInput): MultiServiceBookingResult {
  const { patient, services, baseStartTime, notes, depositAmount = 250 } = input;

  // Calculate timings
  const serviceTimings = calculateSequentialTimings(services, baseStartTime);
  const totalDuration = calculateTotalDuration(services);
  const endTime = serviceTimings[serviceTimings.length - 1]?.endTime ?? baseStartTime;

  // Collect unique participants (patient + all providers)
  const participantSet = new Map<string, { actor: Reference; status: string }>();

  // Add patient
  const patientRef = createReference(patient);
  if (patientRef.reference) {
    participantSet.set(patientRef.reference, {
      actor: patientRef,
      status: 'tentative',
    });
  }

  // Add all service providers
  for (const service of services) {
    if (service.assignedProvider?.reference) {
      participantSet.set(service.assignedProvider.reference, {
        actor: service.assignedProvider,
        status: 'tentative',
      });
    }
  }

  // Create Appointment (container)
  const appointment: Appointment = {
    resourceType: 'Appointment',
    status: 'pending',
    serviceType: services.map((s) => ({
      text: s.activityDefinition.title ?? 'Service',
      coding: s.activityDefinition.code?.coding,
    })),
    start: baseStartTime.toISOString(),
    end: endTime.toISOString(),
    description: notes || undefined,
    participant: Array.from(participantSet.values()) as any,
    extension: [
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/total-services',
        valueInteger: services.length,
      },
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-required',
        valueMoney: { value: depositAmount, currency: 'USD' },
      },
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/booking-type',
        valueString: 'multi-service',
      },
    ],
  };

  // Create ServiceRequests for each service
  const serviceRequests: ServiceRequest[] = [];

  for (const timing of serviceTimings) {
    const service = timing.serviceConfig;
    const config = parseServiceConfig(service.activityDefinition);

    const srDetails: ServiceRequestDetails = {
      assignedRoom: service.assignedRoom,
      assignedEquipment: service.assignedEquipment,
      serviceSequence: service.serviceSequence,
      linkedServices: service.linkedServiceIds?.map((id) => ({
        reference: `ServiceRequest/${id}`,
      })),
      serviceStatus: 'pending',
      actualDuration: service.duration,
    };

    const serviceRequest: ServiceRequest = {
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      code: service.activityDefinition.code,
      subject: createReference(patient),
      requester: service.assignedProvider,
      authoredOn: new Date().toISOString(),
      occurrenceDateTime: timing.startTime.toISOString(),
      extension: [
        ...buildServiceRequestExtensions(srDetails),
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
          valueReference: { reference: 'Appointment/TEMP' }, // Will be updated after appointment creation
        },
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/service-start-time',
          valueDateTime: timing.startTime.toISOString(),
        },
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/service-end-time',
          valueDateTime: timing.endTime.toISOString(),
        },
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/internal-cost',
          valueString: JSON.stringify(config.internalCost),
        },
      ],
    };

    serviceRequests.push(serviceRequest);
  }

  return {
    appointment,
    serviceRequests,
    totalDuration,
    serviceTimings,
  };
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Check for scheduling conflicts
 * Returns warnings for overlapping bookings
 * @param services - List of services with assigned resources and timings
 * @param timings - Calculated timings for each service
 * @param medplum - Medplum client for performing searches
 * @param medplum.search -  Function to perform FHIR searches against the server
 * @returns List of detected conflicts with severity and messages
 */
export async function checkConflicts(
  services: ServiceConfiguration[],
  timings: CalculatedServiceTiming[],
  medplum: {
    search: (resourceType: string, params: Record<string, string>) => Promise<{ entry?: { resource: unknown }[] }>;
  }
): Promise<ConflictCheck[]> {
  const conflicts: ConflictCheck[] = [];

  for (const timing of timings) {
    const start = timing.startTime.toISOString();
    const end = timing.endTime.toISOString();

    // Check provider conflicts
    if (timing.serviceConfig.assignedProvider) {
      const providerId = timing.serviceConfig.assignedProvider.reference?.split('/')[1];
      if (providerId) {
        const providerConflicts = await checkProviderConflicts(medplum, providerId, start, end);
        conflicts.push(...providerConflicts);
      }
    }

    // Check room conflicts
    if (timing.serviceConfig.assignedRoom) {
      const roomId = timing.serviceConfig.assignedRoom.reference?.split('/')[1];
      if (roomId) {
        const roomConflicts = await checkRoomConflicts(medplum, roomId, start, end);
        conflicts.push(...roomConflicts);
      }
    }

    // Check equipment conflicts
    if (timing.serviceConfig.assignedEquipment) {
      for (const equipment of timing.serviceConfig.assignedEquipment) {
        const equipmentId = equipment.reference?.split('/')[1];
        if (equipmentId) {
          const equipmentConflicts = await checkEquipmentConflicts(medplum, equipmentId, start, end);
          conflicts.push(...equipmentConflicts);
        }
      }
    }
  }

  return conflicts;
}

async function checkProviderConflicts(
  medplum: {
    search: (resourceType: string, params: Record<string, string>) => Promise<{ entry?: { resource: unknown }[] }>;
  },
  providerId: string,
  start: string,
  end: string
): Promise<ConflictCheck[]> {
  const conflicts: ConflictCheck[] = [];

  try {
    // Search for appointments where this provider is a participant
    const result = await medplum.search('Appointment', {
      date: `ge${start}`,
      _count: '100',
    });

    // Filter client-side for overlapping times
    const appointments = (result.entry || [])
      .map((e) => e.resource as Appointment)
      .filter(
        (a) =>
          a.participant?.some((p) => p.actor?.reference?.includes(providerId)) &&
          // Overlapping check
          ((a.start && a.start < end && a.start >= start) ||
            (a.end && a.end > start && a.end <= end) ||
            (a.start && a.end && a.start <= start && a.end >= end))
      );

    for (const appt of appointments) {
      conflicts.push({
        type: 'provider',
        resourceId: providerId,
        resourceName: 'Provider',
        conflictingTime: new Date(appt.start || start),
        severity: 'warning',
        message: `Provider has another appointment at ${dayjs(appt.start).format('h:mm A')}`,
      });
    }
  } catch (err) {
    console.error('Error checking provider conflicts:', err);
  }

  return conflicts;
}

async function checkRoomConflicts(
  medplum: {
    search: (resourceType: string, params: Record<string, string>) => Promise<{ entry?: { resource: unknown }[] }>;
  },
  roomId: string,
  start: string,
  end: string
): Promise<ConflictCheck[]> {
  const conflicts: ConflictCheck[] = [];

  try {
    // Search for ServiceRequests with this room in the time range
    // Note: This would need a custom search parameter or use extension search
    // For now, we'll check appointments with room extension
    const result = await medplum.search('Appointment', {
      date: `ge${start}`,
      _count: '100',
    });

    // Filter client-side
    const appointments = (result.entry || [])
      .map((e) => e.resource as Appointment)
      .filter((a) => {
        const roomExt = a.extension?.find((e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/room');
        return (
          roomExt?.valueString?.includes(roomId) &&
          ((a.start && a.start < end && a.start >= start) ||
            (a.end && a.end > start && a.end <= end) ||
            (a.start && a.end && a.start <= start && a.end >= end))
        );
      });

    for (const appt of appointments) {
      conflicts.push({
        type: 'room',
        resourceId: roomId,
        resourceName: 'Room',
        conflictingTime: new Date(appt.start || start),
        severity: 'warning',
        message: `Room is booked at ${dayjs(appt.start).format('h:mm A')}`,
      });
    }
  } catch (err) {
    console.error('Error checking room conflicts:', err);
  }

  return conflicts;
}

async function checkEquipmentConflicts(
  medplum: {
    search: (resourceType: string, params: Record<string, string>) => Promise<{ entry?: { resource: unknown }[] }>;
  },
  equipmentId: string,
  start: string,
  end: string
): Promise<ConflictCheck[]> {
  const conflicts: ConflictCheck[] = [];

  try {
    // Search for ServiceRequests with this equipment assigned
    const result = await medplum.search('ServiceRequest', {
      authoredOn: `ge${start}`,
      _count: '100',
    });

    // Filter client-side for equipment
    const serviceRequests = (result.entry || [])
      .map((e) => e.resource as ServiceRequest)
      .filter((sr) => {
        const equipmentExts = sr.extension?.filter(
          (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/assigned-equipment'
        );
        return (
          equipmentExts?.some((e) => e.valueReference?.reference?.includes(equipmentId)) &&
          // Check time overlap using occurrenceDateTime or extensions
          sr.occurrenceDateTime &&
          ((sr.occurrenceDateTime >= start && sr.occurrenceDateTime < end) ||
            (sr.occurrenceDateTime <= start && sr.occurrenceDateTime > end))
        );
      });

    for (const sr of serviceRequests) {
      conflicts.push({
        type: 'equipment',
        resourceId: equipmentId,
        resourceName: 'Equipment',
        conflictingTime: new Date(sr.occurrenceDateTime || start),
        severity: 'warning',
        message: `Equipment is in use at ${dayjs(sr.occurrenceDateTime).format('h:mm A')}`,
      });
    }
  } catch (err) {
    console.error('Error checking equipment conflicts:', err);
  }

  return conflicts;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate room/equipment compatibility
 * Returns warnings if equipment is not available in selected room
 * @param service - Service configuration to validate
 * @returns Validation result with warnings if any
 */
export function validateRoomEquipmentCompatibility(service: ServiceConfiguration): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const config = parseServiceConfig(service.activityDefinition);

  // Check if non-movable equipment is in a different room
  for (const equipmentReq of config.equipmentRequirements) {
    if (!equipmentReq.movable) {
      // In real implementation, check if equipment is actually in the assigned room
      // For now, just warn based on the requirement
      const assignedEquipment = service.assignedEquipment?.find((e) =>
        e.reference?.includes(equipmentReq.equipmentType)
      );

      if (assignedEquipment && service.assignedRoom) {
        // This would check the equipment's actual location
        // For now, just add an informational warning
        warnings.push(`${equipmentReq.equipmentType} is typically fixed to a specific room`);
      }
    }
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Validate the entire booking configuration
 * @param services - List of services to validate
 * @returns Validation result with errors if any
 */
export function validateBookingConfiguration(services: ServiceConfiguration[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (services.length === 0) {
    errors.push('At least one service is required');
    return { valid: false, errors };
  }

  // Check for duplicate sequences
  const sequences = services.map((s) => s.serviceSequence);
  const uniqueSequences = new Set(sequences);
  if (sequences.length !== uniqueSequences.size) {
    errors.push('Service sequences must be unique');
  }

  // Check each service has minimum required fields
  for (const service of services) {
    if (!service.activityDefinition) {
      errors.push('Service must have an ActivityDefinition');
    }
    if (service.duration <= 0) {
      errors.push('Service duration must be greater than 0');
    }
  }

  return { valid: errors.length === 0, errors };
}
