// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

export { BotoxTreatmentForm, type BotoxTreatmentData } from './BotoxTreatmentForm';
export { FillerTreatmentForm, type FillerTreatmentData } from './FillerTreatmentForm';
export { LaserTreatmentForm, type LaserTreatmentData } from './LaserTreatmentForm';
export { GenericTreatmentForm, type GenericTreatmentData } from './GenericTreatmentForm';

export type TreatmentFormData =
  | { type: 'botox'; data: import('./BotoxTreatmentForm').BotoxTreatmentData }
  | { type: 'filler'; data: import('./FillerTreatmentForm').FillerTreatmentData }
  | { type: 'laser'; data: import('./LaserTreatmentForm').LaserTreatmentData }
  | { type: 'generic'; data: import('./GenericTreatmentForm').GenericTreatmentData };
