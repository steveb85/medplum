import type { MedplumClient } from '@medplum/core';
import type { Practitioner } from '@medplum/fhirtypes';

export interface ProviderOption {
  value: string;
  label: string;
}

export async function loadProviderOptions(medplum: MedplumClient): Promise<ProviderOption[]> {
  try {
    const result = await medplum.search('Practitioner', { _count: '100' });
    return (result.entry || []).map((e) => {
      const p = e.resource as Practitioner;
      const name = p.name?.[0]?.given?.[0]
        ? `${p.name[0].given[0]} ${p.name[0].family || ''}`
        : p.name?.[0]?.text || 'Unknown';
      return { value: `Practitioner/${p.id}`, label: name.trim() };
    });
  } catch {
    return [];
  }
}
