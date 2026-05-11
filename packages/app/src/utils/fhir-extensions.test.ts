import type { ServiceRequest, Procedure, Appointment, ActivityDefinition, Extension, Reference } from '@medplum/fhirtypes';
import {
  parseServiceRequestExtensions,
  buildServiceRequestExtensions,
  parseServiceConfig,
  buildServiceConfigExtensions,
  validateRoomEquipmentCompatibility,
  calculateServiceSequenceTimes,
} from './fhir-extensions';

describe('FHIR Extensions Utilities', () => {
  describe('parseServiceRequestExtensions', () => {
    test('should parse assignedRoom from ServiceRequest', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
        extension: [
          { url: 'http://melissaknudson.com/fhir/StructureDefinition/assigned-room', valueReference: { reference: 'Location/room-1' } },
        ],
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.assignedRoom).toBeDefined();
      expect(result.assignedRoom?.reference).toBe('Location/room-1');
    });

    test('should return undefined assignedRoom if extension missing', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
        extension: [],
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.assignedRoom).toBeUndefined();
    });

    test('should parse assignedEquipment array from ServiceRequest', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
        extension: [
          { url: 'http://melissaknudson.com/fhir/StructureDefinition/assigned-equipment', valueReference: { reference: 'Device/laser-1' } },
          { url: 'http://melissaknudson.com/fhir/StructureDefinition/assigned-equipment', valueReference: { reference: 'Device/cooler-1' } },
        ],
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.assignedEquipment).toHaveLength(2);
      expect(result.assignedEquipment?.[0].reference).toBe('Device/laser-1');
      expect(result.assignedEquipment?.[1].reference).toBe('Device/cooler-1');
    });

    test('should return empty array if no equipment assigned', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
        extension: [],
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.assignedEquipment).toBeUndefined();
    });

    test('should parse serviceSequence from ServiceRequest', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
        extension: [
          { url: 'http://melissaknudson.com/fhir/StructureDefinition/service-sequence', valueInteger: 2 },
        ],
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.serviceSequence).toBe(2);
    });

    test('should return undefined serviceSequence if not set', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.serviceSequence).toBeUndefined();
    });

    test('should parse linkedServices from ServiceRequest', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
        extension: [
          { url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-services', valueReference: { reference: 'ServiceRequest/sr-2' } },
        ],
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.linkedServices).toHaveLength(1);
      expect(result.linkedServices?.[0].reference).toBe('ServiceRequest/sr-2');
    });

    test('should parse serviceStatus from ServiceRequest', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
        extension: [
          { url: 'http://melissaknudson.com/fhir/StructureDefinition/service-status', valueString: 'in-progress' },
        ],
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.serviceStatus).toBe('in-progress');
    });

    test('should default serviceStatus to undefined if not set', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.serviceStatus).toBeUndefined();
    });

    test('should parse actualDuration from ServiceRequest', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
        extension: [
          { url: 'http://melissaknudson.com/fhir/StructureDefinition/actual-duration', valueInteger: 45 },
        ],
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.actualDuration).toBe(45);
    });

    test('should return undefined actualDuration if not recorded', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.actualDuration).toBeUndefined();
    });

    test('should parse serviceNotes from ServiceRequest', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
        extension: [
          { url: 'http://melissaknudson.com/fhir/StructureDefinition/service-notes', valueString: 'Apply ice after treatment' },
        ],
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.serviceNotes).toBe('Apply ice after treatment');
    });

    test('should return undefined serviceNotes if no notes', () => {
      const sr: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Test' },
      };
      const result = parseServiceRequestExtensions(sr);
      expect(result.serviceNotes).toBeUndefined();
    });
  });

  describe('buildServiceRequestExtensions', () => {
    test('should build extensions from ServiceRequestDetails', () => {
      const details = {
        assignedRoom: { reference: 'Location/room-1' },
        assignedEquipment: [{ reference: 'Device/laser-1' }],
        serviceSequence: 1,
        linkedServices: [{ reference: 'ServiceRequest/sr-2' }],
        serviceStatus: 'pending' as const,
        actualDuration: 30,
        serviceNotes: 'Test note',
      };
      const exts = buildServiceRequestExtensions(details);
      expect(exts).toHaveLength(7);
      expect(exts.find((e) => e.url.includes('assigned-room'))?.valueReference?.reference).toBe('Location/room-1');
      expect(exts.find((e) => e.url.includes('service-sequence'))?.valueInteger).toBe(1);
      expect(exts.find((e) => e.url.includes('actual-duration'))?.valueInteger).toBe(30);
      expect(exts.find((e) => e.url.includes('service-notes'))?.valueString).toBe('Test note');
    });

    test('should return empty array if no details provided', () => {
      const exts = buildServiceRequestExtensions({});
      expect(exts).toHaveLength(0);
    });

    test('should skip undefined optional fields', () => {
      const details = { serviceSequence: 1 };
      const exts = buildServiceRequestExtensions(details);
      expect(exts).toHaveLength(1);
      expect(exts[0].url).toContain('service-sequence');
    });
  });

  describe('parseServiceConfig', () => {
    test('should parse new JSON format from ActivityDefinition', () => {
      const config = {
        defaultRoom: 'room-2',
        roomMovable: false,
        minPrice: 100,
        maxPrice: 500,
        category: 'injectables',
        icon: 'syringe',
      };
      const activity: ActivityDefinition = {
        resourceType: 'ActivityDefinition',
        id: 'ad-1',
        status: 'active',
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/service-config',
            valueString: JSON.stringify(config),
          },
        ],
      };
      const result = parseServiceConfig(activity);
      expect(result.defaultRoom).toBe('room-2');
      expect(result.roomMovable).toBe(false);
      expect(result.minPrice).toBe(100);
      expect(result.maxPrice).toBe(500);
      expect(result.category).toBe('injectables');
      expect(result.icon).toBe('syringe');
    });

    test('should return defaults if extension missing', () => {
      const activity: ActivityDefinition = {
        resourceType: 'ActivityDefinition',
        id: 'ad-1',
        status: 'active',
      };
      const result = parseServiceConfig(activity);
      expect(result.defaultRoom).toBe('room-1');
      expect(result.roomMovable).toBe(true);
      expect(result.minPrice).toBe(0);
      expect(result.maxPrice).toBe(0);
      expect(result.category).toBe('other');
    });

    test('should parse old format individual extensions', () => {
      const activity: ActivityDefinition = {
        resourceType: 'ActivityDefinition',
        id: 'ad-1',
        status: 'active',
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/service-config',
            extension: [
              { url: 'defaultRoom', valueString: 'room-3' },
              { url: 'minPrice', valueInteger: 200 },
              { url: 'maxPrice', valueInteger: 600 },
              { url: 'category', valueString: 'laser' },
            ],
          },
        ],
      };
      const result = parseServiceConfig(activity);
      expect(result.defaultRoom).toBe('room-3');
      expect(result.minPrice).toBe(200);
      expect(result.maxPrice).toBe(600);
      expect(result.category).toBe('laser');
    });
  });

  describe('buildServiceConfigExtensions', () => {
    test('should serialize config as JSON string', () => {
      const config = {
        defaultRoom: 'room-1',
        roomMovable: true,
        minPrice: 150,
        maxPrice: 400,
        pricePerUnit: false,
        unitType: 'unit',
        requiresConsult: false,
        icon: 'test-icon',
        color: 'blue',
        category: 'test',
        gfeCategory: 'test-gfe',
        followUpSchedule: [],
        providerRates: [],
        equipmentRequirements: [],
        recommendedAccompanyingServices: [],
        internalCost: { productCost: 0, costPerUnit: false },
        mainProviderRequired: true,
        assistantRequired: false,
        consentRequired: true,
      };
      const exts = buildServiceConfigExtensions(config);
      expect(exts).toHaveLength(1);
      const parsed = JSON.parse(exts[0].valueString as string);
      expect(parsed.defaultRoom).toBe('room-1');
      expect(parsed.minPrice).toBe(150);
      expect(parsed.maxPrice).toBe(400);
      expect(parsed.mainProviderRequired).toBe(true);
      expect(parsed.assistantRequired).toBe(false);
    });
  });

  describe('validateRoomEquipmentCompatibility', () => {
    test('should return compatible with no warnings (stub)', () => {
      const result = validateRoomEquipmentCompatibility('room-1', [{ equipmentType: 'laser' }]);
      expect(result.compatible).toBe(true);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('calculateServiceSequenceTimes', () => {
    const baseTime = new Date('2026-01-15T10:00:00Z');

    test('should calculate sequential times', () => {
      const services = [
        { duration: 30, sequence: 1 },
        { duration: 45, sequence: 2 },
      ];
      const result = calculateServiceSequenceTimes(services, baseTime);
      expect(result).toHaveLength(2);
      expect(result[0].startTime).toEqual(baseTime);
      expect(result[0].endTime).toEqual(new Date('2026-01-15T10:30:00Z'));
      expect(result[1].startTime).toEqual(new Date('2026-01-15T10:30:00Z'));
      expect(result[1].endTime).toEqual(new Date('2026-01-15T11:15:00Z'));
    });

    test('should sort by sequence number', () => {
      const services = [
        { duration: 30, sequence: 2 },
        { duration: 15, sequence: 1 },
      ];
      const result = calculateServiceSequenceTimes(services, baseTime);
      expect(result[0].sequence).toBe(1);
      expect(result[1].sequence).toBe(2);
    });
  });
});
