# Push Notifications System Documentation

## Overview

Browser push notification system for Nurse Mel MedSpa. Allows staff to receive system tray notifications on desktop and mobile devices even when the app is closed.

**Key Features:**
- ✅ Works on desktop Chrome/Edge/Firefox
- ✅ Works on iOS Safari (requires Home Screen installation)
- ✅ Works on Android Chrome
- ✅ Broadcast notifications to all staff
- ✅ Targeted notifications to assigned providers
- ✅ Automatic subscription management

---

## Architecture

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│ SUBSCRIPTION FLOW                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. User clicks "Enable Notifications"                          │
│ 2. Browser requests push permission                              │
│ 3. Service Worker registers with PushManager                    │
│ 4. PushSubscription created (endpoint + keys)                    │
│ 5. Frontend creates Communication resource:                      │
│    - category: [{coding: [{code: "push-registration"}]}]         │
│    - sender: Practitioner/<user-id>                              │
│    - payload: [{contentString: JSON.stringify(pushData)}]      │
│ 6. Bot reads Communication, extracts practitioner ID            │
│ 7. Bot stores push data indexed by practitioner ID               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ NOTIFICATION FLOW                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. Event occurs (booking created, cancelled, etc)                │
│ 2. Frontend creates Communication:                               │
│    - category: [{coding: [{code: "appointment-created"}]}]        │
│    - recipient: [{reference: "Practitioner/<id>"}]             │
│    - payload: [{contentString: "Patient appointment booked"}]    │
│ 3. FHIR Subscription triggers Bot (rest-hook)                   │
│ 4. Bot receives Communication                                    │
│ 5. Bot looks up push subscriptions by recipient IDs              │
│ 6. Bot sends push via web-push library                          │
│ 7. Browser displays system notification                          │
│ 8. User clicks notification → opens app                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why Communication Resources?

We use FHIR **Communication** resources (not Subscription) to store push subscriptions because:

| Approach | Works? | Why? |
|----------|--------|------|
| FHIR Subscription | ❌ No | Bots cannot query Subscriptions created by users (permission issue) |
| Communication | ✅ Yes | Bots CAN query Communications, and sender field links to practitioner |
| LocalStorage only | ❌ No | Can't share across users for broadcasts |

**Key insight:** The `sender` field on Communication identifies which practitioner the push subscription belongs to.

---

## File Structure

### Frontend

| File | Purpose |
|------|---------|
| `packages/app/src/notifications/push.ts` | Push subscription, permission handling, VAPID key fetching |
| `packages/app/src/notifications/utils.ts` | `createNotification()`, `createBroadcastNotification()`, `getNotificationRecipients()` |
| `packages/app/src/notifications/templates.ts` | Notification formatting, types |
| `packages/app/src/components/PushNotificationPrompt.tsx` | Enable notifications UI prompt |
| `packages/app/src/components/PwaInstallPrompt.tsx` | iOS Home Screen installation guide |
| `packages/app/static/service-worker.js` | Handles push events, displays notifications |

### Backend

| File | Purpose |
|------|---------|
| `packages/server/src/seeds/nursemel.ts` | Push Notification Bot code, AccessPolicy, Subscription trigger |
| `packages/server/src/app.ts` | `/api/config` endpoint for VAPID public key |
| `packages/server/src/cors.ts` | CORS configuration (added `/api/` prefix) |

---

## Data Flow

### Push Registration Data Structure

```typescript
// Communication resource for push registration
{
  resourceType: "Communication",
  status: "completed",
  category: [{
    coding: [{
      system: "http://melissaknudson.com/notification-type",
      code: "push-registration",
      display: "Push Notification Registration"
    }]
  }],
  sender: { reference: "Practitioner/924cf731-5574-4afe-960d-0554c2b1c1ff" }, // ← KEY FIELD
  sent: "2026-04-24T15:10:01.000Z",
  payload: [{
    contentString: JSON.stringify({
      endpoint: "https://fcm.googleapis.com/fcm/send/...",
      keys: {
        p256dh: "BJTf0zC1KzTRLAIX0BoUaYz7bamumbc2Oo4na_8fQZnnH87KxjCuNKtJ_1015bFxxhqf22o0Lh5xy2Dl5F2Cpqs",
        auth: "j6NzZNI_xrhesOyirBFQCQ"
      }
    })
  }],
  extension: [{
    url: "http://melissaknudson.com/fhir/StructureDefinition/notification-category",
    valueString: "push-registration"
  }]
}
```

### Notification Data Structure

```typescript
// Communication resource for actual notification
{
  resourceType: "Communication",
  status: "completed",
  category: [{
    coding: [{
      system: "http://melissaknudson.com/notification-type",
      code: "appointment-created", // or "broadcast", "appointment-cancelled", etc
      display: "New Appointment"
    }]
  }],
  recipient: [
    { reference: "Practitioner/3c48e582-12d6-477d-82a7-6f55efcdab1f" },
    { reference: "Practitioner/ba011ab1-3f93-440e-bdee-23e10117abda" }
  ],
  sent: "2026-04-24T15:30:00.000Z",
  payload: [{
    contentString: "Sarah Chen - Botox appointment tomorrow at 2:00 PM"
  }],
  extension: [
    { url: ".../notification-read", valueBoolean: false },
    { url: ".../notification-category", valueString: "appointment" }
  ]
}
```

---

## Bot Logic

### How the Bot Finds Push Subscriptions

The Bot uses a **unified approach** for both broadcast and targeted notifications:

```typescript
// 1. Query ALL push registrations from FHIR
const allPushSubscriptions = await getAllPushSubscriptions(medplum);
// Returns: { practitionerId -> [pushData] }

// 2. Determine target practitioners
let targetPractitionerIds = [];
if (isBroadcast) {
  // Broadcast: Send to ALL practitioners with subscriptions
  targetPractitionerIds = Object.keys(allPushSubscriptions);
} else {
  // Targeted: Send only to Communication recipients who have subscriptions
  for (const recipient of communication.recipient) {
    if (recipient.reference?.startsWith('Practitioner/')) {
      targetPractitionerIds.push(recipient.reference.split('/')[1]);
    }
  }
}

// 3. Send to each target practitioner
for (const practitionerId of targetPractitionerIds) {
  const subscriptions = allPushSubscriptions[practitionerId] || [];
  
  for (const subscription of subscriptions) {
    await sendPushNotification(subscription, { title, body, url });
  }
}
```

### Broadcast vs Targeted Notifications

| Aspect | Broadcast | Targeted (e.g., appointment-created) |
|--------|-----------|----------------------------------------|
| **Trigger** | User clicks "Send Broadcast" | Booking created, treatment updated |
| **Recipients** | ALL practitioners with subscriptions | Only assigned providers/assistants |
| **Communication.category** | `broadcast` | `appointment-created`, etc. |
| **Bot behavior** | Sends to ALL subscriptions | Sends only to Communication recipients |
| **Use Case** | Patient messages, announcements | Provider-specific tasks |
| **Example** | "Patient asking about pricing" | "New Botox appointment tomorrow" |

### When to Use Each

**Broadcast Notifications** - Send to ALL staff:
- 🗣️ **Patient communications** - Incoming messages from patients
- 📢 **Company announcements** - System maintenance, new features
- 🚨 **Urgent alerts** - Building closure, emergency updates
- 📋 **Broadcast to everyone** - Any message the entire practice needs to see

**Targeted Notifications** - Send to SPECIFIC staff:
- 📅 **New bookings** - Provider assigned to appointment
- 🔄 **Booking changes** - Reschedules, cancellations affecting provider
- 💉 **Treatment updates** - Patient ready for Botox, photos uploaded
- 📸 **Photo uploads** - Before/after photos ready for review
- 📝 **Notes added** - Consultation notes on provider's patient
- ⚠️ **Assigned tasks** - Only the responsible provider needs to know

**Why this matters:**
- Broadcasts keep everyone informed (shared inbox concept)
- Targeted notifications reduce noise (only relevant people get alerted)
- Providers can focus on their patients without being interrupted by others' tasks

### Why Query from FHIR?

We query all push registrations from FHIR (instead of embedding in Communication) because:

- ✅ **Scalable:** Single query per notification, not N queries
- ✅ **Consistent:** Same approach for broadcast and targeted
- ✅ **Real-time:** Always gets current subscriptions
- ✅ **Works across users:** Coordinator can find provider's subscription

**Before:** Communication had `push-subscriptions` extension - only contained creator's data

**After:** Bot queries all `push-registration` Communications from FHIR indexed by sender

---

## Configuration

### Server Configuration

Add to `packages/server/.env`:

```bash
# VAPID Keys for Web Push
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=BG0--3ToODybCLHXg5-Mb2NjbsXmKestdGaDablbVWXJRFM5ZkdMnQX0o2Alv4kAw01zBQhnsdgBHXBs80J3en0
VAPID_PRIVATE_KEY=fZEWHHDXWPeiojAVwLrC5XhTTELVYhV4fRdbHDf12AI
```

**Important:** The server reads these via `packages/server/src/index.ts`:

```typescript
// Copy VAPID keys from config to process.env for Bot access
if (config.VAPID_PUBLIC_KEY) {
  process.env.VAPID_PUBLIC_KEY = config.VAPID_PUBLIC_KEY;
}
if (config.VAPID_PRIVATE_KEY) {
  process.env.VAPID_PRIVATE_KEY = config.VAPID_PRIVATE_KEY;
}
```

### Frontend Configuration

The frontend fetches the VAPID public key from `/api/config`:

```typescript
const response = await medplum.get('/api/config');
const vapidPublicKey = response.vapidPublicKey;
```

This endpoint is defined in `packages/server/src/app.ts`:

```typescript
apiRouter.get('/config', (_req, res) => {
  res.json({
    vapidPublicKey: config.VAPID_PUBLIC_KEY || '',
  });
});
```

---

## CORS Configuration

The `/api/config` endpoint needs CORS. Added to `packages/server/src/cors.ts`:

```typescript
const prefixes = [
  '/.well-known/',
  '/admin/',
  '/api/',        // ← ADDED for /api/config
  '/auth/',
  '/cds-services',
  '/email/',
  '/fhir/',
  '/fhircast/',
  '/oauth2/',
  '/keyvalue/',
  '/storage/',
];
```

---

## Bot Permissions

The Bot needs an AccessPolicy to read Communications and Practitioners:

```typescript
// In packages/server/src/seeds/nursemel.ts
const policy = await systemRepo.createResource<AccessPolicy>({
  resourceType: 'AccessPolicy',
  name: 'Push Notification Bot Policy',
  resource: [
    { resourceType: 'Communication', interaction: ['read', 'search'] },
    { resourceType: 'Practitioner', interaction: ['read', 'search'] },
  ],
});
```

**Note:** Bot runs with `admin: true` on ProjectMembership to read all resources:

```typescript
await systemRepo.createResource<ProjectMembership>({
  resourceType: 'ProjectMembership',
  user: createReference(bot),
  profile: createReference(bot),
  admin: true,  // ← Allows reading ALL Communications
  access: [{ policy: createReference(accessPolicy) }],
});
```

---

## Notification Types

### Event Types → Recipients

| Event Type | Recipients | Excludes Self? |
|------------|------------|----------------|
| `appointment-created` | Main provider + Assistant | ✅ Yes |
| `appointment-cancelled` | Main provider + Assistant | ✅ Yes |
| `appointment-rescheduled` | Main provider + Assistant | ✅ Yes |
| `treatment-started` | Assistant | N/A |
| `treatment-completed` | Assistant | N/A |
| `photos-uploaded` | Main provider | ✅ Yes |
| `notes-added` | Main provider | ✅ Yes |
| `broadcast` | ALL practitioners | ❌ No (sends to all) |

### Self-Exclusion Logic

```typescript
// In getNotificationRecipients()
if (data.provider && data.provider.id !== currentUser?.id) {
  recipients.push(createReference(data.provider));
}
```

This prevents users from being notified about their own actions.

---

## Service Worker

The service worker handles incoming push events:

```javascript
// packages/app/static/service-worker.js
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const title = data.title || 'Nurse Mel';
  const options = {
    body: data.body || 'New notification',
    icon: '/img/medplum-logo-512x512.png',
    badge: '/img/medplum-logo-192x192.png',
    data: {
      url: data.url || '/',
      notificationId: data.notificationId,
    },
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.openWindow(url)
  );
});
```

---

## LocalStorage Keys

| Key | Purpose |
|-----|---------|
| `nursemel-push-subscribed` | `true` if user has enabled push |
| `nursemel-push-subscription-id` | Communication ID of push registration |
| `nursemel-push-subscription-data` | Push subscription data (endpoint, keys) |
| `nursemel-push-prompt-dismissed` | `true` if user dismissed the prompt |
| `nursemel-install-prompt-dismissed` | `true` if user dismissed iOS install prompt |

---

## Testing

### Test Checklist

1. **Subscribe to push:**
   - Login as provider
   - Click "Enable Notifications"
   - Check localStorage: `nursemel-push-subscribed` = `true`
   - Check Communication created: `category` = `push-registration`
   - Check Communication has `sender` field set

2. **Send broadcast:**
   - Go to Notifications page
   - Click "Send Test Broadcast"
   - Check system notification appears
   - Click notification → opens app

3. **Test self-exclusion:**
   - Create booking as Provider A
   - Provider A should NOT get notification
   - Provider B should get notification

4. **Verify Bot logs:**
   - Check server logs for `[Push Bot]` messages
   - Verify subscription found for practitioner
   - Verify notification sent

### Debug Commands

```javascript
// Check service worker
navigator.serviceWorker.ready.then(r => console.log('SW:', r));

// Check push subscription
navigator.serviceWorker.ready
  .then(r => r.pushManager.getSubscription())
  .then(s => console.log('Sub:', s));

// Check localStorage
console.log('Subscribed:', localStorage.getItem('nursemel-push-subscribed'));
console.log('Sub ID:', localStorage.getItem('nursemel-push-subscription-id'));

// Reset for testing
localStorage.removeItem('nursemel-push-subscribed');
localStorage.removeItem('nursemel-push-subscription-id');
localStorage.removeItem('nursemel-push-subscription-data');
```

---

## Troubleshooting

### Issue: No system notification received

**Checklist:**
1. ✅ Service worker registered? `navigator.serviceWorker.ready`
2. ✅ Push subscribed? `localStorage.getItem('nursemel-push-subscribed')`
3. ✅ Communication created with `sender`? Check FHIR
4. ✅ Bot executed? Check server logs for `[Push Bot]`
5. ✅ Subscription found? Check `[Push Bot] Found X push subscriptions`
6. ✅ VAPID keys configured? `process.env.VAPID_PUBLIC_KEY`

### Issue: "Skipping - sender is not a Practitioner"

**Cause:** Push registration Communication was created BEFORE the `sender` field was added.

**Fix:**
1. Unsubscribe: Clear localStorage keys
2. Delete old Communication
3. Re-subscribe

```javascript
// Clear and re-subscribe
localStorage.removeItem('nursemel-push-subscribed');
localStorage.removeItem('nursemel-push-subscription-id');
localStorage.removeItem('nursemel-push-subscription-data');
// Then click "Enable Notifications" again
```

### Issue: CORS error on /api/config

**Cause:** `/api/` not in CORS prefixes.

**Fix:** Add `/api/` to `packages/server/src/cors.ts` prefixes array.

### Issue: Broadcast works but targeted notifications don't

**Symptoms:**
- ✅ Broadcast notifications send to all users
- ❌ Appointment-created notifications only show in-app, not system tray

**Cause:** Bot was looking for push subscriptions in Communication extension, but only creator's subscription was stored there.

**Fix:** Bot now queries ALL push registrations from FHIR for both broadcast AND targeted notifications. See "How the Bot Finds Push Subscriptions" section above.

**After fix:**
1. Coordinator creates booking
2. Communication created with recipients (provider + assistant)
3. Bot queries ALL push registrations from FHIR
4. Bot finds provider's subscription (by sender)
5. Bot sends push to provider

---

## Security

### VAPID Keys

- **Public key:** Sent to browser, used for subscription
- **Private key:** Server-only, used for signing push requests
- **Rotation:** Change keys periodically; users will auto-re-subscribe

### PHI Handling

- ✅ Push notifications contain NO patient names
- ✅ Generic messages: "New appointment" not "Sarah Chen's appointment"
- ✅ Full details only in in-app notifications
- ✅ All data stays within HIPAA-compliant Medplum

---

## Summary

| Component | Status | File |
|-----------|--------|------|
| Frontend subscription | ✅ Complete | `packages/app/src/notifications/push.ts` |
| Frontend notifications | ✅ Complete | `packages/app/src/notifications/utils.ts` |
| Service worker | ✅ Complete | `packages/app/static/service-worker.js` |
| Push Notification Bot | ✅ Complete | `packages/server/src/seeds/nursemel.ts` |
| Bot AccessPolicy | ✅ Complete | `packages/server/src/seeds/nursemel.ts` |
| CORS configuration | ✅ Complete | `packages/server/src/cors.ts` |
| /api/config endpoint | ✅ Complete | `packages/server/src/app.ts` |
| VAPID key loading | ✅ Complete | `packages/server/src/index.ts` |

---

## Future Enhancements

- [ ] Quiet hours / Do Not Disturb
- [ ] Per-user notification preferences
- [ ] Notification analytics
- [ ] SMS fallback for critical alerts
- [ ] Rich notifications with actions
