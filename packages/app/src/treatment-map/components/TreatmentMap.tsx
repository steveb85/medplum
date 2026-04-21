// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  Button,
  Grid,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Title,
  Badge,
  Divider,
  Box,
} from '@mantine/core';
import { IconDeviceFloppy, IconX, IconMap } from '@tabler/icons-react';
import type { JSX } from 'react';
import type { TreatmentMapProps } from '../types/injection';
import { useInjectionMap } from '../hooks/useInjectionMap';
import { SvgCanvas } from './SvgCanvas';
import { ZoneEntryPopup } from './ZoneEntryPopup';
import { ZoneList } from './ZoneList';
import { PRODUCT_NAMES } from '../types/injection';

// Body region options
const BODY_REGION_OPTIONS = [
  { value: 'face', label: 'Face' },
];

// View angle options (will be dynamic based on region)
const VIEW_OPTIONS = [
  { value: 'front', label: 'Front' },
  { value: 'profile', label: 'Profile' },
];

export function TreatmentMap({
  patientId,
  mode = 'create',
  existingProcedure,
  initialMap,
  onSave,
  onCancel,
  readOnly = false,
  isSaving: externalIsSaving,
}: TreatmentMapProps): JSX.Element {
  // Use initialMap if provided, otherwise fall back to existingProcedure
  const mapToUse = initialMap || existingProcedure?.injectionMap;

  const {
    // State
    bodyRegion,
    view,
    markers,
    selectedMarker,
    isSaving: internalIsSaving,
    zones,
    unitsByProduct,
    totalUnits,
    totalMarkers,
    canSave,

    // Actions
    setBodyRegion,
    setView,
    addMarker,
    updateMarker,
    deleteMarker,
    selectMarker,
    saveTreatment,
  } = useInjectionMap(patientId, mode, mapToUse);

  // Use external isSaving if provided, otherwise use internal
  const isSaving = externalIsSaving ?? internalIsSaving;

  return (
    <Stack gap="md">
      {/* Header with controls */}
      <Paper withBorder p="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={4}>
                <IconMap size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Treatment Mapping
              </Title>
        <Text size="sm" c="dimmed">
          Click on the face diagram to mark injection points
        </Text>
            </div>

            {/* Summary stats */}
            {totalMarkers > 0 && (
              <Group gap="xs">
                <Badge size="lg" color="blue">
                  {totalMarkers} markers
                </Badge>
                <Badge size="lg" color="green">
                  {totalUnits} units
                </Badge>
              </Group>
            )}
          </Group>

          <Divider />

          {/* Controls */}
          <Group grow>
            <Select
              label="Body Region"
              data={BODY_REGION_OPTIONS}
              value={bodyRegion}
              onChange={(value) => value && setBodyRegion(value as typeof bodyRegion)}
              disabled={readOnly || markers.length > 0}
              description={markers.length > 0 ? 'Cannot change after adding markers' : undefined}
            />
            <Select
              label="View"
              data={VIEW_OPTIONS}
              value={view}
              onChange={(value) => value && setView(value as typeof view)}
              disabled={readOnly}
            />
          </Group>
        </Stack>
      </Paper>

      {/* Main content: SVG Canvas + Zone List */}
      <Grid gutter="md">
        {/* Canvas - Takes up most space */}
        <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
          <Stack gap="xs">
            {/* Canvas title with product legend */}
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                <IconMap size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Injection Map
              </Text>

              {/* Product color legend */}
              <Group gap="xs">
                {Object.entries(unitsByProduct).map(([product, units]) => (
                  <Badge
                    key={product}
                    size="sm"
                    variant="dot"
                    styles={{
                      root: {
                        borderLeft: `3px solid var(--mantine-color-${getProductColor(product)}-6)`,
                      },
                    }}
                  >
                    {PRODUCT_NAMES[product as keyof typeof PRODUCT_NAMES]}: {units}u
                  </Badge>
                ))}
              </Group>
            </Group>

            {/* SVG Canvas with anatomical template */}
            <SvgCanvas
              view={view}
              markers={markers}
              zones={zones}
              selectedMarker={selectedMarker}
              onCanvasClick={readOnly ? () => {} : addMarker}
              onMarkerClick={selectMarker}
              readOnly={readOnly}
              markerColorMode="product"
            />

            {/* Instructions */}
            {!readOnly && (
              <Text size="xs" c="dimmed">
                {markers.length === 0
                  ? 'Click anywhere on the face diagram to add your first injection point'
                  : 'Click on the diagram to add more injection points, or click an existing marker to edit'}
              </Text>
            )}
          </Stack>
        </Grid.Col>

        {/* Zone List - Sidebar */}
        <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
          <Box h="100%">
            <ZoneList
              markers={markers}
              selectedMarker={selectedMarker}
              onMarkerSelect={selectMarker}
              onMarkerDelete={deleteMarker}
              readOnly={readOnly}
            />
          </Box>
        </Grid.Col>
      </Grid>

      {/* Zone Entry Popup (for editing markers) */}
      <ZoneEntryPopup
        isOpen={!!selectedMarker && !readOnly}
        marker={selectedMarker}
        onSave={updateMarker}
        onDelete={deleteMarker}
        onClose={() => selectMarker(null)}
      />

      {/* Action buttons */}
      {!readOnly && (
        <Paper withBorder p="md">
          <Group justify="space-between">
            <Button
              variant="light"
              color="gray"
              leftSection={<IconX size={16} />}
              onClick={onCancel}
            >
              Cancel
            </Button>

            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={saveTreatment}
              loading={isSaving}
              disabled={!canSave}
              color="green"
            >
              Save Treatment
            </Button>
          </Group>

{markers.length === 0 && (
              <Text size="sm" c="dimmed" mt="xs" ta="right">
                Add at least one injection point to save
              </Text>
            )}
        </Paper>
      )}

      {/* Read-only notice for coordinators */}
      {readOnly && (
        <Paper withBorder p="md" bg="gray.0">
          <Text size="sm" c="dimmed" ta="center">
            Read-only view. Contact a provider to modify treatment records.
          </Text>
        </Paper>
      )}
    </Stack>
  );
}

// Helper to get product color for badge
function getProductColor(product: string): string {
  const colorMap: Record<string, string> = {
    botox_cosmetic: 'blue',
    dysport: 'green',
    xeomin: 'violet',
    jeuveau: 'orange',
    custom: 'gray',
  };
  return colorMap[product] || 'gray';
}
