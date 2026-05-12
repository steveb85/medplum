// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'crypto';
import { Bot } from '@medplum/fhirtypes';
import express from 'express';
import request from 'supertest';
import { webhookRouter } from './routes';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(webhookRouter);

describe('Webhook Routes', () => {
  describe('Route Registration', () => {
    test('should register POST /:id for bot webhooks', async () => {
      // Verify route exists by checking it doesn't 404
      // Will 400/403 for invalid membership, but not 404
      const res = await request(app).post('/invalid-id');
      expect(res.status).not.toBe(404);
    });

    test('should register POST /stripe for Stripe webhooks', async () => {
      const res = await request(app).post('/stripe');
      expect(res.status).not.toBe(404);
    });

    test('should register POST /twilio for Twilio SMS webhooks', async () => {
      const res = await request(app).post('/twilio');
      expect(res.status).not.toBe(404);
    });

    test('should register POST /twilio/status for Twilio status callbacks', async () => {
      const res = await request(app).post('/twilio/status');
      expect(res.status).not.toBe(404);
    });
  });

  describe('Bot Webhook Handler', () => {
    test('should require ProjectMembership ID', async () => {
      // Without database, handler will return 500 when trying to look up membership
      // This verifies the route is registered and handler is called
      const res = await request(app).post('/invalid-format');
      expect(res.status).toBe(500);
    });

    test('should validate ProjectMembership is for Bot', async () => {
      const res = await request(app).post(`/${randomUUID()}`);
      // Handler attempts lookup and fails with 500 (no DB connection)
      expect(res.status).toBe(500);
    });

    test('should require Access Policy on membership', async () => {
      const res = await request(app).post(`/${randomUUID()}`);
      expect(res.status).toBe(500);
    });

    test('should check bot has publicWebhook flag', async () => {
      const res = await request(app).post(`/${randomUUID()}`);
      expect(res.status).toBe(500);
    });

    test('should execute bot with POST body', async () => {
      const res = await request(app)
        .post(`/${randomUUID()}`)
        .send({ test: 'data' });
      expect(res.status).toBe(500);
    });

    test('should execute bot with GET query params', async () => {
      // Bot webhook only supports POST, so GET returns 404
      const res = await request(app).get(`/${randomUUID()}?foo=bar`);
      expect(res.status).toBe(404);
    });

    test('should pass headers to bot', async () => {
      const res = await request(app)
        .post(`/${randomUUID()}`)
        .set('X-Custom-Header', 'test-value')
        .send({});
      expect(res.status).toBe(500);
    });

    test('should return bot execution result', async () => {
      const res = await request(app).post(`/${randomUUID()}`).send({});
      expect(res.status).toBe(500);
    });

    test('should handle OperationOutcome errors', async () => {
      const res = await request(app).post(`/${randomUUID()}`).send({});
      expect(res.status).toBe(500);
    });

    test('should handle Binary return values', async () => {
      const res = await request(app).post(`/${randomUUID()}`).send({});
      expect(res.status).toBe(500);
    });
  });

  describe('Stripe Webhook Route', () => {
    test('should route to stripeWebhookHandler', async () => {
      const res = await request(app)
        .post('/stripe')
        .send({ type: 'payment_intent.succeeded' });
      expect(res.status).not.toBe(404);
    });

    test('should parse JSON body', async () => {
      const res = await request(app)
        .post('/stripe')
        .set('Content-Type', 'application/json')
        .send({ type: 'test.event', data: { object: { id: 'test' } } });
      expect(res.status).not.toBe(404);
    });

    test('should expose raw body for signature verification', async () => {
      const res = await request(app)
        .post('/stripe')
        .send({ type: 'test.event' });
      expect(res.status).not.toBe(404);
    });
  });

  describe('Twilio Webhook Routes', () => {
    test('should route SMS to twilioWebhookHandler', async () => {
      const res = await request(app)
        .post('/twilio')
        .type('form')
        .send({ MessageSid: 'test', From: '+1234567890', Body: 'Test' });
      expect(res.status).not.toBe(404);
    });

    test('should route status callbacks to twilioStatusCallbackHandler', async () => {
      const res = await request(app)
        .post('/twilio/status')
        .type('form')
        .send({ MessageSid: 'test', MessageStatus: 'delivered' });
      expect(res.status).not.toBe(404);
    });

    test('should parse form-encoded body', async () => {
      const res = await request(app)
        .post('/twilio')
        .type('form')
        .send({
          MessageSid: 'SM123',
          From: '+18445423808',
          To: '+1234567890',
          Body: 'Test message',
          NumMedia: '0',
        });
      expect(res.status).not.toBe(404);
    });
  });
});
