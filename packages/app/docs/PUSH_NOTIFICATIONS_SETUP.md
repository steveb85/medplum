# Push Notifications Setup Guide

## Overview

This guide covers setting up browser push notifications for the Nurse Mel MedSpa application. Push notifications allow practice staff to receive alerts on their devices even when the app is closed.

**Key Points:**
- Push notifications are **automatically seeded** on server start (no manual deployment)
- Only works for **practice staff** (providers, coordinators, assistants) - not patients
- **iOS requires Home Screen installation** - users must add app to Home Screen first
- **Desktop works immediately** - no installation required

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER FLOW                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  MOBILE iOS:                                                │
│  1. User opens app → Shows "Add to Home Screen" guide      │
│  2. User adds to Home Screen → Opens from Home Screen icon   │
│  3. Shows "Enable Notifications" prompt → Grants permission │
│  4. Service Worker registered → Push subscription created  │
│  5. Subscription stored as FHIR Subscription               │
│                                                             │
│  DESKTOP:                                                   │
│  1. User logs in → Shows "Enable Notifications" prompt      │
│  2. Grants browser permission → Service Worker registered    │
│  3. Push subscription created → Stored in FHIR             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  NOTIFICATION FLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Coordinator creates appointment                         │
│  2. CreateAppointmentModal creates Communication resource  │
│  3. FHIR Subscription triggers Push Notification Bot       │
│  4. Bot reads stored push subscriptions                    │
│  5. Bot sends push via web-push library (VAPID keys)       │
│  6. Service Worker receives push → Shows system notification│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Auto-Seeding (Development & Production)

### What Gets Seeded Automatically

When the server starts (`npm run dev` or production deploy), the following are **automatically created:**

1. **Push Notification Bot** (`Bot` resource)
   - Code: Embedded TypeScript (no separate file needed)
   - Runtime: `vmcontext` (runs in Medplum's VM)
   - Triggers: When Communication resources are created

2. **Push Notification Subscription** (`Subscription` resource)
   - Watches for: `Communication?status=completed`
   - Triggers: Calls the Bot via REST hook

### Where the Bot Code Lives

The bot code is **embedded in `nursemel.ts`**:

```typescript
// Location: packages/server/src/seeds/nursemel.ts
// Function: createPushNotificationBot()

const PUSH_NOTIFICATION_BOT_CODE = `
  import { BotEvent, MedplumClient } from '@medplum/core';
  // ... bot code here
`;
```

**Why embedded?**
- ✅ Single file deployment
- ✅ Version controlled with seeds
- ✅ No separate build step needed
- ✅ Works in both dev and production

---

## Configuration

### Environment Variables

Add to **server** `.env` (not app):

```bash
# Medplum Server Environment
# Location: packages/server/.env (create if doesn't exist)

# VAPID Keys for Web Push
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=BG0--3ToODybCLHXg5-Mb2NjbsXmKestdGaDablbVWXJRFM5ZkdMnQX0o2Alv4kAw01zBQhnsdgBHXBs80J3en0
VAPID_PRIVATE_KEY=fZEWHHDXWPeiojAVwLrC5XhTTELVYhV4fRdbHDf12AI
```

**Important:** These must be available to the **server** (Node.js), not just the frontend.

### Frontend Environment (Already Done)

The frontend `.env` (in `packages/app/.env`) already has:

```bash
VITE_VAPID_PUBLIC_KEY=BG0--3ToODybCLHXg5-Mb2NjbsXmKestdGaDablbVWXJRFM5ZkdMnQX0o2Alv4kAw01zBQhnsdgBHXBs80J3en0
```

**Note:** Only the **public key** is needed in frontend. Private key stays on server.

---

## Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `packages/app/static/service-worker.js` | Handles push events in browser |
| `packages/app/static/manifest.json` | PWA manifest for Home Screen |
| `packages/app/src/notifications/push.ts` | Frontend push subscription logic |
| `packages/app/src/components/PwaInstallPrompt.tsx` | iOS Home Screen guide |
| `packages/app/src/components/PushNotificationPrompt.tsx` | Enable notifications prompt |

### Modified Files

| File | Changes |
|------|---------|
| `packages/app/index.html` | Added manifest link, PWA meta tags |
| `packages/app/src/App.tsx` | Added prompt detection & display |
| `packages/app/vite.config.ts` | Added `VITE_` env prefix |
| `packages/server/src/seeds/nursemel.ts` | Added `createPushNotificationBot()` and `createPushNotificationSubscription()` |

---

## Development Setup

### Step 1: Generate VAPID Keys (Already Done)

```bash
cd packages/app
npm install web-push --save-dev
npx web-push generate-vapid-keys
```

Copy keys to:
- `packages/app/.env` → `VITE_VAPID_PUBLIC_KEY`
- `packages/server/.env` → `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`

### Step 2: Install web-push on Server (One-time)

```bash
cd packages/server
npm install web-push
```

### Step 3: Restart Server

```bash
# Stop current server
# Restart
npm run dev
```

The Bot and Subscription will be **automatically seeded** on startup.

### Step 4: Verify Seeding

Check logs for:
```
Created push notification bot: Bot/[id]
Created push notification subscription: Subscription/[id]
```

---

## Production Deployment

### Step 1: Environment Variables

Set on production server:

```bash
# Add to production environment
export VAPID_PUBLIC_KEY="your_public_key"
export VAPID_PRIVATE_KEY="your_private_key"
```

### Step 2: Verify Bot is Seeded

On first production deploy, the Bot will be auto-created. Check:

```bash
# Query for the bot
curl "https://your-api.medplum.com/fhir/R4/Bot?name=Push%20Notification%20Sender"
```

### Step 3: Rotate VAPID Keys (Recommended)

For production:
1. Generate new VAPID keys
2. Update environment variables
3. Restart server
4. Users will need to re-subscribe (old subscriptions will fail gracefully)

---

## Testing Push Notifications

### Manual Test Flow

1. **Enable Push:**
   - Desktop: Click "Enable Notifications" on login
   - iOS: Add to Home Screen, then enable

2. **Create Test Notification:**
   - Book an appointment
   - Should see toast: "Appointment Booked"
   - Should receive system push notification

3. **Verify Delivery:**
   - Desktop: Check system tray/notification center
   - iOS: Check Lock Screen/Notification Center

4. **Click Notification:**
   - Should open app to Calendar (for appointments)
   - Or Treatment page (for treatment updates)

### Debug Mode

Add to browser console:

```javascript
// Check if service worker is registered
navigator.serviceWorker.ready.then(reg => console.log('SW:', reg));

// Check push subscription
navigator.serviceWorker.ready
  .then(reg => reg.pushManager.getSubscription())
  .then(sub => console.log('Subscription:', sub));

// Check local storage
console.log('Push subscribed:', localStorage.getItem('nursemel-push-subscribed'));
console.log('Prompt dismissed:', localStorage.getItem('nursemel-push-prompt-dismissed'));
```

---

## Troubleshooting

### "VAPID keys not configured"

**Cause:** Server environment variables not set

**Fix:**
```bash
# Check server has the keys
echo $VAPID_PUBLIC_KEY
echo $VAPID_PRIVATE_KEY

# If empty, add to packages/server/.env and restart
```

### "Push notifications not configured" (Frontend)

**Cause:** Frontend can't read VAPID public key

**Fix:**
```bash
# Check vite.config.ts has VITE_ prefix
envPrefix: ['MEDPLUM_', 'GOOGLE_', 'RECAPTCHA_', 'VITE_'],

# Restart dev server
```

### No system notification received

**Checklist:**
1. ✅ Service worker registered? (Check DevTools → Application → Service Workers)
2. ✅ Push subscription created? (Check DevTools → Application → Local Storage)
3. ✅ Bot is deployed? (Check Medplum Admin → Bots)
4. ✅ Subscription is active? (Check Medplum Admin → Subscriptions)
5. ✅ VAPID keys configured on server?

### iOS: "Add to Home Screen" not showing

**Cause:** Safari on iOS doesn't support beforeinstallprompt

**Fix:** Manual instructions are shown. Users must tap Share → Add to Home Screen.

---

## Managing Subscriptions

### View Active Subscriptions

```bash
curl "https://your-api.medplum.com/fhir/R4/Subscription?reason=Push%20notifications"
```

### Delete Expired Subscriptions

The bot automatically removes expired subscriptions (404/410 errors), but you can manually clean:

```typescript
// Query for old subscriptions
const subscriptions = await medplum.search('Subscription', {
  reason: 'Push notifications',
});

// Delete expired ones
for (const sub of subscriptions.entry || []) {
  await medplum.deleteResource('Subscription', sub.resource.id);
}
```

---

## Security Considerations

1. **VAPID Private Key:**
   - Never expose in frontend
   - Store securely in server environment
   - Rotate periodically

2. **Push Subscriptions:**
   - Stored as FHIR Subscription resources
   - Scoped to project
   - Users can only access their own

3. **Notification Content:**
   - Avoid PHI in push notifications (HIPAA)
   - Use generic messages: "New appointment" vs patient names
   - Full details in in-app notifications only

---

## Monitoring

### Check Bot Execution Logs

In Medplum Admin → Bots → Push Notification Sender → Audit Log

### Metrics to Track

- Push notifications sent
- Delivery success rate
- Expired subscription cleanup
- User enable rate

---

## Future Enhancements

- [ ] Send push for SMS replies (Phase 3D)
- [ ] Quiet hours/do not disturb
- [ ] Notification preferences per user
- [ ] A/B testing notification content
- [ ] Analytics on notification engagement

---

## Summary

| Aspect | Status | Location |
|--------|--------|----------|
| **Auto-seeding** | ✅ Complete | `packages/server/src/seeds/nursemel.ts` |
| **Frontend code** | ✅ Complete | `packages/app/src/notifications/push.ts` |
| **UI prompts** | ✅ Complete | `PwaInstallPrompt.tsx`, `PushNotificationPrompt.tsx` |
| **Service Worker** | ✅ Complete | `packages/app/static/service-worker.js` |
| **VAPID Keys** | ⚠️ Manual | Generate and add to server `.env` |

**Next Steps:**
1. Add VAPID keys to server environment
2. Restart server
3. Test on desktop and iOS
4. Monitor Bot execution logs
