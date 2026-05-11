import { webhookHandler, webhookRouter } from './routes';
import { Router } from 'express';

describe('Webhook Routes', () => {
  describe('Route Registration', () => {
    test.todo('should register POST /:id for bot webhooks');
    test.todo('should register POST /stripe for Stripe webhooks');
    test.todo('should register POST /twilio for Twilio SMS webhooks');
    test.todo('should register POST /twilio/status for Twilio status callbacks');
  });

  describe('Bot Webhook Handler', () => {
    test.todo('should require ProjectMembership ID');
    test.todo('should validate ProjectMembership is for Bot');
    test.todo('should require Access Policy on membership');
    test.todo('should check bot has publicWebhook flag');
    test.todo('should execute bot with POST body');
    test.todo('should execute bot with GET query params');
    test.todo('should pass headers to bot');
    test.todo('should return bot execution result');
    test.todo('should handle OperationOutcome errors');
    test.todo('should handle Binary return values');
  });

  describe('Stripe Webhook Route', () => {
    test.todo('should route to stripeWebhookHandler');
    test.todo('should parse JSON body');
    test.todo('should expose raw body for signature verification');
  });

  describe('Twilio Webhook Routes', () => {
    test.todo('should route SMS to twilioWebhookHandler');
    test.todo('should route status callbacks to twilioStatusCallbackHandler');
    test.todo('should parse form-encoded body');
  });
});
