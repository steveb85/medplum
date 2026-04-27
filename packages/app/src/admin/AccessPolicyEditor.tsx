// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Group, Modal, Paper, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { AccessPolicy } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getAccessPolicyDescription, setAccessPolicyDescription } from './accessPolicyUtils';

interface AccessPolicyEditorProps {
  mode: 'create' | 'edit';
  policyId?: string;
  sourcePolicy?: AccessPolicy; // For cloning
  onCancel: () => void;
  onSave: (policy: AccessPolicy) => void;
}

interface AffectedUsers {
  users: number;
  bots: number;
  clients: number;
}

export function AccessPolicyEditor(props: AccessPolicyEditorProps): JSX.Element {
  const { mode, policyId, sourcePolicy, onCancel, onSave } = props;
  const medplum = useMedplum();

  const [name, setName] = useState(sourcePolicy?.name ?? '');
  const [description, setDescription] = useState(sourcePolicy ? getAccessPolicyDescription(sourcePolicy) ?? '' : '');
  const [affectedUsers, setAffectedUsers] = useState<AffectedUsers | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  // Load existing policy data for edit mode
  useEffect(() => {
    if (mode === 'edit' && policyId) {
      medplum
        .readResource('AccessPolicy', policyId)
        .then((policy) => {
          setName(policy.name || '');
          setDescription(getAccessPolicyDescription(policy) ?? '');
        })
        .catch(console.error);
    }
  }, [mode, policyId, medplum]);

  // Calculate affected users (for warning)
  useEffect(() => {
    if (mode === 'edit' && policyId) {
      Promise.all([
        medplum.search('ProjectMembership', { accessPolicy: policyId }),
        medplum.search('Bot', { accessPolicy: policyId }),
        medplum.search('ClientApplication', { accessPolicy: policyId }),
      ]).then(([users, bots, clients]) => {
        setAffectedUsers({
          users: users.total ?? 0,
          bots: bots.total ?? 0,
          clients: clients.total ?? 0,
        });
      });
    }
  }, [mode, policyId, medplum]);

  const title = useMemo(() => {
    if (mode === 'create') return 'Create Access Policy';
    if (mode === 'edit') return 'Edit Access Policy';
    return '';
  }, [mode]);

  const hasAssignments = affectedUsers && (affectedUsers.users > 0 || affectedUsers.bots > 0 || affectedUsers.clients > 0);

  const handleSave = async (): Promise<void> => {
    try {
      const basePolicy: Omit<AccessPolicy, 'id'> = {
        resourceType: 'AccessPolicy',
        name,
        resource: sourcePolicy?.resource || [], // For now, copy from source if cloning
      };

      if (description) {
        setAccessPolicyDescription(basePolicy as AccessPolicy, description);
      }

      let result: AccessPolicy;
      if (mode === 'edit' && policyId) {
        const policyToUpdate: AccessPolicy = {
          ...(basePolicy as AccessPolicy),
          id: policyId,
        };
        result = await medplum.updateResource(policyToUpdate);
      } else {
        result = await medplum.createResource(basePolicy as AccessPolicy);
      }

      showNotification({
        color: 'green',
        title: 'Success',
        message: mode === 'edit' ? 'Policy updated successfully' : 'Policy created successfully',
      });
      onSave(result);
    } catch (err) {
      console.error('Error saving policy:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to save policy',
      });
    }
  };

  return (
    <>
      <Paper p="md">
        <Stack gap="md">
          <Title order={3}>{title}</Title>

          <TextInput
            label="Name"
            placeholder="My Access Policy"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />

          <Textarea
            label="Description"
            placeholder="What this policy allows access to"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            autosize
            minRows={2}
          />

          {/* Future: Resource permission matrix will go here */}
          <Text size="sm" c="dimmed">
            Resource permissions can be configured here in a future update.
          </Text>

          <Group justify="right">
            <Button variant="light" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => (hasAssignments ? setShowWarning(true) : handleSave())}>Save</Button>
          </Group>
        </Stack>
      </Paper>

      <Modal opened={showWarning} onClose={() => setShowWarning(false)} title="⚠️ Affects Multiple Users" size="md">
        <Stack gap="md">
          <Text>
            This policy is currently assigned to:
            {affectedUsers && (
              <ul>
                {affectedUsers.users > 0 && <li>{affectedUsers.users} Users</li>}
                {affectedUsers.bots > 0 && <li>{affectedUsers.bots} Bots</li>}
                {affectedUsers.clients > 0 && <li>{affectedUsers.clients} Clients</li>}
              </ul>
            )}
          </Text>
          <Text>Changes will take effect immediately for all assigned users.</Text>
          <Group justify="right" gap="md">
            <Button variant="light" onClick={() => setShowWarning(false)}>
              Cancel
            </Button>
            <Button color="yellow" onClick={handleSave}>
              Continue and Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
