// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Stack, Text, Textarea, Title } from '@mantine/core';
import type { JSX } from 'react';

interface GenericTreatmentFormProps {
  onChange: (data: GenericTreatmentData) => void;
  value: GenericTreatmentData;
  readonly?: boolean;
}

export interface GenericTreatmentData {
  notes?: string;
  customFields?: Record<string, string | number | boolean>;
}

export function GenericTreatmentForm({ onChange, value, readonly }: GenericTreatmentFormProps): JSX.Element {
  return (
    <Stack gap="md">
      <Title order={5}>
        Treatment Notes
      </Title>

      {/* Notes */}
      <Box>
        <Text size="sm" fw={500} mb="xs">Notes:</Text>
        {readonly ? (
          <Box p="xs" bg="gray.0" style={{ borderRadius: '4px', minHeight: '120px' }}>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {value.notes || 'No notes recorded'}
            </Text>
          </Box>
        ) : (
          <Textarea
            value={value.notes || ''}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            placeholder="Enter treatment notes, observations, and any relevant details..."
            minRows={4}
            disabled={readonly}
          />
        )}
      </Box>
    </Stack>
  );
}
