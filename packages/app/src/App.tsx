// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { MEDPLUM_VERSION } from '@medplum/core';
import type { UserConfiguration } from '@medplum/fhirtypes';
import type { NavbarMenu } from '@medplum/react';
import { AppShell, Loading, Logo, useMedplum } from '@medplum/react';
import {
  IconBrandAsana,
  IconBuilding,
  IconCalendar,
  IconClipboardList,
  IconDatabase,
  IconFolder,
  IconForms,
  IconId,
  IconLock,
  IconLockAccess,
  IconMicroscope,
  IconPackages,
  IconReceipt,
  IconReportMedical,
  IconStar,
  IconWebhook,
  IconBell,
} from '@tabler/icons-react';
import type { FunctionComponent, JSX } from 'react';
import { Suspense, useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { AppRoutes } from './AppRoutes';
import { filterMenuLinks, getMedSpaRole, type MedSpaRole } from './auth/role';
import { getUnreadNotificationCount } from './notifications/utils';
import {
  shouldShowInstallPrompt,
  shouldShowPushPrompt,
  isMobile,
  isIOS,
} from './notifications/push';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { PushNotificationPrompt } from './components/PushNotificationPrompt';

import './App.css';

export function App(): JSX.Element {
  const medplum = useMedplum();
  const config = medplum.getUserConfiguration();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  // Check for prompts on mount (for logged-in users)
  useEffect(() => {
    const checkPrompts = () => {
      const profile = medplum.getProfile();
      if (!profile) return; // Only show prompts to logged-in users

      // Mobile iOS: Show install prompt first
      if (isMobile() && isIOS()) {
        if (shouldShowInstallPrompt()) {
          setShowInstallPrompt(true);
        } else if (shouldShowPushPrompt()) {
          // Only show push prompt if install prompt was already handled
          setShowPushPrompt(true);
        }
      }
      // Desktop: Show push prompt immediately
      else if (!isMobile() && shouldShowPushPrompt()) {
        setShowPushPrompt(true);
      }
    };

    // Small delay to not overwhelm on login
    const timer = setTimeout(checkPrompts, 1000);
    return () => clearTimeout(timer);
  }, [medplum]);

  // Poll for unread notifications on navigation
  useEffect(() => {
    const checkNotifications = async () => {
      const user = medplum.getProfile();
      if (user?.id) {
        try {
          const count = await getUnreadNotificationCount(medplum, user.id);
          setUnreadCount(count);
        } catch {
          // Silently fail - not critical
        }
      }
    };

    checkNotifications();
    // Check every 30 seconds while on any page
    const interval = setInterval(checkNotifications, 30000);
    return () => clearInterval(interval);
  }, [medplum, location.pathname]);

  if (medplum.isLoading()) {
    return <Loading />;
  }

  // Get user's MedSpa role for UI filtering
  const role = getMedSpaRole(medplum);

  const handleInstallDismiss = () => {
    setShowInstallPrompt(false);
    // After dismissing install prompt, check if we should show push prompt
    if (shouldShowPushPrompt()) {
      setShowPushPrompt(true);
    }
  };

  return (
    <>
      <AppShell
        logo={<Logo size={24} />}
        pathname={location.pathname}
        searchParams={searchParams}
        version={MEDPLUM_VERSION}
        menus={userConfigToMenu(config, role, unreadCount)}
        displayAddBookmark={!!config?.id}
      >
        <Suspense fallback={<Loading />}>
          <AppRoutes />
        </Suspense>
      </AppShell>

      {/* Mobile iOS Install Prompt */}
      {showInstallPrompt && (
        <PwaInstallPrompt
          onDismiss={handleInstallDismiss}
          onInstall={handleInstallDismiss}
        />
      )}

      {/* Push Notification Prompt (Desktop or iOS Home Screen) */}
      {showPushPrompt && !showInstallPrompt && (
        <PushNotificationPrompt
          onDismiss={() => setShowPushPrompt(false)}
          onSuccess={() => {
            setShowPushPrompt(false);
            // Refresh unread count after enabling push
          }}
        />
      )}
    </>
  );
}

// Notification icon with unread dot
function NotificationIcon({ unreadCount }: { unreadCount: number }): JSX.Element {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <IconBell size={20} />
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            backgroundColor: 'var(--mantine-color-red-6)',
            borderRadius: '50%',
            border: '2px solid var(--mantine-color-body)',
          }}
        />
      )}
    </div>
  );
}

function userConfigToMenu(
  config: UserConfiguration | undefined,
  role: MedSpaRole,
  unreadCount: number
): NavbarMenu[] {
  // Build the menu from user configuration
  const result =
    config?.menu?.map((menu) => ({
      title: menu.title,
      links:
        menu.link?.map((link) => ({
          label: link.name,
          href: link.target,
          icon: getIcon(link.target),
        })) || [],
    })) || [];

  // Inject Bookings, Calendar and Notifications links into the first menu (usually Favorites or main menu)
  // These are visible to all roles
  if (result.length > 0) {
    result[0].links.unshift(
      {
        label: 'Notifications',
        href: '/notifications',
        icon: <NotificationIcon unreadCount={unreadCount} />,
      },
      {
        label: 'Bookings',
        href: '/bookings',
        icon: <IconClipboardList />,
      },
      {
        label: 'Calendar',
        href: '/calendar',
        icon: <IconCalendar />,
      }
    );
  }

  // Filter menu links based on role
  const filteredResult = result.map((menu) => ({
    ...menu,
    links: filterMenuLinks(menu.links, role),
  }));

  // Filter out empty menus (no visible links)
  const nonEmptyMenus = filteredResult.filter((menu) => menu.links.length > 0);

  // Find Organization menu and add Services link to it
  const orgMenu = nonEmptyMenus.find((menu) => menu.title === 'Organization');
  if (orgMenu && (role === 'coordinator' || role === 'provider')) {
    orgMenu.links.unshift({
      label: 'Services',
      href: '/admin/services',
      icon: <IconBuilding />,
    });
  }

  // Add Settings menu (visible to all roles)
  nonEmptyMenus.push({
    title: 'Settings',
    links: [
      {
        label: 'Security',
        href: '/security',
        icon: <IconLock />,
      },
    ],
  });

  return nonEmptyMenus;
}

const resourceTypeToIcon: Record<string, FunctionComponent> = {
  Patient: IconStar,
  Practitioner: IconId,
  Organization: IconBuilding,
  ServiceRequest: IconReceipt,
  DiagnosticReport: IconReportMedical,
  Questionnaire: IconForms,
  Project: IconFolder,
  admin: IconBrandAsana,
  AccessPolicy: IconLockAccess,
  Subscription: IconWebhook,
  batch: IconPackages,
  Observation: IconMicroscope,
};

function getIcon(to: string): JSX.Element | undefined {
  if (to.includes('admin/super/db')) {
    return <IconDatabase />;
  }
  try {
    const resourceType = new URL(to, 'https://app.medplum.com').pathname.split('/')[1];
    if (resourceType in resourceTypeToIcon) {
      const Icon = resourceTypeToIcon[resourceType];
      return <Icon />;
    }
  } catch (_err) {
    // Ignore
  }
  return undefined;
}
