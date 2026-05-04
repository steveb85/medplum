// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Consent Management Utilities
 * 
 * Handles creation and verification of FHIR Consent resources for treatment consent.
 * Each service requiring consent creates a Consent resource linked to the ServiceRequest.
 */

import { createReference } from '@medplum/core';
import type { Consent, Patient, Practitioner, ServiceRequest } from '@medplum/fhirtypes';
import type { MedplumClient } from '@medplum/core';

// Extension URLs
const CONSENT_EXTENSION_URLS = {
  consentServiceRequest: 'http://melissaknudson.com/fhir/StructureDefinition/consent-service-request',
  consentCategory: 'http://melissaknudson.com/fhir/StructureDefinition/consent-category',
  patientSignatureData: 'http://melissaknudson.com/fhir/StructureDefinition/patient-signature-data',
  witnessSignatureData: 'http://melissaknudson.com/fhir/StructureDefinition/witness-signature-data',
  consentExpiry: 'http://melissaknudson.com/fhir/StructureDefinition/consent-expiry',
} as const;

// Consent category coding
const CONSENT_CATEGORY_CODING = {
  system: 'http://melissaknudson.com/consent-categories',
  code: 'treatment',
  display: 'Treatment Consent',
};

export interface ConsentSignatureData {
  signatureImage: string; // Base64 PNG
  signedAt: string; // ISO date
  signedBy: 'patient' | 'guardian' | 'related-person';
  signerName: string;
  signerReference: string; // Patient/RelatedPerson reference
}

export interface ConsentCreateParams {
  patient: Patient;
  serviceRequest: ServiceRequest;
  consentCategory: string; // e.g., 'botox-treatment'
  consentText: string; // HTML content
  patientSignature: ConsentSignatureData;
  witnessSignature?: ConsentSignatureData; // Provider/assistant witness
  organizationId: string;
}

export interface ConsentStatus {
  hasConsent: boolean;
  consent?: Consent;
  signedAt?: Date;
  expiresAt?: Date;
  signatures: {
    patient: boolean;
    witness: boolean;
  };
}

/**
 * Create a Consent resource for treatment
 */
export async function createTreatmentConsent(
  medplum: MedplumClient,
  params: ConsentCreateParams
): Promise<Consent> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  // Build consent HTML with embedded signatures
  const consentHtmlWithSignatures = embedSignaturesInHtml(
    params.consentText,
    params.patientSignature,
    params.witnessSignature
  );

  const consent: Consent = {
    resourceType: 'Consent',
    status: 'active',
    scope: {
      coding: [CONSENT_CATEGORY_CODING],
    },
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/consent-category',
        code: 'treatment',
        display: 'Treatment Consent',
      }],
    }],
    patient: createReference(params.patient),
    dateTime: now.toISOString(),
    performer: [createReference(params.patient)],
    sourceAttachment: {
      contentType: 'text/html',
      // Use browser-compatible btoa instead of Node.js Buffer
      data: typeof window !== 'undefined' ? btoa(unescape(encodeURIComponent(consentHtmlWithSignatures))) : Buffer.from(consentHtmlWithSignatures).toString('base64'),
      title: `${params.consentCategory} Consent`,
    },
    policy: [{
      uri: 'http://melissaknudson.com/consent-policy',
    }],
    // Link to specific service via extension
    extension: [
      {
        url: CONSENT_EXTENSION_URLS.consentServiceRequest,
        valueReference: {
          reference: `ServiceRequest/${params.serviceRequest.id}`,
        },
      },
      {
        url: CONSENT_EXTENSION_URLS.consentCategory,
        valueString: params.consentCategory,
      },
      {
        url: CONSENT_EXTENSION_URLS.patientSignatureData,
        valueString: params.patientSignature.signatureImage,
      },
      {
        url: CONSENT_EXTENSION_URLS.consentExpiry,
        valueDateTime: expiresAt.toISOString(),
      },
      ...(params.witnessSignature ? [{
        url: CONSENT_EXTENSION_URLS.witnessSignatureData,
        valueString: params.witnessSignature.signatureImage,
      }] : []),
    ],
  };

  return medplum.createResource(consent);
}

/**
 * Find consent for a service request
 */
export async function findConsentForServiceRequest(
  medplum: MedplumClient,
  serviceRequestId: string
): Promise<Consent | undefined> {
  const bundle = await medplum.search('Consent', {
    patient: serviceRequestId.split('/')[0] === 'Patient' ? serviceRequestId : undefined,
    status: 'active',
    _sort: '-date',
    _count: '1',
  });

  const consents = (bundle.entry || []).map(e => e.resource as Consent);
  
  // Filter to consent linked to this service request
  return consents.find(c => 
    c.extension?.some(e => 
      e.url === CONSENT_EXTENSION_URLS.consentServiceRequest &&
      e.valueReference?.reference === `ServiceRequest/${serviceRequestId}`
    )
  );
}

/**
 * Get consent status for multiple service requests
 */
export async function getConsentsForServiceRequests(
  medplum: MedplumClient,
  serviceRequestIds: string[]
): Promise<Map<string, ConsentStatus>> {
  const results = new Map<string, ConsentStatus>();

  // Search for all consents
  const bundle = await medplum.search('Consent', {
    status: 'active',
    _sort: '-date',
    _count: '100',
  });

  const consents = (bundle.entry || []).map(e => e.resource as Consent);

  // Check each service request
  for (const serviceRequestId of serviceRequestIds) {
    const consent = consents.find(c => 
      c.extension?.some(e => 
        e.url === CONSENT_EXTENSION_URLS.consentServiceRequest &&
        e.valueReference?.reference === `ServiceRequest/${serviceRequestId}`
      )
    );

    if (consent) {
      const patientSigExt = consent.extension?.find(
        e => e.url === CONSENT_EXTENSION_URLS.patientSignatureData
      );
      const witnessSigExt = consent.extension?.find(
        e => e.url === CONSENT_EXTENSION_URLS.witnessSignatureData
      );
      const expiryExt = consent.extension?.find(
        e => e.url === CONSENT_EXTENSION_URLS.consentExpiry
      );

      results.set(serviceRequestId, {
        hasConsent: true,
        consent,
        signedAt: consent.dateTime ? new Date(consent.dateTime) : undefined,
        expiresAt: expiryExt?.valueDateTime ? new Date(expiryExt.valueDateTime) : undefined,
        signatures: {
          patient: !!patientSigExt?.valueString,
          witness: !!witnessSigExt?.valueString,
        },
      });
    } else {
      results.set(serviceRequestId, {
        hasConsent: false,
        signatures: { patient: false, witness: false },
      });
    }
  }

  return results;
}

/**
 * Check if consent is valid (not expired)
 */
export function isConsentValid(consent: Consent): boolean {
  if (consent.status !== 'active') return false;
  
  const expiryExt = consent.extension?.find(
    e => e.url === CONSENT_EXTENSION_URLS.consentExpiry
  );
  
  if (expiryExt?.valueDateTime) {
    const expiryDate = new Date(expiryExt.valueDateTime);
    if (expiryDate < new Date()) return false;
  }
  
  return true;
}

/**
 * Embed signature images into HTML consent
 */
function embedSignaturesInHtml(
  consentText: string,
  patientSignature: ConsentSignatureData,
  witnessSignature?: ConsentSignatureData
): string {
  const signaturesHtml = `
    <div style="margin-top: 40px; border-top: 2px solid #333; padding-top: 20px;">
      <h3>Signatures</h3>
      
      <div style="margin-bottom: 30px;">
        <p><strong>Patient/Guardian Signature:</strong></p>
        <p>Name: ${patientSignature.signerName}</p>
        <p>Date: ${new Date(patientSignature.signedAt).toLocaleString()}</p>
        <p>Role: ${patientSignature.signedBy === 'patient' ? 'Patient' : 'Guardian/Related Person'}</p>
        <div style="border: 1px solid #ccc; padding: 10px; margin-top: 10px;">
          <img src="${patientSignature.signatureImage}" alt="Patient Signature" style="max-width: 400px;" />
        </div>
      </div>
      
      ${witnessSignature ? `
      <div>
        <p><strong>Witness Signature (Provider/Assistant):</strong></p>
        <p>Name: ${witnessSignature.signerName}</p>
        <p>Date: ${new Date(witnessSignature.signedAt).toLocaleString()}</p>
        <div style="border: 1px solid #ccc; padding: 10px; margin-top: 10px;">
          <img src="${witnessSignature.signatureImage}" alt="Witness Signature" style="max-width: 400px;" />
        </div>
      </div>
      ` : ''}
    </div>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Treatment Consent</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
    h1, h2, h3 { color: #333; }
    p { margin: 10px 0; }
    .signature-box { border: 2px solid #333; min-height: 100px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Treatment Consent</h1>
  ${consentText}
  ${signaturesHtml}
  <div style="margin-top: 40px; font-size: 0.9em; color: #666;">
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Consent ID: Will be assigned</p>
  </div>
</body>
</html>
  `;
}

/**
 * Get consent category from ServiceRequest
 */
export function getConsentCategoryFromServiceRequest(
  serviceRequest: ServiceRequest
): string | undefined {
  const categoryExt = serviceRequest.extension?.find(
    e => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/service-config'
  );
  
  if (categoryExt?.valueString) {
    try {
      const config = JSON.parse(categoryExt.valueString);
      return config.consentCategory || config.category;
    } catch {
      return undefined;
    }
  }
  
  return undefined;
}

export { CONSENT_EXTENSION_URLS, CONSENT_CATEGORY_CODING };
