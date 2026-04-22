// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Title, Paper, Stack, Tabs, Table, Badge, Group, ActionIcon, Text, Loader } from '@mantine/core';
import { getReferenceString } from '@medplum/core';
import { useMedplum } from '@medplum/react';
import type { Procedure } from '@medplum/fhirtypes';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { IconEye } from '@tabler/icons-react';
import type { JSX } from 'react';
import dayjs from 'dayjs';
import { getTreatmentPageRoute } from '../treatments/shared/getTreatmentType';

// Status configuration matching TreatmentsTab
const statusConfig: Record<string, { color: string; label: string }> = {
  preparation: { color: 'orange', label: 'Scheduled' },
  'in-progress': { color: 'blue', label: 'In Progress' },
  completed: { color: 'green', label: 'Completed' },
  cancelled: { color: 'red', label: 'Cancelled' },
};

const statusOrder = {
  preparation: 0,
  'in-progress': 1,
  completed: 2,
  cancelled: 3,
};

interface BookingRow {
  procedure: Procedure;
  patientName: string;
  patientId: string;
}

export function BookingsPage(): JSX.Element {
  const medplum = useMedplum();
  const [procedures, setProcedures] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('upcoming');

  // Load all treatments
  const loadTreatments = useCallback(async () => {
    try {
      setLoading(true);

      // Search for ALL aesthetic treatment procedures (practice-wide)
      const proceduresBundle = await medplum.search('Procedure', {
        'code:has': 'http://melissaknudson.com/treatments|', // Any code in our system
        _sort: '-date',
        _count: '100',
      });

      const procedureResources = (proceduresBundle.entry || []).map(
        (e) => e.resource as Procedure
      );

      // Extract patient info and build rows
      const rows: BookingRow[] = await Promise.all(
        procedureResources.map(async (procedure) => {
          // Get patient reference
          const patientRef = procedure.subject?.reference;
          let patientName = 'Unknown Patient';
          let patientId = '';

          if (patientRef?.startsWith('Patient/')) {
            patientId = patientRef.split('/')[1];
            try {
              const patient = await medplum.readResource('Patient', patientId);
              const name = patient.name?.[0];
              if (name) {
                const given = name.given?.join(' ') ?? '';
                const family = name.family ?? '';
                patientName = `${given} ${family}`.trim() || 'Unknown Patient';
              }
            } catch {
              // Patient not found, use unknown
            }
          }

          return { procedure, patientName, patientId };
        })
      );

      // Sort by status then date
      rows.sort((a, b) => {
        const statusDiff =
          (statusOrder[a.procedure.status as keyof typeof statusOrder] ?? 4) -
          (statusOrder[b.procedure.status as keyof typeof statusOrder] ?? 4);
        if (statusDiff !== 0) return statusDiff;

        // Within same status, sort by date descending
        const getDate = (p: Procedure) => {
          const scheduledExt = p.extension?.find(
            (e) =>
              e.url ===
              'http://melissaknudson.com/fhir/StructureDefinition/scheduled-datetime'
          )?.valueDateTime;
          return new Date(scheduledExt || p.performedDateTime || 0).getTime();
        };
        return getDate(b.procedure) - getDate(a.procedure);
      });

      setProcedures(rows);
    } catch (err) {
      console.error('Error loading treatments:', err);
    } finally {
      setLoading(false);
    }
  }, [medplum]);

  useEffect(() => {
    loadTreatments();
  }, [loadTreatments]);

  // Filter procedures based on active tab
  const filteredProcedures = useMemo(() => {
    const now = dayjs();

    switch (activeTab) {
      case 'upcoming':
        return procedures.filter((row) => {
          const scheduledExt = row.procedure.extension?.find(
            (e) =>
              e.url ===
              'http://melissaknudson.com/fhir/StructureDefinition/scheduled-datetime'
          )?.valueDateTime;
          const date = dayjs(scheduledExt || row.procedure.performedDateTime);
          return date.isAfter(now) && date.isBefore(now.add(7, 'day'));
        });
      case 'past':
        return procedures.filter((row) => {
          const scheduledExt = row.procedure.extension?.find(
            (e) =>
              e.url ===
              'http://melissaknudson.com/fhir/StructureDefinition/scheduled-datetime'
          )?.valueDateTime;
          const date = dayjs(scheduledExt || row.procedure.performedDateTime);
          return date.isBefore(now);
        });
      case 'all':
      default:
        return procedures;
    }
  }, [procedures, activeTab]);

  // Format date from procedure
  const formatDate = (procedure: Procedure): string => {
    const scheduledExt = procedure.extension?.find(
      (e) =>
        e.url ===
        'http://melissaknudson.com/fhir/StructureDefinition/scheduled-datetime'
    )?.valueDateTime;
    const dateStr = scheduledExt || procedure.performedDateTime;
    if (!dateStr) return 'Not scheduled';
    return dayjs(dateStr).format('MMM D, YYYY');
  };

  // Format time from procedure
  const formatTime = (procedure: Procedure): string => {
    const scheduledExt = procedure.extension?.find(
      (e) =>
        e.url ===
        'http://melissaknudson.com/fhir/StructureDefinition/scheduled-datetime'
    )?.valueDateTime;
    if (!scheduledExt) return '';
    return dayjs(scheduledExt).format('h:mm A');
  };

  // Get service name
  const getServiceName = (procedure: Procedure): string => {
    return (
      procedure.code?.text ||
      procedure.code?.coding?.[0]?.display ||
      'Unknown Service'
    );
  };

  // Get areas treated
  const getAreas = (procedure: Procedure): string => {
    const areasExt = procedure.extension?.find(
      (e) =>
        e.url === 'http://melissaknudson.com/fhir/StructureDefinition/treatment-areas'
    )?.valueString;
    return areasExt || '-';
  };

  // Get units used
  const getUnits = (procedure: Procedure): string => {
    const unitsExt = procedure.extension?.find(
      (e) =>
        e.url === 'http://melissaknudson.com/fhir/StructureDefinition/units-used'
    )?.valueString;
    return unitsExt || '-';
  };

  // Handle view treatment - routes to appropriate treatment page based on service type
  const handleViewTreatment = (row: BookingRow) => {
    if (row.patientId && row.procedure.id) {
      const route = getTreatmentPageRoute(row.patientId, row.procedure.id, row.procedure);
      window.location.href = route;
    }
  };

  // Handle click on patient name
  const handlePatientClick = (patientId: string) => {
    if (patientId) {
      window.location.href = `/Patient/${patientId}`;
    }
  };

  return (
    <Stack gap="md" p="md">
      <Title order={3}>Bookings</Title>

      <Paper withBorder p="md">
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'all')}>
          <Tabs.List>
            <Tabs.Tab value="all">All ({procedures.length})</Tabs.Tab>
            <Tabs.Tab value="upcoming">
              Upcoming (
              {procedures.filter((row) => {
                const scheduledExt = row.procedure.extension?.find(
                  (e) =>
                    e.url ===
                    'http://melissaknudson.com/fhir/StructureDefinition/scheduled-datetime'
                )?.valueDateTime;
                const date = dayjs(
                  scheduledExt || row.procedure.performedDateTime
                );
                return (
                  date.isAfter(dayjs()) &&
                  date.isBefore(dayjs().add(7, 'day'))
                );
              }).length}
              )
            </Tabs.Tab>
            <Tabs.Tab value="past">
              Past (
              {procedures.filter((row) => {
                const scheduledExt = row.procedure.extension?.find(
                  (e) =>
                    e.url ===
                    'http://melissaknudson.com/fhir/StructureDefinition/scheduled-datetime'
                )?.valueDateTime;
                return dayjs(
                  scheduledExt || row.procedure.performedDateTime
                ).isBefore(dayjs());
              }).length}
              )
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="all" pt="md">
            {renderTable()}
          </Tabs.Panel>
          <Tabs.Panel value="upcoming" pt="md">
            {renderTable()}
          </Tabs.Panel>
          <Tabs.Panel value="past" pt="md">
            {renderTable()}
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Stack>
  );

  function renderTable(): JSX.Element {
    if (loading) {
      return (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      );
    }

    if (filteredProcedures.length === 0) {
      return (
        <Text c="dimmed" ta="center" p="xl">
          No treatments found
        </Text>
      );
    }

    return (
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Patient</Table.Th>
            <Table.Th>Service</Table.Th>
            <Table.Th>Date</Table.Th>
            <Table.Th>Time</Table.Th>
            <Table.Th>Areas</Table.Th>
            <Table.Th>Units</Table.Th>
            <Table.Th>Actions</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filteredProcedures.map((row) => (
            <Table.Tr key={row.procedure.id}>
              <Table.Td>
                {row.patientId ? (
                  <Text
                    component="a"
                    href={`/Patient/${row.patientId}`}
                    c="blue"
                    style={{ cursor: 'pointer', textDecoration: 'none' }}
                    onClick={(e) => {
                      e.preventDefault();
                      handlePatientClick(row.patientId);
                    }}
                  >
                    {row.patientName}
                  </Text>
                ) : (
                  row.patientName
                )}
              </Table.Td>
              <Table.Td>{getServiceName(row.procedure)}</Table.Td>
              <Table.Td>{formatDate(row.procedure)}</Table.Td>
              <Table.Td>{formatTime(row.procedure)}</Table.Td>
              <Table.Td>{getAreas(row.procedure)}</Table.Td>
              <Table.Td>{getUnits(row.procedure)}</Table.Td>
              <Table.Td>
                <ActionIcon
                  variant="subtle"
                  onClick={() => handleViewTreatment(row)}
                  title="View treatment"
                >
                  <IconEye size={18} />
                </ActionIcon>
              </Table.Td>
              <Table.Td>
                <Badge
                  color={
                    statusConfig[row.procedure.status as keyof typeof statusConfig]
                      ?.color || 'gray'
                  }
                >
                  {statusConfig[row.procedure.status as keyof typeof statusConfig]
                    ?.label || row.procedure.status}
                </Badge>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  }
}
