// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  ActionIcon,
  Badge,
  Box,
  Divider,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useMemo } from 'react';
import type { ZoneListProps } from '../types/injection';
import { PRODUCT_COLORS, PRODUCT_NAMES } from '../types/injection';

export function ZoneList({
  markers,
  selectedMarker,
  onMarkerSelect,
  onMarkerDelete,
  readOnly = false,
}: ZoneListProps): JSX.Element {
  // Group markers by muscle group
  const groupedMarkers = useMemo(() => {
    const groups: Record<string, typeof markers> = {};

    markers.forEach((marker) => {
      // Extract muscle group from zone name or use "Other"
      const muscleGroup = marker.zoneName.includes('(')
        ? marker.zoneName.split('(')[0].trim()
        : marker.zoneName;

      if (!groups[muscleGroup]) {
        groups[muscleGroup] = [];
      }
      groups[muscleGroup].push(marker);
    });

    return groups;
  }, [markers]);

  // Calculate totals
  const totalUnits = useMemo(
    () => markers.reduce((sum, m) => sum + m.units, 0),
    [markers]
  );

  const unitsByProduct = useMemo(() => {
    const totals: Record<string, number> = {};
    markers.forEach((marker) => {
      totals[marker.productBrand] = (totals[marker.productBrand] || 0) + marker.units;
    });
    return totals;
  }, [markers]);

  if (markers.length === 0) {
    return (
      <Paper withBorder p="md" h="100%">
        <Stack align="center" justify="center" h="100%" gap="sm">
          <IconPlus size={48} color="gray" />
          <Text c="dimmed" ta="center">
            Click on the photo to add injection points
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            Each marker will appear here
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box p="md" bg="gray.0">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={6}>Injection Points</Title>
            <Text size="sm" c="dimmed">
              {markers.length} marker{markers.length !== 1 ? 's' : ''}
            </Text>
          </Box>
          <Badge size="lg" color="blue">
            {totalUnits} units total
          </Badge>
        </Group>

        {/* Product totals */}
        {Object.entries(unitsByProduct).length > 0 && (
          <Group gap="xs" mt="xs">
            {Object.entries(unitsByProduct).map(([product, units]) => (
              <Badge
                key={product}
                size="sm"
                variant="dot"
                color={PRODUCT_COLORS[product as keyof typeof PRODUCT_COLORS] || 'gray'}
              >
                {PRODUCT_NAMES[product as keyof typeof PRODUCT_NAMES]}: {units}u
              </Badge>
            ))}
          </Group>
        )}
      </Box>

      <Divider />

      {/* Marker List */}
      <ScrollArea flex={1}>
        <Stack gap={0}>
          {Object.entries(groupedMarkers).map(([muscleGroup, groupMarkers]) => (
            <Box key={muscleGroup}>
              {/* Muscle Group Header */}
              <Box p="xs" bg="gray.1">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  {muscleGroup}
                </Text>
              </Box>

              {/* Markers in this group */}
              {groupMarkers.map((marker) => {
                const isSelected = selectedMarker?.id === marker.id;
                const productColor = PRODUCT_COLORS[marker.productBrand] || 'gray';

                return (
                  <Box
                    key={marker.id}
                    p="xs"
                    bg={isSelected ? 'blue.0' : undefined}
                    style={{
                      cursor: readOnly ? 'default' : 'pointer',
                      borderLeft: `3px solid ${productColor}`,
                    }}
                    onClick={() => !readOnly && onMarkerSelect(marker)}
                  >
                    <Group justify="space-between" align="flex-start" gap="xs">
                      <Box flex={1}>
                        <Group gap="xs">
                          <Text size="sm" fw={500}>
                            {marker.zoneName.includes('(')
                              ? marker.zoneName.split('(')[1].replace(')', '')
                              : marker.zoneName}
                          </Text>
                          <Badge
                            size="sm"
                            color={productColor}
                            variant="light"
                          >
                            {marker.units}u
                          </Badge>
                        </Group>

                        {marker.notes && (
                          <Text size="xs" c="dimmed" lineClamp={2} mt={2}>
                            {marker.notes}
                          </Text>
                        )}

                        <Text size="xs" c="dimmed" mt={2}>
                          {PRODUCT_NAMES[marker.productBrand]}
                        </Text>
                      </Box>

                      {!readOnly && (
                        <Group gap={0}>
                          <Tooltip label="Edit">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkerSelect(marker);
                              }}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Delete this marker?')) {
                                  onMarkerDelete(marker.id);
                                }
                              }}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      )}
                    </Group>
                  </Box>
                );
              })}

              <Divider />
            </Box>
          ))}
        </Stack>
      </ScrollArea>
    </Paper>
  );
}
