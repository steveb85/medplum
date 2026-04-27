// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Group, Loader, Modal, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { AccessPolicy } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconLock } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { AccessPolicyCard } from './AccessPolicyCard';
import { AccessPolicyEditor } from './AccessPolicyEditor';

interface PolicyWithCount {
  policy: AccessPolicy;
  usageCount: number;
}

export function AccessPoliciesPage(): JSX.Element {
  const medplum = useMedplum();
  const [policies, setPolicies] = useState<PolicyWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [editPolicyId, setEditPolicyId] = useState<string | undefined>(undefined);
  const [cloneSourcePolicy, setCloneSourcePolicy] = useState<AccessPolicy | undefined>(undefined);

  // Load all AccessPolicies
  useEffect(() => {
    loadPolicies().catch(console.error);
  }, []);

  const loadPolicies = async (): Promise<void> => {
    try {
      setLoading(true);
      const policiesBundle = await medplum.search('AccessPolicy', { _count: '100' });
      const accessPolicies = (policiesBundle.entry || []).map((e) => e.resource as AccessPolicy);

      // Count usage for each policy
      const policiesWithCount: PolicyWithCount[] = await Promise.all(
        accessPolicies.map(async (policy) => {
          const users = await medplum.search('ProjectMembership', {
            accessPolicy: policy.id as string,
            _count: '0',
          });
          const bots = await medplum.search('Bot', {
            accessPolicy: policy.id as string,
            _count: '0',
          });
          const clients = await medplum.search('ClientApplication', {
            accessPolicy: policy.id as string,
            _count: '0',
          });

          const totalUsage = (users.total ?? 0) + (bots.total ?? 0) + (clients.total ?? 0);
          return { policy, usageCount: totalUsage };
        })
      );

      // Sort: system policies first, then by usage
      policiesWithCount.sort((a, b) => {
        const aIsSystem = a.policy.name?.includes('Policy') ? 1 : 0;
        const bIsSystem = b.policy.name?.includes('Policy') ? 1 : 0;
        if (aIsSystem !== bIsSystem) return bIsSystem - aIsSystem;
        return b.usageCount - a.usageCount;
      });

      setPolicies(policiesWithCount);
    } catch (err) {
      console.error('Error loading policies:', err);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to load access policies',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = (): void => {
    setEditMode('create');
    setEditPolicyId(undefined);
    setCloneSourcePolicy(undefined);
    setShowEditor(true);
  };

  const handleEdit = (policy: AccessPolicy): void => {
    setEditMode('edit');
    setEditPolicyId(policy.id);
    setShowEditor(true);
  };

  const handleClone = (policy: AccessPolicy): void => {
    setEditMode('create');
    setEditPolicyId(undefined);
    setCloneSourcePolicy(policy);
    setShowEditor(true);
  };

  const handleSave = (policy: AccessPolicy): void => {
    setShowEditor(false);
    setEditPolicyId(undefined);
    setCloneSourcePolicy(undefined);
    loadPolicies().catch(console.error);
  };

  const handleCancel = (): void => {
    setShowEditor(false);
    setEditPolicyId(undefined);
    setCloneSourcePolicy(undefined);
  };

  const systemPolicies = policies.filter((p) => p.policy.name?.includes('Policy') || p.policy.meta?.tag?.some((t) => t.code === 'system'));
  const customPolicies = policies.filter((p) => !p.policy.name?.includes('Policy') && !p.policy.meta?.tag?.some((t) => t.code === 'system'));

  return (
    <Paper p="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={3}>
            <IconLock size={24} style={{ marginRight: 8 }} />
            Access Policies
          </Title>
          <Button onClick={handleCreateNew}>+ New Policy</Button>
        </Group>

        <Text size="sm" c="dimmed">
          Access Policies control what resources users can access and what operations they can perform.
        </Text>

        {loading ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : (
          <Stack gap="lg">
            {/* System Policies */}
            {systemPolicies.length > 0 && (
              <Stack gap="md">
                <Title order={4}>Seeded Policies (System)</Title>
                <Text size="xs" c="dimmed">These policies are automatically created and managed by the system.</Text>
                <SimpleGrid cols={1} spacing="sm">
                  {systemPolicies.map(({ policy, usageCount }) => (
                    <AccessPolicyCard
                      key={policy.id}
                      policy={policy}
                      usageCount={usageCount}
                      onEdit={handleEdit}
                      onClone={handleClone}
                    />
                  ))}
                </SimpleGrid>
              </Stack>
            )}

            {/* Custom Policies */}
            <Stack gap="md">
              <Title order={4}>Custom Policies</Title>
              {customPolicies.length > 0 ? (
                <SimpleGrid cols={1} spacing="sm">
                  {customPolicies.map(({ policy, usageCount }) => (
                    <AccessPolicyCard
                      key={policy.id}
                      policy={policy}
                      usageCount={usageCount}
                      onEdit={handleEdit}
                      onClone={handleClone}
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <Paper p="xl" withBorder>
                  <Stack align="center" gap="xs">
                    <Text c="dimmed">No custom policies created yet</Text>
                    <Text size="xs" c="dimmed">
                      Create custom policies to control access in more specific ways
                    </Text>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Stack>
        )}
      </Stack>

      {/* Editor Modal */}
      <Modal
        opened={showEditor}
        onClose={handleCancel}
        title={editMode === 'create' ? 'Create Access Policy' : 'Edit Access Policy'}
        size="lg"
        fullScreen
      >
        <AccessPolicyEditor
          mode={editMode}
          policyId={editPolicyId}
          sourcePolicy={cloneSourcePolicy}
          onCancel={handleCancel}
          onSave={handleSave}
        />
      </Modal>
    </Paper>
  );
}
