// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * FHIR Extension Utilities for Nurse Mel MedSpa
 *
 * This file contains helper functions for parsing and building FHIR extensions
 * used throughout the application for service configuration, equipment assignment,
 * room assignment, and cost tracking.
 */

import type { ActivityDefinition, Device, Extension, Reference, ServiceRequest } from '@medplum/fhirtypes';

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
    serviceNotes: 'http://melissaknudson.com/fhir/StructureDefinition/service-notes',
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
    practitionerColor: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
  },
} as const;

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface EquipmentRequirement {
  equipmentType: string; // e.g., 'laser', 'cooling-system'
  equipmentReference?: Reference; // Optional: specific device
  equipmentName?: string; // Display name
  required: boolean; // Is this equipment required for the service
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
  // numbingTime removed - now handled via recommended accompanying services
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
  // Deposit configuration removed - now handled at booking level
  // depositAmount: number;
  // depositReminders: number;
  // depositReminderInterval: number;
  followUpSchedule: { hours: number; message: string }[];
  providerRates: { providerId: string; providerName: string; pricePerUnit: number }[];
  // New fields
  equipmentRequirements: EquipmentRequirement[];
  recommendedAccompanyingServices: RecommendedAccompanyingService[];
  internalCost: InternalCost;
  // Provider requirements - NEW
  mainProviderRequired: boolean; // Default: true (required), toggle to false (optional)
  assistantRequired: boolean; // Default: false (optional), toggle to true (required)
  // Consent - NEW
  consentRequired: boolean; // Default: true - patient must sign consent
  consentCategory?: string; // e.g., 'botox-treatment' for grouping
  consentText?: string; // HTML consent text template
  consentVersion?: string; // Version tracking
}

export interface ServiceRequestDetails {
  assignedRoom?: Reference;
  assignedEquipment?: Reference[];
  serviceSequence?: number;
  linkedServices?: Reference[];
  serviceStatus?: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  actualDuration?: number; // Minutes
  serviceNotes?: string; // Per-service notes from booking modal
}

// ============================================================================
// ServiceRequest Extension Helpers
// ============================================================================

export function parseServiceRequestExtensions(sr: ServiceRequest): ServiceRequestDetails {
  const result: ServiceRequestDetails = {};

  // Assigned Room
  const roomExt = sr.extension?.find((e) => e.url === EXTENSION_URLS.serviceRequest.assignedRoom);
  if (roomExt?.valueReference) {
    result.assignedRoom = roomExt.valueReference;
  }

  // Assigned Equipment (array)
  const equipmentExts = sr.extension?.filter((e) => e.url === EXTENSION_URLS.serviceRequest.assignedEquipment) || [];
  if (equipmentExts.length > 0) {
    result.assignedEquipment = equipmentExts
      .map((e) => e.valueReference)
      .filter((ref): ref is Reference => ref !== undefined);
  }

  // Service Sequence
  const sequenceExt = sr.extension?.find((e) => e.url === EXTENSION_URLS.serviceRequest.serviceSequence);
  if (sequenceExt?.valueInteger !== undefined) {
    result.serviceSequence = sequenceExt.valueInteger;
  }

  // Linked Services
  const linkedExts = sr.extension?.filter((e) => e.url === EXTENSION_URLS.serviceRequest.linkedServices) || [];
  if (linkedExts.length > 0) {
    result.linkedServices = linkedExts
      .map((e) => e.valueReference)
      .filter((ref): ref is Reference => ref !== undefined);
  }

  // Service Status
  const statusExt = sr.extension?.find((e) => e.url === EXTENSION_URLS.serviceRequest.serviceStatus);
  if (statusExt?.valueString) {
    result.serviceStatus = statusExt.valueString as ServiceRequestDetails['serviceStatus'];
  }

  // Actual Duration
  const durationExt = sr.extension?.find((e) => e.url === EXTENSION_URLS.serviceRequest.actualDuration);
  if (durationExt?.valueInteger !== undefined) {
    result.actualDuration = durationExt.valueInteger;
  }

  // Service Notes
  const notesExt = sr.extension?.find((e) => e.url === EXTENSION_URLS.serviceRequest.serviceNotes);
  if (notesExt?.valueString) {
    result.serviceNotes = notesExt.valueString;
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

  // Service Notes
  if (details.serviceNotes) {
    extensions.push({
      url: EXTENSION_URLS.serviceRequest.serviceNotes,
      valueString: details.serviceNotes,
    });
  }

  return extensions;
}

// ============================================================================
// ActivityDefinition (Service) Extension Helpers
// ============================================================================

export function parseServiceConfig(activity: ActivityDefinition): ServiceConfig {
  const ext = activity.extension?.find((e) => e.url === EXTENSION_URLS.activityDefinition.serviceConfig);

  // NEW FORMAT: Parse single JSON string value
  if (ext?.valueString) {
    try {
      const parsed = JSON.parse(ext.valueString);
      return {
        // numbingTime removed - handled via recommended accompanying services
        defaultRoom: parsed.defaultRoom ?? 'room-1',
      roomMovable: parsed.roomMovable ?? true,
      minPrice: parsed.minPrice ?? 0,
      maxPrice: parsed.maxPrice ?? 0,
      pricePerUnit: parsed.pricePerUnit ?? false,
      unitType: parsed.unitType ?? 'unit',
      gfeCategory: parsed.gfeCategory ?? '',
      requiresConsult: parsed.requiresConsult ?? false,
      icon: parsed.icon ?? '',
      color: parsed.color ?? 'blue',
      category: parsed.category ?? 'other',
      // Deposit configuration removed - now handled at booking level
      // depositAmount: parsed.depositAmount ?? 250,
      // depositReminders: parsed.depositReminders ?? 4,
      // depositReminderInterval: parsed.depositReminderInterval ?? 24,
      followUpSchedule: parsed.followUpSchedule || [],
      providerRates: parsed.providerRates || [],
      equipmentRequirements: parsed.equipmentRequirements || [],
      recommendedAccompanyingServices: parsed.recommendedAccompanyingServices || [],
      internalCost: parsed.internalCost || { productCost: 0, costPerUnit: false, unitType: 'unit' },
      // Provider requirements - NEW
      mainProviderRequired: parsed.mainProviderRequired ?? true, // Default: required
      assistantRequired: parsed.assistantRequired ?? false, // Default: optional
      // Consent - NEW
      consentRequired: parsed.consentRequired ?? true, // Default: required
      consentCategory: parsed.consentCategory,
      consentText: parsed.consentText,
      consentVersion: parsed.consentVersion,
    };
    } catch (err) {
      console.error('Failed to parse service config JSON:', err);
    }
  }

  // OLD FORMAT: Backward compatibility - parse individual extensions (for existing services)
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
  const equipmentReqsRaw = ext?.extension?.find((e) => e.url === 'equipmentRequirements')?.valueString;
  let equipmentRequirements: EquipmentRequirement[] = [];
  if (equipmentReqsRaw) {
    try {
      equipmentRequirements = JSON.parse(equipmentReqsRaw);
    } catch {
      equipmentRequirements = [];
    }
  }

  // Parse recommended accompanying services
  const recommendedServicesRaw = ext?.extension?.find((e) => e.url === 'recommendedAccompanyingServices')?.valueString;
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

  // Parse consent configuration from JSON config if available
  const jsonConfig = ext?.valueString;
  let consentRequired = true; // Default for safety
  let consentCategory: string | undefined;
  let consentText: string | undefined;
  let consentVersion: string | undefined;
  
  if (jsonConfig) {
    try {
      const parsed = JSON.parse(jsonConfig);
      // Use explicit value from config, default to true only if undefined
      consentRequired = parsed.consentRequired !== undefined ? parsed.consentRequired : true;
      consentCategory = parsed.consentCategory;
      consentText = parsed.consentText;
      consentVersion = parsed.consentVersion;
    } catch {
      // Keep defaults
    }
  }

  return {
    // numbingTime removed - handled via recommended accompanying services
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
    // Deposit configuration removed - now handled at booking level
    // For backward compatibility, return undefined/zero values
    // depositAmount: ext?.extension?.find((e) => e.url === 'depositAmount')?.valueInteger ?? 250,
    // depositReminders: ext?.extension?.find((e) => e.url === 'depositReminders')?.valueInteger ?? 4,
    // depositReminderInterval: ext?.extension?.find((e) => e.url === 'depositReminderInterval')?.valueInteger ?? 24,
    followUpSchedule,
    providerRates,
    // New fields
    equipmentRequirements,
    recommendedAccompanyingServices,
    internalCost,
    // Provider requirements - NEW (defaults for backward compatibility)
    mainProviderRequired: true,
    assistantRequired: false,
    // Consent - NEW (read from JSON config, default to true for safety)
    consentRequired,
    consentCategory,
    consentText,
    consentVersion,
  };
}

export function buildServiceConfigExtensions(config: ServiceConfig): Extension[] {
  // Store entire config as a single JSON string to avoid nested extension validation issues
  // This is simpler and avoids FHIR constraint ext-1 violations
  const configForSerialization = {
    // numbingTime removed - handled via recommended accompanying services
    defaultRoom: config.defaultRoom,
    roomMovable: config.roomMovable,
    minPrice: config.minPrice,
    maxPrice: config.maxPrice,
    pricePerUnit: config.pricePerUnit,
    unitType: config.unitType,
    requiresConsult: config.requiresConsult,
    icon: config.icon || '',
    color: config.color,
    category: config.category,
    // depositAmount: config.depositAmount,
    // depositReminders: config.depositReminders,
    // depositReminderInterval: config.depositReminderInterval,
    gfeCategory: config.gfeCategory || '',
    followUpSchedule: config.followUpSchedule || [],
    providerRates: config.providerRates || [],
    equipmentRequirements: config.equipmentRequirements || [],
    recommendedAccompanyingServices: config.recommendedAccompanyingServices || [],
    internalCost: config.internalCost || { productCost: 0, costPerUnit: false },
    // Provider requirements - NEW
    mainProviderRequired: config.mainProviderRequired ?? true,
    assistantRequired: config.assistantRequired ?? false,
    // Consent - NEW
    consentRequired: config.consentRequired ?? true,
    consentCategory: config.consentCategory,
    consentText: config.consentText,
    consentVersion: config.consentVersion,
  };

  return [
    {
      url: EXTENSION_URLS.activityDefinition.serviceConfig,
      valueString: JSON.stringify(configForSerialization),
    },
  ];
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateRoomEquipmentCompatibility(
  roomId: string,
  equipment: { equipmentType: string }[]
): { compatible: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const compatible = true;

  // Note: Equipment movability should be checked against Device resource properties
  // when equipment management is implemented. For now, this validation is skipped.

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
