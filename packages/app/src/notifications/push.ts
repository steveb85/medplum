// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { showNotification } from '@mantine/notifications';
import type { MedplumClient } from '@medplum/core';

// Local storage keys
const PUSH_SUBSCRIBED_KEY = 'nursemel-push-subscribed';
const PUSH_SUBSCRIPTION_ID_KEY = 'nursemel-push-subscription-id';
const INSTALL_PROMPT_DISMISSED_KEY = 'nursemel-install-prompt-dismissed';
const PUSH_PROMPT_DISMISSED_KEY = 'nursemel-push-prompt-dismissed';

/**
 * Check if running as standalone (Home Screen) app
 */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         // @ts-ignore - Safari property
         window.navigator?.standalone === true;
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
 * Reset all prompts (for testing)
 */
export function resetPrompts(): void {
  localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
  localStorage.removeItem(INSTALL_PROMPT_DISMISSED_KEY);
  localStorage.removeItem(PUSH_PROMPT_DISMISSED_KEY);
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('[Push] Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('[Push] Service worker registered:', registration);
    return registration;
  } catch (err) {
    console.error('[Push] Service worker registration failed:', err);
    return null;
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(medplum: MedplumClient): Promise<boolean> {
  try {
    // Check permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showNotification({
        title: 'Permission Required',
        message: 'Please allow notifications to receive alerts',
        color: 'yellow',
      });
      return false;
    }

    // Register service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      showNotification({
        title: 'Error',
        message: 'Push notifications not supported on this device',
        color: 'red',
      });
      return false;
    }

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Get VAPID public key from environment
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

      // Debug: Log all env vars
      console.log('[Push] Env vars available:', Object.keys(import.meta.env).filter(k => k.includes('VAPID') || k.includes('MEDPLUM')));
      console.log('[Push] VAPID key value:', vapidPublicKey ? 'Present (first 20 chars: ' + vapidPublicKey.substring(0, 20) + '...)' : 'MISSING');

      if (!vapidPublicKey) {
        console.error('[Push] VAPID public key not configured');
        console.error('[Push] Please set VITE_VAPID_PUBLIC_KEY in .env file');
        showNotification({
          title: 'Configuration Error',
          message: 'Push notifications not configured - VAPID key missing',
          color: 'red',
        });
        return false;
      }

  // Subscribe
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as ArrayBuffer,
    });
    }

    // Send subscription to server
    await sendSubscriptionToServer(medplum, subscription);

    markPushSubscribed();

    showNotification({
      title: 'Notifications Enabled',
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
 * Creates a Medplum Subscription resource to store the push subscription
 */
async function sendSubscriptionToServer(
  medplum: MedplumClient,
  subscription: PushSubscription
): Promise<void> {
  console.log('[Push] Storing subscription:', subscription);

  try {
    // Check for existing subscription ID in localStorage
    const existingSubId = localStorage.getItem(PUSH_SUBSCRIPTION_ID_KEY);
    if (existingSubId) {
      try {
        await medplum.deleteResource('Subscription', existingSubId);
        console.log('[Push] Deleted old subscription:', existingSubId);
      } catch (err) {
        // Ignore errors - subscription may not exist
        console.log('[Push] Could not delete old subscription:', err);
      }
    }

    // Create new Subscription resource to store push data
    // The bot will read this and send push notifications
    const pushSubscription: any = {
      resourceType: 'Subscription',
      status: 'active',
      reason: 'Push notifications',
      criteria: 'Communication?recipient=me',
      channel: {
        type: 'websocket',
        endpoint: subscription.endpoint,
        payload: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: subscription.toJSON().keys,
        }),
      },
    };

    const created = await medplum.createResource(pushSubscription);
    console.log('[Push] Subscription stored:', created.id);

    // Store the subscription ID so we can clean it up later
    localStorage.setItem(PUSH_SUBSCRIPTION_ID_KEY, created.id as string);
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

    // Delete server-side subscription if we have the ID
    const existingSubId = localStorage.getItem(PUSH_SUBSCRIPTION_ID_KEY);
    if (existingSubId) {
      try {
        await medplum.deleteResource('Subscription', existingSubId);
        console.log('[Push] Deleted server subscription:', existingSubId);
      } catch (err) {
        console.log('[Push] Could not delete server subscription:', err);
      }
    }

    localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
    localStorage.removeItem(PUSH_SUBSCRIPTION_ID_KEY);

    showNotification({
      title: 'Notifications Disabled',
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
 * Convert base64 to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Check if should show install prompt
 */
export function shouldShowInstallPrompt(): boolean {
  // Only on mobile iOS
  if (!isMobile() || !isIOS()) {
    return false;
  }

  // Not already standalone
  if (isStandalone()) {
    return false;
  }

  // Not already dismissed
  if (isInstallPromptDismissed()) {
    return false;
  }

  return true;
}

/**
 * Check if should show push prompt
 */
export function shouldShowPushPrompt(): boolean {
  // Only if push is supported
  if (!isPushSupported()) {
    return false;
  }

  // On mobile iOS, must be standalone
  if (isMobile() && isIOS() && !isStandalone()) {
    return false;
  }

  // Not already subscribed
  if (hasPushSubscription()) {
    return false;
  }

  // Not already dismissed
  if (isPushPromptDismissed()) {
    return false;
  }

  return true;
}
