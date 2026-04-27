// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * FHIR Extension Utilities for Nurse Mel MedSpa
 *
 * This file contains helper functions for parsing and building FHIR extensions
 * used throughout the application for service configuration, equipment assignment,
 * room assignment, and cost tracking.
 */

import type { ActivityDefinition, Extension, Reference, ServiceRequest } from '@medplum/fhirtypes';

// ============================================================================
// Extension URLs
// ============================================================================

export const EXTENSION_URLS = {
  // ServiceRequest extensions
  serviceRequest: {
    assignedRoom: 'http://melissaknudson.com/fhir/StructureDefinition/assigned-room',
    assignedEquipment: 'http://melissaknudson.com/fhir/StructureDefinition/assigned-equipment',
    serviceSequence: 'http://melissaknudson.com/fhir/StructureDefinition/service-sequence',
    linkedServices: 'http://melissaknudson.com/fhir/StructureDefinition/linked-services',
    serviceStatus: 'http://melissaknudson.com/fhir/StructureDefinition/service-status',
    actualDuration: 'http://melissaknudson.com/fhir/StructureDefinition/actual-duration',
  },
  // ActivityDefinition (Service Catalog) extensions
  activityDefinition: {
    serviceConfig: 'http://melissaknudson.com/fhir/StructureDefinition/service-config',
    equipmentRequirements: 'http://melissaknudson.com/fhir/StructureDefinition/equipment-requirements',
    recommendedAccompanyingServices:
      'http://melissaknudson.com/fhir/StructureDefinition/recommended-accompanying-services',
    internalCost: 'http://melissaknudson.com/fhir/StructureDefinition/internal-cost',
  },
  // Common extensions
  common: {
    linkedAppointment: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
    room: 'http://melissaknudson.com/fhir/StructureDefinition/room',
    depositInfo: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
  },
} as const;

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface EquipmentRequirement {
  equipmentType: string; // e.g., 'laser', 'cooling-system'
  required: boolean;
  movable: boolean; // Can equipment be moved to different room
}

export interface RecommendedAccompanyingService {
  serviceCode: string; // e.g., 'topical-numbing'
  timing: 'before' | 'after' | 'concurrent';
  offsetMinutes: number; // Time offset from main service
}

export interface InternalCost {
  productCost: number; // Cost of materials/products used (flat OR per unit)
  costPerUnit: boolean; // If true, cost is per unit (e.g., per Botox unit)
  unitType?: string; // e.g., 'unit', 'syringe', 'area' - for display purposes
  notes?: string;
}

export interface ServiceConfig {
  numbingTime: number;
  defaultRoom: string;
  roomMovable: boolean;
  minPrice: number;
  maxPrice: number;
  pricePerUnit: boolean;
  unitType: string;
  gfeCategory: string;
  requiresConsult: boolean;
  icon: string;
  color: string;
  category: string;
  depositAmount: number;
  depositReminders: number;
  depositReminderInterval: number;
  followUpSchedule: { hours: number; message: string }[];
  providerRates: { providerId: string; providerName: string; pricePerUnit: number }[];
  // New fields
  equipmentRequirements: EquipmentRequirement[];
  recommendedAccompanyingServices: RecommendedAccompanyingService[];
  internalCost: InternalCost;
}

export interface ServiceRequestDetails {
  assignedRoom?: Reference;
  assignedEquipment?: Reference[];
  serviceSequence?: number;
  linkedServices?: Reference[];
  serviceStatus?: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  actualDuration?: number; // Minutes
}

// ============================================================================
// ServiceRequest Extension Helpers
// ============================================================================

export function parseServiceRequestExtensions(sr: ServiceRequest): ServiceRequestDetails {
  const result: ServiceRequestDetails = {};

  // Assigned Room
  const roomExt = sr.extension?.find(
    (e) => e.url === EXTENSION_URLS.serviceRequest.assignedRoom
  );
  if (roomExt?.valueReference) {
    result.assignedRoom = roomExt.valueReference;
  }

  // Assigned Equipment (array)
  const equipmentExts =
    sr.extension?.filter((e) => e.url === EXTENSION_URLS.serviceRequest.assignedEquipment) || [];
  if (equipmentExts.length > 0) {
    result.assignedEquipment = equipmentExts
      .map((e) => e.valueReference)
      .filter((ref): ref is Reference => ref !== undefined);
  }

  // Service Sequence
  const sequenceExt = sr.extension?.find(
    (e) => e.url === EXTENSION_URLS.serviceRequest.serviceSequence
  );
  if (sequenceExt?.valueInteger !== undefined) {
    result.serviceSequence = sequenceExt.valueInteger;
  }

  // Linked Services
  const linkedExts =
    sr.extension?.filter((e) => e.url === EXTENSION_URLS.serviceRequest.linkedServices) || [];
  if (linkedExts.length > 0) {
    result.linkedServices = linkedExts
      .map((e) => e.valueReference)
      .filter((ref): ref is Reference => ref !== undefined);
  }

  // Service Status
  const statusExt = sr.extension?.find(
    (e) => e.url === EXTENSION_URLS.serviceRequest.serviceStatus
  );
  if (statusExt?.valueString) {
    result.serviceStatus = statusExt.valueString as ServiceRequestDetails['serviceStatus'];
  }

  // Actual Duration
  const durationExt = sr.extension?.find(
    (e) => e.url === EXTENSION_URLS.serviceRequest.actualDuration
  );
  if (durationExt?.valueInteger !== undefined) {
    result.actualDuration = durationExt.valueInteger;
  }

  return result;
}

export function buildServiceRequestExtensions(details: ServiceRequestDetails): Extension[] {
  const extensions: Extension[] = [];

  if (details.assignedRoom) {
    extensions.push({
      url: EXTENSION_URLS.serviceRequest.assignedRoom,
      valueReference: details.assignedRoom,
    });
  }

  if (details.assignedEquipment && details.assignedEquipment.length > 0) {
    for (const equipment of details.assignedEquipment) {
      extensions.push({
        url: EXTENSION_URLS.serviceRequest.assignedEquipment,
        valueReference: equipment,
      });
    }
  }

  if (details.serviceSequence !== undefined) {
    extensions.push({
      url: EXTENSION_URLS.serviceRequest.serviceSequence,
      valueInteger: details.serviceSequence,
    });
  }

  if (details.linkedServices && details.linkedServices.length > 0) {
    for (const linked of details.linkedServices) {
      extensions.push({
        url: EXTENSION_URLS.serviceRequest.linkedServices,
        valueReference: linked,
      });
    }
  }

  if (details.serviceStatus) {
    extensions.push({
      url: EXTENSION_URLS.serviceRequest.serviceStatus,
      valueString: details.serviceStatus,
    });
  }

  if (details.actualDuration !== undefined) {
    extensions.push({
      url: EXTENSION_URLS.serviceRequest.actualDuration,
      valueInteger: details.actualDuration,
    });
  }

  return extensions;
}

// ============================================================================
// ActivityDefinition (Service) Extension Helpers
// ============================================================================

export function parseServiceConfig(activity: ActivityDefinition): ServiceConfig {
  const ext = activity.extension?.find(
    (e) => e.url === EXTENSION_URLS.activityDefinition.serviceConfig
  );

  // Parse follow-up schedule from JSON string
  const followUpScheduleRaw = ext?.extension?.find((e) => e.url === 'followUpSchedule')?.valueString;
  let followUpSchedule: { hours: number; message: string }[] = [];
  if (followUpScheduleRaw) {
    try {
      followUpSchedule = JSON.parse(followUpScheduleRaw);
    } catch {
      followUpSchedule = [];
    }
  }

  // Parse provider rates from JSON string
  const providerRatesRaw = ext?.extension?.find((e) => e.url === 'providerRates')?.valueString;
  let providerRates: { providerId: string; providerName: string; pricePerUnit: number }[] = [];
  if (providerRatesRaw) {
    try {
      providerRates = JSON.parse(providerRatesRaw);
    } catch {
      providerRates = [];
    }
  }

  // Parse equipment requirements
  const equipmentReqsRaw = ext?.extension?.find(
    (e) => e.url === 'equipmentRequirements'
  )?.valueString;
  let equipmentRequirements: EquipmentRequirement[] = [];
  if (equipmentReqsRaw) {
    try {
      equipmentRequirements = JSON.parse(equipmentReqsRaw);
    } catch {
      equipmentRequirements = [];
    }
  }

  // Parse recommended accompanying services
  const recommendedServicesRaw = ext?.extension?.find(
    (e) => e.url === 'recommendedAccompanyingServices'
  )?.valueString;
  let recommendedAccompanyingServices: RecommendedAccompanyingService[] = [];
  if (recommendedServicesRaw) {
    try {
      recommendedAccompanyingServices = JSON.parse(recommendedServicesRaw);
    } catch {
      recommendedAccompanyingServices = [];
    }
  }

  // Parse internal cost
  const internalCostRaw = ext?.extension?.find((e) => e.url === 'internalCost')?.valueString;
  let internalCost: InternalCost = { productCost: 0, costPerUnit: false };
  if (internalCostRaw) {
    try {
      const parsed = JSON.parse(internalCostRaw);
      internalCost = {
        productCost: parsed.productCost ?? 0,
        costPerUnit: parsed.costPerUnit ?? false,
        unitType: parsed.unitType,
        notes: parsed.notes,
      };
    } catch {
      internalCost = { productCost: 0, costPerUnit: false };
    }
  }

  return {
    numbingTime: ext?.extension?.find((e) => e.url === 'numbingTime')?.valueInteger ?? 0,
    defaultRoom: ext?.extension?.find((e) => e.url === 'defaultRoom')?.valueString ?? 'room-1',
    roomMovable: ext?.extension?.find((e) => e.url === 'roomMovable')?.valueBoolean ?? true,
    minPrice: ext?.extension?.find((e) => e.url === 'minPrice')?.valueInteger ?? 0,
    maxPrice: ext?.extension?.find((e) => e.url === 'maxPrice')?.valueInteger ?? 0,
    pricePerUnit: ext?.extension?.find((e) => e.url === 'pricePerUnit')?.valueBoolean ?? false,
    unitType: ext?.extension?.find((e) => e.url === 'unitType')?.valueString ?? 'unit',
    gfeCategory: ext?.extension?.find((e) => e.url === 'gfeCategory')?.valueString ?? '',
    requiresConsult: ext?.extension?.find((e) => e.url === 'requiresConsult')?.valueBoolean ?? false,
    icon: ext?.extension?.find((e) => e.url === 'icon')?.valueString ?? '',
    color: ext?.extension?.find((e) => e.url === 'color')?.valueString ?? 'blue',
    category: ext?.extension?.find((e) => e.url === 'category')?.valueString ?? 'other',
    depositAmount: ext?.extension?.find((e) => e.url === 'depositAmount')?.valueInteger ?? 250,
    depositReminders: ext?.extension?.find((e) => e.url === 'depositReminders')?.valueInteger ?? 4,
    depositReminderInterval:
      ext?.extension?.find((e) => e.url === 'depositReminderInterval')?.valueInteger ?? 24,
    followUpSchedule,
    providerRates,
    // New fields
    equipmentRequirements,
    recommendedAccompanyingServices,
    internalCost,
  };
}

export function buildServiceConfigExtensions(config: ServiceConfig): Extension[] {
  const extensions: { url: string; [key: string]: unknown }[] = [
    { url: 'numbingTime', valueInteger: config.numbingTime },
    { url: 'defaultRoom', valueString: config.defaultRoom },
    { url: 'roomMovable', valueBoolean: config.roomMovable },
    { url: 'minPrice', valueInteger: config.minPrice },
    { url: 'maxPrice', valueInteger: config.maxPrice },
    { url: 'pricePerUnit', valueBoolean: config.pricePerUnit },
    { url: 'unitType', valueString: config.unitType },
    { url: 'requiresConsult', valueBoolean: config.requiresConsult },
    { url: 'color', valueString: config.color },
    { url: 'category', valueString: config.category },
    { url: 'depositAmount', valueInteger: config.depositAmount },
    { url: 'depositReminders', valueInteger: config.depositReminders },
    { url: 'depositReminderInterval', valueInteger: config.depositReminderInterval },
  ];

  // Only add optional fields if they have values
  if (config.gfeCategory) {
    extensions.push({ url: 'gfeCategory', valueString: config.gfeCategory });
  }
  if (config.icon) {
    extensions.push({ url: 'icon', valueString: config.icon });
  }
  if (config.followUpSchedule && config.followUpSchedule.length > 0) {
    extensions.push({ url: 'followUpSchedule', valueString: JSON.stringify(config.followUpSchedule) });
  }
  if (config.providerRates && config.providerRates.length > 0) {
    extensions.push({ url: 'providerRates', valueString: JSON.stringify(config.providerRates) });
  }
  if (config.equipmentRequirements && config.equipmentRequirements.length > 0) {
    extensions.push({
      url: 'equipmentRequirements',
      valueString: JSON.stringify(config.equipmentRequirements),
    });
  }
  if (config.recommendedAccompanyingServices && config.recommendedAccompanyingServices.length > 0) {
    extensions.push({
      url: 'recommendedAccompanyingServices',
      valueString: JSON.stringify(config.recommendedAccompanyingServices),
    });
  }
  if (config.internalCost) {
    extensions.push({ url: 'internalCost', valueString: JSON.stringify(config.internalCost) });
  }

  return [
    {
      url: EXTENSION_URLS.activityDefinition.serviceConfig,
      extension: extensions,
    },
  ];
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateRoomEquipmentCompatibility(
  roomId: string,
  equipment: { equipmentType: string; movable: boolean }[]
): { compatible: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let compatible = true;

  for (const eq of equipment) {
    if (!eq.movable) {
      // This would check if the room actually has this equipment
      // For now, we'll return a warning that needs to be implemented with actual room data
      warnings.push(`${eq.equipmentType} is not movable and must be in its assigned room`);
    }
  }

  return { compatible, warnings };
}

export function calculateServiceSequenceTimes(
  services: { duration: number; sequence: number }[],
  startTime: Date
): { sequence: number; startTime: Date; endTime: Date }[] {
  const sorted = [...services].sort((a, b) => a.sequence - b.sequence);
  const result: { sequence: number; startTime: Date; endTime: Date }[] = [];

  let currentTime = new Date(startTime);
  for (const service of sorted) {
    const endTime = new Date(currentTime.getTime() + service.duration * 60000);
    result.push({
      sequence: service.sequence,
      startTime: new Date(currentTime),
      endTime,
    });
    currentTime = endTime;
  }

  return result;
}
