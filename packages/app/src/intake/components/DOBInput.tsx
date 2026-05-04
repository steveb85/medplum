// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * DOBInput Component
 * Date of birth input with separate Year/Month/Day dropdowns
 * No timezone issues, easy year selection
 */

import { Group, Select, Stack, Text } from '@mantine/core';
import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';

interface DOBInputProps {
  label?: string;
  value: string; // ISO format: YYYY-MM-DD
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

// Generate year options (from 18 years ago to 100 years ago)
function generateYears(): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  const years: { value: string; label: string }[] = [];
  for (let year = currentYear - 18; year >= currentYear - 100; year--) {
    years.push({ value: String(year), label: String(year) });
  }
  return years;
}

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

function generateDays(year: string, month: string): { value: string; label: string }[] {
  if (!year || !month) return [];
  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  const days: { value: string; label: string }[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    days.push({ value: dayStr, label: String(day) });
  }
  return days;
}

export function DOBInput({
  label = 'Date of Birth',
  value,
  onChange,
  error,
  required = true,
}: DOBInputProps): JSX.Element {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');

  // Parse existing value on mount
  useEffect(() => {
    if (value && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = value.split('-');
      setYear(y);
      setMonth(m);
      setDay(d);
    }
  }, []);

  // Update parent when any field changes
  useEffect(() => {
    if (year && month && day) {
      const newValue = `${year}-${month}-${day}`;
      if (newValue !== value) {
        onChange(newValue);
      }
    }
  }, [year, month, day, onChange, value]);

  const years = useMemo(() => generateYears(), []);
  const days = useMemo(() => generateDays(year, month), [year, month]);

  const handleYearChange = (val: string | null) => {
    setYear(val || '');
    setDay(''); // Reset day when year changes
  };

  const handleMonthChange = (val: string | null) => {
    setMonth(val || '');
    setDay(''); // Reset day when month changes
  };

  const handleDayChange = (val: string | null) => {
    setDay(val || '');
  };

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {label}
        {required && <span style={{ color: 'red' }}> *</span>}
      </Text>
      <Group grow>
        <Select
          label="Year"
          placeholder="YYYY"
          required={required}
          searchable
          data={years}
          value={year || undefined}
          onChange={handleYearChange}
          error={error}
        />
        <Select
          label="Month"
          placeholder="MM"
          required={required}
          data={MONTHS}
          value={month || undefined}
          onChange={handleMonthChange}
          error={error}
        />
        <Select
          label="Day"
          placeholder="DD"
          required={required}
          data={days}
          value={day || undefined}
          onChange={handleDayChange}
          disabled={!year || !month}
          error={error}
        />
      </Group>
    </Stack>
  );
}
