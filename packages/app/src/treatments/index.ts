// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

// Treatment detail pages - accessed via Treatments list, not as tabs
// BotoxTreatmentPage is still in nurse-mel folder - will be refactored later
export { BotoxTreatmentPage } from '../nurse-mel/BotoxTreatmentPage';
export { FillerTreatmentPage } from './FillerTreatmentPage';
export { LaserTreatmentPage } from './LaserTreatmentPage';
export { ConsultationTreatmentPage } from './ConsultationTreatmentPage';

// Shared utilities
export { getTreatmentType, getTreatmentPageRoute } from './shared/getTreatmentType';
export { TreatmentStatusAlert, statusConfig } from './shared/TreatmentStatusAlert';
export { TreatmentHeader } from './shared/TreatmentHeader';
export { useTreatmentData } from './shared/useTreatmentData';
export { PatientReferencePanel } from './shared/PatientReferencePanel';
export { SOAPNoteSection, DEFAULT_SOAP_NOTE } from './shared/SOAPNoteSection';
export type { SOAPNoteData } from './shared/SOAPNoteSection';
export { ProcedureNoteSection, DEFAULT_PROCEDURE_NOTE } from './shared/ProcedureNoteSection';
export type { ProcedureNoteData } from './shared/ProcedureNoteSection';
export { loadProviderOptions } from './shared/loadProviders';
export type { ProviderOption } from './shared/loadProviders';
