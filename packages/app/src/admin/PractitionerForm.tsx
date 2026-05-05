// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * PractitionerForm - Custom form for creating/editing Nurse Mel MedSpa staff
 * Simplified 2-step wizard replacing the overwhelming generic FHIR form
 */

import { Button, Card, Group, Radio, Select, Stack, Stepper, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import { normalizeErrorString } from '@medplum/core';
import type { AccessPolicy, Practitioner, UserConfiguration } from '@medplum/fhirtypes';
import { Document, useMedplum } from '@medplum/react';
import { IconCalendar } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const PRACTITIONER_COLORS = [
  { value: '#1a73e8', label: 'Blue' },
  { value: '#d93025', label: 'Red' },
  { value: '#188038', label: 'Green' },
  { value: '#f9ab00', label: 'Amber' },
  { value: '#e8710a', label: 'Orange' },
  { value: '#a142f4', label: 'Purple' },
  { value: '#0891b2', label: 'Cyan' },
  { value: '#c5221f', label: 'Dark Red' },
  { value: '#076448', label: 'Teal' },
  { value: '#8430ce', label: 'Violet' },
  { value: '#d81b60', label: 'Pink' },
  { value: '#4a90d9', label: 'Sky Blue' },
];

type Role = 'provider' | 'assistant' | 'coordinator' | 'admin';

interface License {
  id: string;
  type: string;
  display?: string;
  number: string;
  state: string;
  expiry: string | null;
}

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Role | null;
  color: string;
  licenses: License[];
  tempPassword: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tempPassword?: string;
  role?: string;
  licenses?: string;
}

interface PractitionerFormProps {
  practitionerId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const LICENSE_TYPES = [
  { value: 'RN', label: 'Registered Nurse (RN)' },
  { value: 'NP', label: 'Nurse Practitioner (NP)' },
  { value: 'MD', label: 'Medical Doctor (MD)' },
  { value: 'DO', label: 'Doctor of Osteopathy (DO)' },
  { value: 'PA', label: 'Physician Assistant (PA)' },
  { value: 'LPN', label: 'Licensed Practical Nurse (LPN)' },
  { value: 'APRN', label: 'Advanced Practice RN (APRN)' },
];

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
];

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  {
    value: 'provider',
    label: 'Provider',
    description: 'Clinical staff (RN/NP/MD) who can perform treatments',
  },
  {
    value: 'assistant',
    label: 'Assistant',
    description: 'Support staff who can assist with treatments and numbing',
  },
  {
    value: 'coordinator',
    label: 'Coordinator',
    description: 'Front desk staff who handle scheduling and patient intake',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full access to manage practice settings and staff',
  },
];

// Parse qualifications from Practitioner to licenses
function parseQualifications(qualifications?: Practitioner['qualification']): License[] {
  if (!qualifications || qualifications.length === 0) {
    return [
      {
        id: crypto.randomUUID(),
        type: '',
        display: undefined,
        number: '',
        state: '',
        expiry: null,
      },
    ];
  }

  return qualifications.map((q) => {
    const licenseNumber = q.identifier?.find((ident) => ident.system === 'http://melissaknudson.com/license-number')?.value;
    const state = q.identifier?.find((ident) => ident.system === 'http://melissaknudson.com/license-state')?.value;

    return {
      id: crypto.randomUUID(),
      type: q.code?.coding?.[0]?.code ?? '',
      display: q.code?.coding?.[0]?.display ?? undefined,
      number: licenseNumber ?? '',
      state: state ?? '',
      expiry: q.period?.end ?? null,
    };
  });
}

// Get role from practitioner extension
function getRoleFromPractitioner(practitioner?: Practitioner): Role | null {
  if (!practitioner) {
    return null;
  }

  // First, try to get role from medspa-role extension
  if (practitioner.extension) {
    const medspaRole = practitioner.extension.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role'
    )?.valueString;

    if (medspaRole === 'project-admin' || medspaRole === 'super-admin') {
      return 'admin';
    }
    if (medspaRole === 'provider') {
      return 'provider';
    }
    if (medspaRole === 'assistant') {
      return 'assistant';
    }
    if (medspaRole === 'coordinator') {
      return 'coordinator';
    }
  }

  // Fallback: Check qualification code for role hints
  const qualificationCode = practitioner.qualification?.[0]?.code?.coding?.[0]?.code;
  if (qualificationCode === 'RN' || qualificationCode === 'NP' || qualificationCode === 'MD' || qualificationCode === 'DO') {
    return 'provider';
  }
  if (qualificationCode === 'coordinator') {
    return 'coordinator';
  }
  if (qualificationCode === 'assistant') {
    return 'assistant';
  }
  if (qualificationCode === 'admin') {
    return 'admin';
  }

  return null;
}

export function PractitionerForm({ practitionerId, onSuccess, onCancel }: PractitionerFormProps): JSX.Element {
  const medplum = useMedplum();
  const isEditMode = !!practitionerId;
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [accessPolicies, setAccessPolicies] = useState<Record<Role, AccessPolicy | null>>({
    provider: null,
    assistant: null,
    coordinator: null,
    admin: null,
  });
  const [existingPractitioner, setExistingPractitioner] = useState<Practitioner | null>(null);

  // Form state
  const [values, setValues] = useState<FormValues>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: null,
    color: PRACTITIONER_COLORS[0].value,
    licenses: [
      {
        id: crypto.randomUUID(),
        type: '',
        display: undefined,
        number: '',
        state: '',
        expiry: null,
      },
    ],
    tempPassword: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Load existing practitioner data in edit mode
  useEffect(() => {
    if (!practitionerId) {
      return;
    }

    const loadPractitioner = async (): Promise<void> => {
      try {
        setIsLoading(true);
        const practitioner = await medplum.readResource('Practitioner', practitionerId);
        setExistingPractitioner(practitioner);

        const firstName = practitioner.name?.[0]?.given?.[0] ?? '';
        const lastName = practitioner.name?.[0]?.family ?? '';
        const email = practitioner.telecom?.find((t) => t.system === 'email')?.value ?? '';
        const phone = practitioner.telecom?.find((t) => t.system === 'phone')?.value ?? '';
        const role = getRoleFromPractitioner(practitioner);
        const licenses = parseQualifications(practitioner.qualification);
        const color =
          practitioner.extension?.find(
            (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color'
          )?.valueString || PRACTITIONER_COLORS[0].value;

        setValues({
          firstName,
          lastName,
          email,
          phone,
          role,
          color,
          licenses,
          tempPassword: '', // Don't show existing password
        });
      } catch (err) {
        console.error('Error loading practitioner:', err);
        showNotification({
          color: 'red',
          title: 'Error',
          message: 'Failed to load practitioner data',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPractitioner().catch(console.error);
  }, [practitionerId, medplum]);

  const selectedRole = values.role;
  const isProvider = selectedRole === 'provider';
  const steps = useMemo(() => ['Basic Info', 'Role & License'], []);

  const validateStep0 = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    if (values.firstName.length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }
    if (values.lastName.length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }
    if (!/^\S+@\S+$/.test(values.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (values.phone.length < 10) {
      newErrors.phone = 'Phone number must be at least 10 digits';
    }
    // Password only required for new practitioners
    if (!isEditMode && values.tempPassword.length < 8) {
      newErrors.tempPassword = 'Password must be at least 8 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values, isEditMode]);

  const validateStep1 = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    if (!values.role) {
      newErrors.role = 'Please select a role';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values]);

  const updateValue = useCallback(<K extends keyof FormValues>(field: K, value: FormValues[K]): void => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is edited
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const fetchAccessPolicies = useCallback(async (): Promise<Record<Role, AccessPolicy | null>> => {
    try {
      const result = await medplum.search('AccessPolicy', { _count: '100' });
      const allPolicies = (result.entry || []).map((e) => e.resource as AccessPolicy);

      const policies = {
        provider: allPolicies.find((p) => p.name?.toLowerCase().includes('provider')) || null,
        assistant: allPolicies.find((p) => p.name?.toLowerCase().includes('assistant')) || null,
        coordinator: allPolicies.find((p) => p.name?.toLowerCase().includes('coordinator')) || null,
        admin: allPolicies.find((p) => p.name?.toLowerCase().includes('admin')) || null,
      };

      setAccessPolicies(policies);
      return policies;
    } catch (err) {
      console.error('Error fetching access policies:', err);
      return { provider: null, assistant: null, coordinator: null, admin: null };
    }
  }, [medplum]);

  const handleCreate = useCallback(async (): Promise<void> => {
    if (!validateStep1()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Fetch access policies if not already loaded
      let policies = { ...accessPolicies };
      if (!policies.provider || !policies.coordinator || !policies.admin || !policies.assistant) {
        policies = await fetchAccessPolicies();
      }

      const accessPolicy = values.role ? policies[values.role] : null;
      if (!accessPolicy) {
        throw new Error(`Access policy not found for role: ${values.role}`);
      }

      // Create User
      const user = await medplum.createResource({
        resourceType: 'User',
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.tempPassword,
      });

      // Create Practitioner with qualifications and extensions
      const practitionerData: Practitioner = {
        resourceType: 'Practitioner',
        name: [
          {
            use: 'official',
            given: [values.firstName],
            family: values.lastName,
          },
        ],
        telecom: [
          { system: 'email', value: values.email, use: 'work' },
          { system: 'phone', value: values.phone, use: 'work' },
        ],
      };

      // Add qualifications for providers (only if licenses have data)
      const validLicenses = values.licenses.filter((l) => l.type || l.number || l.state || l.expiry);
      if (isProvider && validLicenses.length > 0) {
        practitionerData.qualification = validLicenses.map((license) => ({
          code: {
            coding: [
              {
                system: 'http://hl7.org/fhir/v2/0360',
                code: license.type,
                display: license.display || LICENSE_TYPES.find((l) => l.value === license.type)?.label,
              },
            ],
          },
          identifier: [
            {
              system: 'http://melissaknudson.com/license-number',
              value: license.number,
            },
            {
              system: 'http://melissaknudson.com/license-state',
              value: license.state,
            },
          ],
          period: license.expiry
            ? {
                end: license.expiry,
              }
            : undefined,
        }));

        // Add custom extension for medspa role and color
        practitionerData.extension = [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
            valueString: 'provider',
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
            valueString: values.color,
          },
        ];
      } else if (values.role === 'assistant') {
        practitionerData.extension = [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
            valueString: 'assistant',
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
            valueString: values.color,
          },
        ];
      } else if (values.role === 'coordinator') {
        practitionerData.extension = [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
            valueString: 'coordinator',
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
            valueString: values.color,
          },
        ];
      } else if (values.role === 'admin') {
        practitionerData.extension = [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
            valueString: 'project-admin',
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
            valueString: values.color,
          },
        ];
      }

      const practitioner = await medplum.createResource(practitionerData);

      // Create UserConfiguration
      const userConfig: UserConfiguration = {
        resourceType: 'UserConfiguration',
        option: [
          {
            id: 'userType',
            valueString: values.role || 'coordinator',
          },
        ],
      };

      await medplum.createResource(userConfig);

      // Get project reference
      const project = await medplum.getProject();
      if (!project?.id) {
        throw new Error('Could not get current project');
      }

      // Create ProjectMembership
      await medplum.createResource({
        resourceType: 'ProjectMembership',
        user: { reference: `User/${user.id}` },
        profile: { reference: `Practitioner/${practitioner.id}` },
        project: { reference: `Project/${project.id}` },
        access: [
          {
            policy: { reference: `AccessPolicy/${accessPolicy.id}` },
          },
        ],
        admin: values.role === 'admin',
      });

      showNotification({
        color: 'green',
        title: 'Success',
        message: `${values.firstName} ${values.lastName} has been added as a ${
          ROLE_OPTIONS.find((r) => r.value === values.role)?.label
        }`,
      });

      onSuccess?.();
    } catch (err) {
      console.error('Error creating practitioner:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: normalizeErrorString(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [values, isProvider, medplum, accessPolicies, validateStep1, onSuccess, fetchAccessPolicies]);

  const handleUpdate = useCallback(async (): Promise<void> => {
    if (!validateStep1() || !existingPractitioner) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Update Practitioner
      const updatedPractitioner: Practitioner = {
        ...existingPractitioner,
        name: [
          {
            use: 'official',
            given: [values.firstName],
            family: values.lastName,
          },
        ],
        telecom: [
          { system: 'email', value: values.email, use: 'work' },
          { system: 'phone', value: values.phone, use: 'work' },
        ],
      };

      // Update qualifications for providers (only if licenses have data)
      const validLicenses = values.licenses.filter((l) => l.type || l.number || l.state || l.expiry);
      if (isProvider && validLicenses.length > 0) {
        updatedPractitioner.qualification = validLicenses.map((license) => ({
          code: {
            coding: [
              {
                system: 'http://hl7.org/fhir/v2/0360',
                code: license.type,
                display: license.display || LICENSE_TYPES.find((l) => l.value === license.type)?.label,
              },
            ],
          },
          identifier: [
            {
              system: 'http://melissaknudson.com/license-number',
              value: license.number,
            },
            {
              system: 'http://melissaknudson.com/license-state',
              value: license.state,
            },
          ],
          period: license.expiry
            ? {
                end: license.expiry,
              }
            : undefined,
        }));

        // Update extension for medspa role and color
        updatedPractitioner.extension = [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
            valueString: 'provider',
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
            valueString: values.color,
          },
        ];
      } else if (values.role === 'assistant') {
        updatedPractitioner.extension = [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
            valueString: 'assistant',
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
            valueString: values.color,
          },
        ];
      } else if (values.role === 'coordinator') {
        updatedPractitioner.extension = [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
            valueString: 'coordinator',
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
            valueString: values.color,
          },
        ];
      } else if (values.role === 'admin') {
        updatedPractitioner.extension = [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
            valueString: 'project-admin',
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/practitioner-color',
            valueString: values.color,
          },
        ];
      }

      await medplum.updateResource(updatedPractitioner);

      // Update UserConfiguration
      const memberships = await medplum.search('ProjectMembership', {
        profile: `Practitioner/${practitionerId}`,
        _count: '1',
      });

      if (memberships.entry?.[0]?.resource) {
        const membership = memberships.entry[0].resource;
        // Update access policy if role changed
        const fetchedPolicies = await fetchAccessPolicies();
        const accessPolicy = values.role ? fetchedPolicies[values.role] : null;
        if (accessPolicy && membership.access) {
          membership.access[0] = {
            policy: { reference: `AccessPolicy/${accessPolicy.id}` },
          };
          membership.admin = values.role === 'admin';
          await medplum.updateResource(membership);
        }
      }

      showNotification({
        color: 'green',
        title: 'Success',
        message: `${values.firstName} ${values.lastName}'s information has been updated`,
      });

      onSuccess?.();
    } catch (err) {
      console.error('Error updating practitioner:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: normalizeErrorString(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    values,
    isProvider,
    medplum,
    validateStep1,
    onSuccess,
    fetchAccessPolicies,
    existingPractitioner,
    practitionerId,
  ]);

  const handleSubmit = useCallback((): void => {
    if (isEditMode) {
      handleUpdate().catch(console.error);
    } else {
      handleCreate().catch(console.error);
    }
  }, [isEditMode, handleUpdate, handleCreate]);

  const nextStep = useCallback((): void => {
    if (activeStep === 0) {
      if (!validateStep0()) {
        return;
      }
      // Fetch access policies in background - don't block navigation
      fetchAccessPolicies().catch(console.error);
    }
    setActiveStep((current) => (current < steps.length - 1 ? current + 1 : current));
  }, [activeStep, steps.length, validateStep0, fetchAccessPolicies]);

  const prevStep = useCallback((): void => {
    setActiveStep((current) => (current > 0 ? current - 1 : current));
  }, []);

  const renderStepContent = useCallback((): JSX.Element => {
    switch (activeStep) {
      case 0:
        return (
          <Stack gap="md">
            <Group grow>
              <TextInput
                label="First Name"
                placeholder="Enter first name"
                required
                value={values.firstName}
                onChange={(e) => updateValue('firstName', e.currentTarget.value)}
                error={errors.firstName}
              />
              <TextInput
                label="Last Name"
                placeholder="Enter last name"
                required
                value={values.lastName}
                onChange={(e) => updateValue('lastName', e.currentTarget.value)}
                error={errors.lastName}
              />
            </Group>
            <TextInput
              label="Email"
              placeholder="email@example.com"
              required
              type="email"
              value={values.email}
              onChange={(e) => updateValue('email', e.currentTarget.value)}
              error={errors.email}
            />
            <TextInput
              label="Phone"
              placeholder="(555) 123-4567"
              required
              value={values.phone}
              onChange={(e) => updateValue('phone', e.currentTarget.value)}
              error={errors.phone}
            />
            {!isEditMode && (
              <TextInput
                label="Temporary Password"
                placeholder="Set temporary password"
                required
                type="password"
                description="Staff member will use this to log in for the first time"
                value={values.tempPassword}
                onChange={(e) => updateValue('tempPassword', e.currentTarget.value)}
                error={errors.tempPassword}
              />
            )}
          </Stack>
        );
      case 1:
        return (
          <Stack gap="md">
            <Radio.Group
              label="Select Role"
              description="This determines what the staff member can access and do"
              required
              value={values.role || undefined}
              onChange={(val) => updateValue('role', val as Role)}
              error={errors.role}
            >
              <Stack gap="xs" mt="xs">
                {ROLE_OPTIONS.map((role) => (
                  <Card key={role.value} withBorder padding="sm">
                    <Radio value={role.value} label={role.label} description={role.description} />
                  </Card>
                ))}
              </Stack>
            </Radio.Group>

            {selectedRole && (
              <Stack gap="md" mt="md">
                <Text fw={500} size="sm">
                  Practitioner Color (for calendar display)
                </Text>
                <Group>
                  {PRACTITIONER_COLORS.map((colorOption) => (
                    <Button
                      key={colorOption.value}
                      size="md"
                      style={{ backgroundColor: colorOption.value, width: 36, height: 36 }}
                      onClick={() => updateValue('color', colorOption.value)}
                      variant={values.color === colorOption.value ? 'filled' : 'outline'}
                      aria-label={colorOption.label}
                    >
                      {values.color === colorOption.value && (
                        <Text c="white" fw={700} size="xs">
                          ✓
                        </Text>
                      )}
                    </Button>
                  ))}
                </Group>
              </Stack>
            )}

            {isProvider && (
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={500} size="sm">
                    Provider License Information (Optional)
                  </Text>
                  <Button
                    variant="light"
                    size="xs"
                    onClick={() =>
                      updateValue('licenses', [
                        ...values.licenses,
                        {
                          id: crypto.randomUUID(),
                          type: '',
                          number: '',
                          state: '',
                          expiry: null,
                        },
                      ])
                    }
                  >
                    + Add Another License
                  </Button>
                </Group>

                {values.licenses.map((license, index) => (
                  <Card key={license.id} withBorder padding="md" bg="blue.0">
                    <Stack gap="md">
                      <Group justify="space-between">
                        <Text fw={500} size="sm">
                          License {index + 1}
                        </Text>
                        {values.licenses.length > 1 && (
                          <Button
                            variant="light"
                            color="red"
                            size="xs"
                            onClick={() =>
                              updateValue(
                                'licenses',
                                values.licenses.filter((l) => l.id !== license.id)
                              )
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </Group>
                      <Select
                        label="License Type"
                        placeholder="Select license type"
                        data={LICENSE_TYPES}
                        value={license.type}
                        onChange={(val) => {
                          const newLicenses = [...values.licenses];
                          newLicenses[index] = { ...license, type: val || '' };
                          updateValue('licenses', newLicenses);
                        }}
                      />
                       <Group grow>
                         <TextInput
                           label="License Number"
                           placeholder="Enter license number"
                           value={license.number}
                           onChange={(e) => {
                             const newLicenses = [...values.licenses];
                             newLicenses[index] = { ...license, number: e.currentTarget.value };
                             updateValue('licenses', newLicenses);
                           }}
                         />
                         <Select
                           label="State"
                           placeholder="Select state"
                           data={US_STATES}
                           value={license.state}
                           onChange={(val) => {
                             const newLicenses = [...values.licenses];
                             newLicenses[index] = { ...license, state: val || '' };
                             updateValue('licenses', newLicenses);
                           }}
                         />
                       </Group>
                       <DatePickerInput
                         label="License Expiry Date"
                         placeholder="Select expiry date"
                         rightSection={<IconCalendar size={16} />}
                         value={license.expiry}
                         onChange={(value) => {
                           const newLicenses = [...values.licenses];
                           newLicenses[index] = { ...license, expiry: value };
                           updateValue('licenses', newLicenses);
                         }}
                       />
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}

            {!isProvider && selectedRole && (
              <Card withBorder padding="md" bg="gray.0">
                <Text size="sm" c="dimmed">
                  License information is only required for providers.{' '}
                  {ROLE_OPTIONS.find((r) => r.value === selectedRole)?.label}s do not need a clinical license.
                </Text>
              </Card>
            )}
          </Stack>
        );
      default:
        return <Text>Unknown step</Text>;
    }
  }, [activeStep, values, errors, isProvider, selectedRole, updateValue, isEditMode]);

  if (isLoading) {
    return (
      <Document>
        <Text>Loading practitioner data...</Text>
      </Document>
    );
  }

  return (
    <Document>
      <Stack gap="lg">
        <Stepper active={activeStep}>
          {steps.map((label, index) => (
            <Stepper.Step key={index} label={label} />
          ))}
        </Stepper>

        <Card withBorder padding="lg">
          {renderStepContent()}
        </Card>

        <Group justify="space-between">
          {activeStep > 0 ? (
            <Button variant="light" onClick={prevStep}>
              Back
            </Button>
          ) : (
            <Button variant="light" onClick={onCancel}>
              Cancel
            </Button>
          )}

          {activeStep < steps.length - 1 ? (
            <Button onClick={nextStep}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} loading={isSubmitting}>
              {isEditMode ? 'Update Staff Member' : 'Create Staff Member'}
            </Button>
          )}
        </Group>
      </Stack>
    </Document>
  );
}
