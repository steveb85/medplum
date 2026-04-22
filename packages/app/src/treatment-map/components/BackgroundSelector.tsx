// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Select, Stack, Text, Group } from '@mantine/core';
import { IconTemplate, IconPhoto } from '@tabler/icons-react';
import type { JSX } from 'react';
import type { PatientGender, TreatmentPhoto } from '../hooks/usePatientAssets';

export type BackgroundType = 'template' | 'photo';
export type TemplateView = 'front' | 'left' | 'right';

export interface BackgroundConfig {
  type: BackgroundType;
  templateGender?: PatientGender;
  templateView: TemplateView;
  photoId?: string;
}

interface BackgroundSelectorProps {
  config: BackgroundConfig;
  onChange: (config: BackgroundConfig) => void;
  patientGender: PatientGender | null;
  photos: TreatmentPhoto[];
  disabled?: boolean;
}

const VIEW_OPTIONS: { value: TemplateView; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'left', label: 'Left Profile' },
  { value: 'right', label: 'Right Profile' },
];

export function BackgroundSelector({
  config,
  onChange,
  patientGender,
  photos,
  disabled = false,
}: BackgroundSelectorProps): JSX.Element {
  // Determine which gender to show in templates
  const effectiveGender = patientGender === 'male' || patientGender === 'female'
    ? patientGender
    : 'unknown';

  // Build template options
  const templateOptions = [
    { value: `${effectiveGender}-front`, label: `${capitalize(effectiveGender)} - Front`, gender: effectiveGender, view: 'front' as TemplateView },
    { value: `${effectiveGender}-left`, label: `${capitalize(effectiveGender)} - Left Profile`, gender: effectiveGender, view: 'left' as TemplateView },
    { value: `${effectiveGender}-right`, label: `${capitalize(effectiveGender)} - Right Profile`, gender: effectiveGender, view: 'right' as TemplateView },
  ];

  // Build photo options
  const photoOptions = photos.map((photo) => ({
    value: `photo-${photo.id}`,
    label: `${capitalize(photo.type)} Photo${photo.date ? ` (${formatDate(photo.date)})` : ''}`,
    photoId: photo.id,
    url: photo.url,
  }));

  // Current combined value
  const currentValue = config.type === 'template'
    ? `${config.templateGender || effectiveGender}-${config.templateView}`
    : config.photoId
      ? `photo-${config.photoId}`
      : '';

  const handleChange = (value: string | null): void => {
    if (!value) return;

    if (value.startsWith('photo-')) {
      const photoId = value.replace('photo-', '');
      onChange({
        type: 'photo',
        templateView: config.templateView,
        photoId,
      });
    } else {
      const [gender, view] = value.split('-') as [PatientGender, TemplateView];
      onChange({
        type: 'template',
        templateGender: gender,
        templateView: view,
      });
    }
  };

  // Group options - use simple strings for labels
  const selectData: { group: string; items: { value: string; label: string }[] }[] = [
    {
      group: 'Templates',
      items: templateOptions.map((opt) => ({
        value: opt.value,
        label: opt.label,
      })),
    },
  ];

  if (photoOptions.length > 0) {
    selectData.push({
      group: 'Patient Photos',
      items: photoOptions.map((opt) => ({
        value: opt.value,
        label: opt.label,
      })),
    });
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Background
      </Text>
      <Select
        value={currentValue}
        onChange={handleChange}
        data={selectData}
        disabled={disabled}
        placeholder={photos.length === 0 ? "Select template" : "Select template or photo"}
        searchable
        clearable={false}
      />
      {config.type === 'template' && config.templateView === 'right' && (
        <Text size="xs" c="dimmed">
          Right profile is a mirrored view of left
        </Text>
      )}
    </Stack>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
