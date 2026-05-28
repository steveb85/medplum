import type { MedplumClient } from '@medplum/core';
import type { Organization } from '@medplum/fhirtypes';
import { EXTENSION_URLS } from './fhir-extensions';

export interface PracticeConfig {
  supervisingProvider?: {
    reference: string;
    display?: string;
  };
}

export async function getPracticeConfig(medplum: MedplumClient): Promise<PracticeConfig> {
  const config: PracticeConfig = {};

  try {
    // Search for the practice Organization
    const result = await medplum.search('Organization', { _count: '1' });
    const org = result.entry?.[0]?.resource as Organization | undefined;
    if (!org) return config;

    // Read supervising provider from extension
    const spExt = org.extension?.find(
      (e) => e.url === EXTENSION_URLS.common.supervisingProvider
    );
    if (spExt?.valueReference) {
      config.supervisingProvider = {
        reference: spExt.valueReference.reference || '',
        display: spExt.valueReference.display,
      };
    }

    return config;
  } catch {
    return config;
  }
}
