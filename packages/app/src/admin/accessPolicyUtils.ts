// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { AccessPolicy } from '@medplum/fhirtypes';

/**
 * Safely gets the description from an AccessPolicy resource.
 * The description is stored as a custom extension since it's not part of the base FHIR AccessPolicy type.
 * @param policy - The AccessPolicy resource to read from
 * @returns The description string if found, otherwise undefined
 */
export function getAccessPolicyDescription(policy: AccessPolicy): string | undefined {
  return policy.extension?.find((e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/description')
    ?.valueString;
}

/**
 * Sets the description on an AccessPolicy resource.
 * Stored as a custom extension since it's not part of the base FHIR AccessPolicy type.
 * @param policy - The AccessPolicy resource to update
 * @param description - The description text to set
 */
export function setAccessPolicyDescription(policy: AccessPolicy, description: string): void {
  if (!policy.extension) {
    policy.extension = [];
  }

  const existingExt = policy.extension.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/description'
  );

  if (existingExt) {
    existingExt.valueString = description;
  } else {
    policy.extension.push({
      url: 'http://melissaknudson.com/fhir/StructureDefinition/description',
      valueString: description,
    });
  }
}
