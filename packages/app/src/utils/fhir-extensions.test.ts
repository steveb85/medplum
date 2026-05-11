import {
  getServiceConfig,
  getServiceDuration,
  getServiceRoom,
  getServiceEquipment,
  getDefaultProvider,
  hasEquipmentRequirement,
  getRequiredEquipment,
  parseInjectionMap,
  buildInjectionMapExtension,
  getTreatmentAreas,
  getUnitsUsed,
  getProductBrand,
  getLinkedAppointment,
  setLinkedAppointment,
  getAssignedRoom,
  setAssignedRoom,
  getAssignedEquipment,
  setAssignedEquipment,
  getServiceSequence,
  setServiceSequence,
  getServiceStatus,
  setServiceStatus,
  getActualDuration,
  setActualDuration,
  getServiceNotes,
  setServiceNotes,
} from './fhir-extensions';
import type { ServiceRequest, Procedure, Appointment } from '@medplum/fhirtypes';

describe('FHIR Extensions Utilities', () => {
  describe('Service Configuration Extensions', () => {
    test.todo('getServiceConfig should parse service-config extension');
    test.todo('getServiceConfig should return defaults if extension missing');
    test.todo('getServiceDuration should extract duration from config');
    test.todo('getServiceRoom should extract default room from config');
    test.todo('getServiceEquipment should extract equipment from config');
    test.todo('getDefaultProvider should extract provider from config');
    test.todo('hasEquipmentRequirement should check if equipment required');
    test.todo('getRequiredEquipment should return array of equipment codes');
  });

  describe('Treatment Extensions', () => {
    test.todo('parseInjectionMap should parse injection map from Procedure');
    test.todo('parseInjectionMap should return empty map if missing');
    test.todo('buildInjectionMapExtension should create extension structure');
    test.todo('getTreatmentAreas should extract areas from Procedure');
    test.todo('getUnitsUsed should extract units from Procedure');
    test.todo('getProductBrand should extract brand from Procedure');
  });

  describe('Appointment Linking Extensions', () => {
    test.todo('getLinkedAppointment should extract appointment reference');
    test.todo('getLinkedAppointment should return undefined if not linked');
    test.todo('setLinkedAppointment should add extension to ServiceRequest');
    test.todo('setLinkedAppointment should update existing extension');
  });

  describe('Room Assignment Extensions', () => {
    test.todo('getAssignedRoom should extract room from ServiceRequest');
    test.todo('getAssignedRoom should return undefined if not assigned');
    test.todo('setAssignedRoom should add room extension');
    test.todo('setAssignedRoom should update existing room');
  });

  describe('Equipment Assignment Extensions', () => {
    test.todo('getAssignedEquipment should extract equipment array');
    test.todo('getAssignedEquipment should return empty array if none');
    test.todo('setAssignedEquipment should add equipment extension');
    test.todo('setAssignedEquipment should replace existing equipment');
  });

  describe('Service Sequence Extensions', () => {
    test.todo('getServiceSequence should extract sequence number');
    test.todo('getServiceSequence should return 0 if not set');
    test.todo('setServiceSequence should add sequence extension');
    test.todo('setServiceSequence should update existing sequence');
  });

  describe('Service Status Extensions', () => {
    test.todo('getServiceStatus should extract status from ServiceRequest');
    test.todo('getServiceStatus should default to draft');
    test.todo('setServiceStatus should add status extension');
    test.todo('setServiceStatus should update existing status');
  });

  describe('Duration Tracking Extensions', () => {
    test.todo('getActualDuration should extract actual duration in minutes');
    test.todo('getActualDuration should return undefined if not recorded');
    test.todo('setActualDuration should add duration extension');
    test.todo('setActualDuration should update existing duration');
  });

  describe('Notes Extensions', () => {
    test.todo('getServiceNotes should extract notes from ServiceRequest');
    test.todo('getServiceNotes should return undefined if no notes');
    test.todo('setServiceNotes should add notes extension');
    test.todo('setServiceNotes should update existing notes');
  });
});
