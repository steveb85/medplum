# Push Notification Bot Setup

## Overview

This bot sends browser push notifications to practice staff when:
- New appointments are booked
- Treatments are started/completed
- Photos are uploaded

## Setup Steps

### 1. Install Dependencies

```bash
npm install web-push
```

### 2. Generate VAPID Keys (Already Done)

Keys are in `.env`:
```bash
VITE_VAPID_PUBLIC_KEY=xxx
VAPID_PRIVATE_KEY=xxx
```

### 3. Create the Bot in Medplum

1. Go to Medplum Admin → Bots
2. Create new Bot: "Push Notification Sender"
3. Upload `push-notification-sender.ts`
4. Set runtime: `vmcontext`

### 4. Create Subscription

Create a FHIR Subscription that triggers the bot:

```json
{
  "resourceType": "Subscription",
  "status": "active",
  "reason": "Send push notifications",
  "criteria": "Communication?status=completed",
  "channel": {
    "type": "rest-hook",
    "endpoint": "Bot/push-notification-sender/$execute",
    "payload": "application/fhir+json"
  }
}
```

### 5. Set Environment Variables in Medplum

Add to Medplum server environment:
```bash
VAPID_PUBLIC_KEY=xxx
VAPID_PRIVATE_KEY=xxx
```

### 6. Test

1. Enable push notifications in browser
2. Create an appointment
3. Check for push notification

## How It Works

1. **Frontend**: User clicks "Enable Notifications" → Service Worker registered → Push subscription created → Stored as FHIR Subscription
2. **Event**: Communication created (notification)
3. **Bot**: Reads push subscriptions → Sends push via web-push library
4. **Device**: Service Worker receives push → Shows system notification

## Troubleshooting

### No push received?
- Check browser console for service worker errors
- Verify VAPID keys are configured
- Check Bot logs in Medplum
- Ensure Subscription is active

### Invalid subscription?
- Subscriptions expire, users need to re-enable
- Bot auto-removes expired subscriptions (404/410 errors)

## Files

- `push-notification-sender.ts` - The Bot code
- `../src/notifications/push.ts` - Frontend subscription logic
- `../static/service-worker.js` - Service worker for push handling
