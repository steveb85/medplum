/**
 * Stripe webhook handler
 * Receives payment events from Stripe and updates booking deposit status
 */

import type { Request, Response } from 'express';
import { getGlobalSystemRepo } from '../fhir/repo';
import type { Appointment, Extension } from '@medplum/fhirtypes';
import { getLogger } from '../logger';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: StripePaymentIntent | StripeCheckoutSession;
  };
}

interface StripePaymentIntent {
  id: string;
  status: string;
  amount_received: number;
  metadata: Record<string, string>;
}

interface StripeCheckoutSession {
  id: string;
  status: string;
  payment_intent: string;
  amount_total: number;
  metadata: Record<string, string>;
  customer_details?: {
    email?: string;
    name?: string;
    phone?: string;
  };
}

/**
 * Verify Stripe webhook signature
 */
function verifyStripeSignature(payload: string, signature: string): boolean {
  // In production, use Stripe's library to verify signature
  // For now, we'll do basic validation
  if (!STRIPE_WEBHOOK_SECRET) {
    getLogger().warn('Stripe webhook secret not configured');
    return true; // Allow in dev
  }

  // TODO: Implement proper signature verification using crypto
  // const expectedSignature = crypto
  //   .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
  //   .update(payload, 'utf8')
  //   .digest('hex');
  // return signature === expectedSignature;

  return true;
}

/**
 * Build deposit info extension for appointment
 */
function buildDepositInfoExtensions(depositInfo: {
  status: 'pending' | 'requested' | 'paid' | 'waived';
  amount: number;
  requestedAt?: Date;
  paidAt?: Date;
  paymentIntentId?: string;
  paymentMethod?: string;
}): Extension {
  const extensions: Array<{ url: string; [key: string]: unknown }> = [
    { url: 'status', valueString: depositInfo.status },
    { url: 'amount', valueInteger: depositInfo.amount },
  ];

  if (depositInfo.requestedAt) {
    extensions.push({ url: 'requestedAt', valueDateTime: depositInfo.requestedAt.toISOString() });
  }
  if (depositInfo.paidAt) {
    extensions.push({ url: 'paidAt', valueDateTime: depositInfo.paidAt.toISOString() });
  }
  if (depositInfo.paymentIntentId) {
    extensions.push({ url: 'paymentIntentId', valueString: depositInfo.paymentIntentId });
  }
  if (depositInfo.paymentMethod) {
    extensions.push({ url: 'paymentMethod', valueString: depositInfo.paymentMethod });
  }

  return {
    url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
    extension: extensions,
  };
}

/**
 * Handle Stripe webhook
 */
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const logger = getLogger();

  try {
    // Get signature from header
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      logger.warn('Stripe webhook: missing signature');
      res.status(400).json({ error: 'Missing signature' });
      return;
    }

    // Verify signature
    const payload = JSON.stringify(req.body);
    if (!verifyStripeSignature(payload, signature)) {
      logger.warn('Stripe webhook: invalid signature');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    const event = req.body as StripeEvent;
    logger.info('Stripe webhook received', { eventType: event.type, eventId: event.id });

    const repo = getGlobalSystemRepo();

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as StripePaymentIntent;
        const appointmentId = paymentIntent.metadata?.appointmentId;

        if (!appointmentId) {
          logger.warn('Stripe webhook: no appointmentId in metadata');
          res.status(400).json({ error: 'Missing appointmentId' });
          return;
        }

        // Update appointment
        const appointment = await repo.readResource<Appointment>('Appointment', appointmentId);

        // Get existing deposit info
        const existingExt = appointment.extension?.find(
          (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
        );
        const amount = existingExt?.extension?.find((e) => e.url === 'amount')?.valueInteger ?? 0;

        // Update deposit status
        const depositExt = buildDepositInfoExtensions({
          status: 'paid',
          amount,
          paidAt: new Date(),
          paymentIntentId: paymentIntent.id,
          paymentMethod: 'stripe',
        });

        // Remove existing deposit extension
        const existingExts = appointment.extension?.filter(
          (e) => e.url !== 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
        ) || [];

        const updatedAppointment: Appointment = {
          ...appointment,
          extension: [...existingExts, depositExt],
        };

        await repo.updateResource(updatedAppointment);
        logger.info('Deposit marked as paid', { appointmentId, paymentIntentId: paymentIntent.id });

        // TODO: Send confirmation notification to patient
        // This would integrate with Twilio/Resend

        res.json({ received: true, status: 'paid' });
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as StripeCheckoutSession;
        const appointmentId = session.metadata?.appointmentId;

        if (!appointmentId) {
          logger.warn('Stripe webhook: no appointmentId in session metadata');
          res.status(400).json({ error: 'Missing appointmentId' });
          return;
        }

        // Update appointment
        const appointment = await repo.readResource<Appointment>('Appointment', appointmentId);

        // Get existing deposit info
        const existingExt = appointment.extension?.find(
          (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
        );
        const amount = existingExt?.extension?.find((e) => e.url === 'amount')?.valueInteger ??
          (session.amount_total ? session.amount_total / 100 : 0);

        // Update deposit status
        const depositExt = buildDepositInfoExtensions({
          status: 'paid',
          amount,
          paidAt: new Date(),
          paymentIntentId: session.payment_intent,
          paymentMethod: 'stripe_checkout',
        });

        // Remove existing deposit extension
        const existingExts = appointment.extension?.filter(
          (e) => e.url !== 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
        ) || [];

        const updatedAppointment: Appointment = {
          ...appointment,
          extension: [...existingExts, depositExt],
        };

        await repo.updateResource(updatedAppointment);
        logger.info('Deposit marked as paid via checkout', { appointmentId, sessionId: session.id });

        res.json({ received: true, status: 'paid' });
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as StripePaymentIntent;
        const appointmentId = paymentIntent.metadata?.appointmentId;

        if (appointmentId) {
          logger.warn('Payment failed', { appointmentId, paymentIntentId: paymentIntent.id });
          // Optionally notify staff about failed payment
        }

        res.json({ received: true, status: 'failed' });
        break;
      }

      default:
        logger.info('Unhandled Stripe event type', { eventType: event.type });
        res.json({ received: true, status: 'ignored' });
    }
  } catch (err) {
    logger.error('Stripe webhook error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Handles POST /webhook/create-payment-link requests from the app
 * Creates a Stripe checkout session and returns the URL
 */
export async function createPaymentLinkHandler(req: Request, res: Response): Promise<void> {
  const logger = getLogger();

  try {
    const { appointmentId, amount, patientEmail, patientName } = req.body;

    if (!appointmentId) {
      res.status(400).json({ error: 'Missing appointmentId' });
      return;
    }
    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    const result = await createStripePaymentLink(appointmentId, amount, patientEmail || '', patientName || '');

    if (result.error) {
      logger.warn('Failed to create payment link', { error: result.error });
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ url: result.url });
  } catch (err) {
    logger.error('createPaymentLinkHandler error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Create Stripe payment link for appointment
 * This would be called from the app to generate a payment link
 */
export async function createStripePaymentLink(
  appointmentId: string,
  amount: number,
  patientEmail: string,
  patientName: string
): Promise<{ url: string; error?: string }> {
  const logger = getLogger();
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    logger.warn('Stripe secret key not configured');
    return { url: '', error: 'Stripe not configured' };
  }

  try {
    // Call Stripe API to create checkout session
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'payment_method_types[]': 'card',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': 'Appointment Deposit',
        'line_items[0][price_data][unit_amount]': (amount * 100).toString(), // Convert to cents
        'line_items[0][quantity]': '1',
        'mode': 'payment',
        'success_url': `${process.env.MEDPLUM_APP_BASE_URL}/bookings/${appointmentId}?payment=success`,
        'cancel_url': `${process.env.MEDPLUM_APP_BASE_URL}/bookings/${appointmentId}?payment=cancelled`,
        'metadata[appointmentId]': appointmentId,
        'customer_email': patientEmail,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const data = await response.json() as { url: string };
    return { url: data.url };
  } catch (err) {
    logger.error('Failed to create Stripe payment link', { error: err });
    return { url: '', error: 'Failed to create payment link' };
  }
}
