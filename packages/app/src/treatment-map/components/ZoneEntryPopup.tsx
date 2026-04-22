// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Textarea,
  Text,
  Title,
  Box,
  Badge,
} from '@mantine/core';
import { IconTrash, IconDeviceFloppy } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useState, useEffect, useRef } from 'react';
import type { ZoneEntryPopupProps } from '../types/injection';
import { PRODUCT_NAMES, PRODUCT_COLORS } from '../types/injection';

// Product options for Select
const PRODUCT_OPTIONS = [
  { value: 'botox_cosmetic', label: PRODUCT_NAMES.botox_cosmetic },
  { value: 'dysport', label: PRODUCT_NAMES.dysport },
  { value: 'xeomin', label: PRODUCT_NAMES.xeomin },
  { value: 'jeuveau', label: PRODUCT_NAMES.jeuveau },
  { value: 'custom', label: PRODUCT_NAMES.custom },
];

export function ZoneEntryPopup({
  isOpen,
  marker,
  onSave,
  onDelete,
  onClose,
  isSaving: externalIsSaving = false,
}: ZoneEntryPopupProps): JSX.Element {
  // Form state
  const [productBrand, setProductBrand] = useState<string>('botox_cosmetic');
  const [units, setUnits] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ units?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Ref for units input to auto-focus
  const unitsInputRef = useRef<HTMLInputElement>(null);

  // Reset form when marker changes
  useEffect(() => {
    if (marker) {
      setProductBrand(marker.productBrand);
      setUnits(marker.units || '');
      setNotes(marker.notes || '');
      setErrors({});
    } else {
      // Reset for new marker
      setProductBrand('botox_cosmetic');
      setUnits('');
      setNotes('');
      setErrors({});
    }
  }, [marker, isOpen]);

  // Auto-focus units input when modal opens
  useEffect(() => {
    if (isOpen && marker) {
      // Small delay to ensure modal is rendered and input is available
      const timer = setTimeout(() => {
        unitsInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen, marker]);

  const handleSave = async (): Promise<void> => {
    // Validation
    const newErrors: { units?: string } = {};

    if (units === '' || units === 0) {
      newErrors.units = 'Units are required';
    } else if (units < 0) {
      newErrors.units = 'Units must be positive';
    } else if (units > 100) {
      newErrors.units = 'Units seem unusually high';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!marker) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      // Call onSave and await completion
      await onSave({
        ...marker,
        productBrand: productBrand as typeof marker.productBrand,
        units: Number(units),
        notes: notes.trim(),
      });
      // Only close on success
      onClose();
    } catch (err) {
      // On error, stay open and show error
      setSaveError(err instanceof Error ? err.message : 'Failed to save marker');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (): void => {
    if (marker && window.confirm('Delete this injection point?')) {
      onDelete(marker.id);
      onClose();
    }
  };

  if (!marker) {
    return <></>;
  }

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="Document Injection"
      size="md"
      centered
    >
      <Stack gap="md">
        {/* Zone Info */}
        <Box>
          <Text size="sm" c="dimmed">Location</Text>
          <Badge size="lg" color="blue" variant="light">
            {marker.zoneName}
          </Badge>
          {marker.isPredefinedZone && (
            <Text size="xs" c="dimmed" mt={4}>
              Snapped to predefined zone
            </Text>
          )}
          {!marker.isPredefinedZone && (
            <Text size="xs" c="orange" mt={4}>
              Custom placement (x: {(marker.position.x * 100).toFixed(1)}%, y: {(marker.position.y * 100).toFixed(1)}%)
            </Text>
          )}
        </Box>

        {/* Product Selection */}
        <Select
          label="Product"
          data={PRODUCT_OPTIONS}
          value={productBrand}
          onChange={(value) => setProductBrand(value || 'botox_cosmetic')}
          required
          styles={{
            input: {
              borderLeft: `4px solid ${PRODUCT_COLORS[productBrand as keyof typeof PRODUCT_COLORS]}`,
            },
          }}
        />

      {/* Units Input */}
      <NumberInput
        ref={unitsInputRef}
        label="Units Injected"
        description="Enter exact units - no typical ranges provided"
        placeholder="e.g., 8"
        value={units}
        onChange={(value) => {
          setUnits(value === '' ? '' : Number(value));
          setErrors({});
        }}
        min={1}
        max={100}
        required
        error={errors.units}
        styles={{
          input: {
            fontWeight: 600,
            fontSize: '1.1rem',
          },
        }}
      />

        {/* Notes */}
        <Textarea
          label="Clinical Notes"
          description="Injection angle, depth, technique, patient feedback, etc."
          placeholder="e.g., 45 degree angle, superficial injection, patient has strong corrugator muscle..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          minRows={3}
          maxRows={6}
          autosize
        />

      {/* Position Reference */}
      <Box bg="gray.0" p="xs" style={{ borderRadius: 'var(--mantine-radius-sm)' }}>
        <Text size="xs" c="dimmed">
          Coordinates: {marker.position.x.toFixed(3)}, {marker.position.y.toFixed(3)}
        </Text>
      </Box>

      {/* Error Message */}
      {saveError && (
        <Text size="sm" c="red" ta="center">
          Error: {saveError}. Please try again.
        </Text>
      )}

      {/* Action Buttons */}
      <Group justify="space-between" mt="md">
        <Button
          variant="light"
          color="red"
          leftSection={<IconTrash size={16} />}
          onClick={handleDelete}
          disabled={isSaving}
        >
          Delete
        </Button>

        <Group>
          <Button variant="light" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSave}
            loading={isSaving}
            disabled={!units || units === 0}
          >
            Save Marker
          </Button>
        </Group>
      </Group>
      </Stack>
    </Modal>
  );
}
