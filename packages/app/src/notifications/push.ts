// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { showNotification } from '@mantine/notifications';
import { createReference, type MedplumClient } from '@medplum/core';
import type { Practitioner } from '@medplum/fhirtypes';

// Local storage keys
const PUSH_SUBSCRIBED_KEY = 'nursemel-push-subscribed';
const PUSH_SUBSCRIPTION_ID_KEY = 'nursemel-push-subscription-id';
const PUSH_SUBSCRIPTION_DATA_KEY = 'nursemel-push-subscription-data';
const INSTALL_PROMPT_DISMISSED_KEY = 'nursemel-install-prompt-dismissed';
const PUSH_PROMPT_DISMISSED_KEY = 'nursemel-push-prompt-dismissed';

/** Push subscription data stored in localStorage */
export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Check if running as standalone (Home Screen) app
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-ignore - Safari property
    window.navigator?.standalone === true
  );
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Check if running on mobile
 */
export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Check if user has already subscribed to push
 */
export function hasPushSubscription(): boolean {
  return localStorage.getItem(PUSH_SUBSCRIBED_KEY) === 'true';
}

/**
 * Mark push as subscribed
 */
export function markPushSubscribed(): void {
  localStorage.setItem(PUSH_SUBSCRIBED_KEY, 'true');
}

/**
 * Check if install prompt was dismissed
 */
export function isInstallPromptDismissed(): boolean {
  return localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === 'true';
}

/**
 * Dismiss install prompt
 */
export function dismissInstallPrompt(): void {
  localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');
}

/**
 * Check if push prompt was dismissed
 */
export function isPushPromptDismissed(): boolean {
  return localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === 'true';
}

/**
 * Dismiss push prompt
 */
export function dismissPushPrompt(): void {
  localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, 'true');
}

/**
 * Check if install prompt should be shown
 * (iOS standalone apps need install prompt, non-iOS get native install)
 */
export function shouldShowInstallPrompt(): boolean {
  // Only show on iOS devices that are not in standalone mode
  return isIOS() && !isStandalone() && !isInstallPromptDismissed();
}

/**
 * Check if push prompt should be shown
 * (Show if push is supported, not already subscribed, and prompt not dismissed)
 */
export function shouldShowPushPrompt(): boolean {
  return isPushSupported() && !hasPushSubscription() && !isPushPromptDismissed();
}

/**
 * Reset all prompts (for testing)
 */
export function resetPrompts(): void {
  localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
  localStorage.removeItem(INSTALL_PROMPT_DISMISSED_KEY);
  localStorage.removeItem(PUSH_PROMPT_DISMISSED_KEY);
  localStorage.removeItem(PUSH_SUBSCRIPTION_ID_KEY);
  localStorage.removeItem(PUSH_SUBSCRIPTION_DATA_KEY);
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.requestPermission();
}

/**
 * Check if notifications are allowed
 */
export function areNotificationsAllowed(): boolean {
  return Notification.permission === 'granted';
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(
  medplum: MedplumClient,
  vapidPublicKey: string,
  profile: Practitioner | undefined
): Promise<boolean> {
  console.log('[Push] subscribeToPush called');

  if (!isPushSupported()) {
    console.log('[Push] Push notifications not supported');
    return false;
  }

  try {
    // Request permission first
    const permission = await requestNotificationPermission();

    if (permission !== 'granted') {
      return false;
    }

    // Get service worker registration - register if needed
    // First check if any service worker is registered
    let registration = await navigator.serviceWorker.getRegistration();

    if (!registration) {
      try {
        registration = await navigator.serviceWorker.register('/service-worker.js');
      } catch (err) {
        console.error('[Push] Failed to register service worker:', err);
        return false;
      }
    }

    // Wait for service worker to be ready (with timeout)
    try {
      registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker ready timeout after 5s')), 5000)),
      ]) as ServiceWorkerRegistration;
    } catch (err) {
      console.error('[Push] Service worker ready failed:', err);
      // Continue anyway - some browsers might still work
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // Send subscription to server with practitioner profile
    await sendSubscriptionToServer(medplum, subscription, profile);

    // Mark as subscribed
    markPushSubscribed();
    console.log('[Push] Marked as subscribed');

    showNotification({
      title: 'Push Notifications Enabled',
      message: 'You will receive push notifications for appointments and treatments',
      color: 'green',
    });

    return true;
  } catch (err) {
    console.error('[Push] Subscription error:', err);
    showNotification({
      title: 'Error',
      message: 'Failed to enable push notifications',
      color: 'red',
    });
    return false;
  }
}

/**
 * Send subscription to server
 * Creates a Medplum Communication resource to store the push subscription
 * We use Communication instead of Subscription because Bots can query Communications
 */
async function sendSubscriptionToServer(
  medplum: MedplumClient,
  subscription: PushSubscription,
  profile: Practitioner | undefined
): Promise<void> {
  console.log('[Push] Storing subscription:', subscription);

  try {
    // Check for existing subscription ID in localStorage
    const existingSubId = localStorage.getItem(PUSH_SUBSCRIPTION_ID_KEY);
    if (existingSubId) {
      try {
        await medplum.deleteResource('Communication', existingSubId);
        console.log('[Push] Deleted old push registration:', existingSubId);
      } catch (err) {
        // Ignore errors - may not exist
        console.log('[Push] Could not delete old push registration:', err);
      }
    }

    // Extract subscription data
    const subJson = subscription.toJSON();
    const pushData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subJson.keys?.p256dh || '',
        auth: subJson.keys?.auth || '',
      },
    };

    // Create a Communication resource to store push subscription
    // This acts as a "push registration" that the Bot can query
    const pushRegistration: any = {
      resourceType: 'Communication',
      status: 'completed',
      category: [
        {
          coding: [
            {
              system: 'http://melissaknudson.com/notification-type',
              code: 'push-registration',
              display: 'Push Notification Registration',
            },
          ],
        },
      ],
      priority: 'routine',
      sent: new Date().toISOString(),
      sender: profile ? createReference(profile) : undefined,
      payload: [
        {
          contentString: JSON.stringify(pushData),
        },
      ],
      extension: [
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-category',
          valueString: 'push-registration',
        },
      ],
    };

    const created = await medplum.createResource(pushRegistration);
    console.log('[Push] Push registration stored:', created.id);

    // Store the registration ID so we can clean it up later
    localStorage.setItem(PUSH_SUBSCRIPTION_ID_KEY, created.id as string);

    // Also store locally for non-broadcast notifications
    localStorage.setItem(PUSH_SUBSCRIPTION_DATA_KEY, JSON.stringify(pushData));
    console.log('[Push] Push subscription data stored in localStorage');
  } catch (err) {
    console.error('[Push] Failed to store subscription:', err);
    throw err;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(medplum: MedplumClient): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
    }

    // Delete server-side registration if we have the ID
    const existingSubId = localStorage.getItem(PUSH_SUBSCRIPTION_ID_KEY);
    if (existingSubId) {
      try {
        await medplum.deleteResource('Communication', existingSubId);
        console.log('[Push] Deleted server registration:', existingSubId);
      } catch (err) {
        console.log('[Push] Could not delete server registration:', err);
      }
    }

    // Clear local storage
    localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
    localStorage.removeItem(PUSH_SUBSCRIPTION_ID_KEY);
    localStorage.removeItem(PUSH_SUBSCRIPTION_DATA_KEY);

    showNotification({
      title: 'Push Notifications Disabled',
      message: 'You will no longer receive push notifications',
      color: 'blue',
    });

    return true;
  } catch (err) {
    console.error('[Push] Unsubscribe error:', err);
    return false;
  }
}

/**
 * Get VAPID public key from server
 */
export async function getVapidPublicKey(medplum: MedplumClient): Promise<string | null> {
  try {
    // Use native fetch for non-FHIR endpoints
    const baseUrl = medplum.getBaseUrl();
    const response = await fetch(baseUrl + 'api/config');
    
    if (!response.ok) {
      console.error('[Push] Failed to get VAPID public key:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.vapidPublicKey) {
      return data.vapidPublicKey;
    }
    return null;
  } catch (err) {
    console.error('[Push] Failed to get VAPID public key:', err);
    return null;
  }
}

/**
 * Get push subscription data from localStorage
 */
export function getPushSubscriptionData(): PushSubscriptionData | null {
  const data = localStorage.getItem(PUSH_SUBSCRIPTION_DATA_KEY);
  if (!data) {
    return null;
  }
  try {
    return JSON.parse(data) as PushSubscriptionData;
  } catch {
    return null;
  }
}

/**
 * Convert URL-safe base64 to Uint8Array
 * Needed for the Push API
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as BufferSource;
}

/**
 * Initialize push notifications
 * Call this when the app loads to set up the service worker
 */
export async function initializePush(
  medplum: MedplumClient,
  vapidPublicKey: string,
  profile: Practitioner | undefined
): Promise<void> {
  if (!isPushSupported()) {
    console.log('[Push] Push notifications not supported');
    return;
  }

  // Check if already subscribed
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    console.log('[Push] Already subscribed');
    // Update server-side registration with practitioner profile
    await sendSubscriptionToServer(medplum, subscription, profile);
    markPushSubscribed();
  } else {
    console.log('[Push] Not subscribed yet');
  }
}
