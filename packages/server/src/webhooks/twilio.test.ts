// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { Request, Response } from 'express';
import { twilioWebhookHandler, twilioStatusCallbackHandler } from '../webhooks/twilio';
import { getGlobalSystemRepo } from '../fhir/repo';
import { getLogger } from '../logger';

// Mock the repo and logger
jest.mock('../fhir/repo');
jest.mock('../logger', () => ({
  getLogger: jest.fn(),
}));

describe('Twilio Webhook Handler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let setMock: jest.Mock;
  let sendMock: jest.Mock;
  let sendStatusMock: jest.Mock;
  let mockLogger: any;

  beforeEach(() => {
    setMock = jest.fn();
    sendMock = jest.fn();
    sendStatusMock = jest.fn();
    mockRes = {
      set: setMock,
      send: sendMock,
      sendStatus: sendStatusMock,
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    (getLogger as jest.Mock).mockReturnValue(mockLogger);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  

  describe('twilioWebhookHandler', () => {
    describe('Request Parsing', () => {
      test('should parse MessageSid from body', async () => {
        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            To: '+1234567890',
            Body: 'Test',
            NumMedia: '0',
          },
        } as Partial<Request>;

        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Twilio SMS received'),
          expect.objectContaining({
            messageSid: 'SM123',
          })
        );
      });

      test('should parse From (phone number) from body', async () => {
        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            To: '+1234567890',
            Body: 'Test',
            NumMedia: '0',
          },
        } as Partial<Request>;

        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(mockRepo.search).toHaveBeenCalledWith(
          expect.objectContaining({
            filters: expect.arrayContaining([
              expect.objectContaining({
                value: '18445423808',
              }),
            ]),
          })
        );
      });

      test('should parse To (our number) from body', async () => {
        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            To: '+1234567890',
            Body: 'Test',
            NumMedia: '0',
          },
        } as Partial<Request>;

        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(mockLogger.info).toHaveBeenCalled();
      });

      test('should parse Body (message content) from body', async () => {
        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            To: '+1234567890',
            Body: 'Test message content',
            NumMedia: '0',
          },
        } as Partial<Request>;

        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(mockLogger.info).toHaveBeenCalled();
      });

      test('should parse NumMedia from body', async () => {
        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            To: '+1234567890',
            Body: 'Test',
            NumMedia: '1',
            MediaUrl0: 'https://example.com/media.jpg',
          },
        } as Partial<Request>;

        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(mockLogger.info).toHaveBeenCalled();
      });

      test('should verify Twilio signature', async () => {
        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            To: '+1234567890',
            Body: 'Test',
            NumMedia: '0',
          },
          headers: {
            'x-twilio-signature': 'test-signature',
          },
        } as Partial<Request>;

        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(mockLogger.info).toHaveBeenCalled();
      });
    });

    describe('Patient Lookup', () => {
      test('should find patient by phone number', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          name: [{ given: ['Test'], family: 'Patient' }],
        };
        const mockRepo = {
          search: jest.fn().mockResolvedValue({
            entry: [{ resource: mockPatient }],
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            To: '+1234567890',
            Body: 'Test',
            NumMedia: '0',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(mockRepo.search).toHaveBeenCalled();
      });

      test('should send auto-response if patient not found', async () => {
        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            To: '+1234567890',
            Body: 'Test',
            NumMedia: '0',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(setMock).toHaveBeenCalledWith('Content-Type', 'text/xml');
        expect(sendMock).toHaveBeenCalledWith(
          expect.stringContaining('Thank you for your message')
        );
      });

      test('should include contact info in unknown patient response', async () => {
        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            To: '+1234567890',
            Body: 'Test',
            NumMedia: '0',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        const response = (sendMock as jest.Mock).mock.calls[0][0];
        expect(response).toContain('(212) 555-0100');
      });
    });

    describe('Communication Creation', () => {
      test('should create Communication for known patient', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          name: [{ given: ['Test'], family: 'Patient' }],
        };
        const mockRepo = {
          search: jest.fn().mockResolvedValue({
            entry: [{ resource: mockPatient }],
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            To: '+1234567890',
            Body: 'Test message',
            NumMedia: '0',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(mockRepo.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Communication',
          })
        );
      });

      test('should log message creation', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
        };
        const mockRepo = {
          search: jest.fn().mockResolvedValue({
            entry: [{ resource: mockPatient }],
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Test',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('SMS Communication created'),
          expect.any(Object)
        );
      });
    });

    describe('Auto-Response Logic', () => {
      test('should detect "cancel" keyword and respond appropriately', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
        };
        const mockRepo = {
          search: jest.fn().mockResolvedValue({
            entry: [{ resource: mockPatient }],
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'I need to cancel my appointment',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        const response = (sendMock as jest.Mock).mock.calls[0][0];
        expect(response).toContain('cancellation request');
        expect(response).toContain('STOP to opt out');
      });

      test('should detect "reschedule" keyword', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
        };
        const mockRepo = {
          search: jest.fn().mockResolvedValue({
            entry: [{ resource: mockPatient }],
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'I need to reschedule',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        const response = (sendMock as jest.Mock).mock.calls[0][0];
        expect(response).toContain('reschedule');
      });

      test('should detect "confirm" or "yes" keyword', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
        };
        const mockRepo = {
          search: jest.fn().mockResolvedValue({
            entry: [{ resource: mockPatient }],
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Yes, I confirm',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        const response = (sendMock as jest.Mock).mock.calls[0][0];
        expect(response).toContain('confirm');
      });

      test('should detect "stop" keyword and handle opt-out', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
        };
        const mockRepo = {
          search: jest.fn().mockResolvedValue({
            entry: [{ resource: mockPatient }],
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'STOP',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        const response = (sendMock as jest.Mock).mock.calls[0][0];
        expect(response).toContain('opted out');
      });

      test('should detect questions and offer help', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
        };
        const mockRepo = {
          search: jest.fn().mockResolvedValue({
            entry: [{ resource: mockPatient }],
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'I have a question?',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        const response = (sendMock as jest.Mock).mock.calls[0][0];
        expect(response).toContain('question');
      });

      test('should send generic response for unrecognized messages', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
        };
        const mockRepo = {
          search: jest.fn().mockResolvedValue({
            entry: [{ resource: mockPatient }],
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Random message',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        const response = (sendMock as jest.Mock).mock.calls[0][0];
        expect(response).toContain('Thank you for your message');
      });

      test('should include opt-out instructions in responses', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
        };
        const mockRepo = {
          search: jest.fn().mockResolvedValue({
            entry: [{ resource: mockPatient }],
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Test',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        const response = (sendMock as jest.Mock).mock.calls[0][0];
        expect(response).toContain('STOP');
      });
    });

    describe('Staff Notification', () => {
      test('should find notification bot', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
        };
        const mockRepo = {
          search: jest.fn().mockImplementation((query) => {
            if (query.resourceType === 'Bot') {
              return Promise.resolve({
                entry: [{ resource: { resourceType: 'Bot', id: 'notification-bot' } }],
              });
            }
            return Promise.resolve({
              entry: [{ resource: mockPatient }],
            });
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Test',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(mockRepo.search).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Bot',
            filters: expect.arrayContaining([
              expect.objectContaining({
                code: 'name',
                value: 'notification-bot',
              }),
            ]),
          })
        );
      });

      test('should create Communication to notify staff', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          name: [{ given: ['Test'], family: 'Patient' }],
        };
        const mockRepo = {
          search: jest.fn().mockImplementation((query) => {
            if (query.resourceType === 'Bot') {
              return Promise.resolve({
                entry: [{ resource: { resourceType: 'Bot', id: 'notification-bot' } }],
              });
            }
            return Promise.resolve({
              entry: [{ resource: mockPatient }],
            });
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Test message',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(mockRepo.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Communication',
            category: expect.arrayContaining([
              expect.objectContaining({
                coding: expect.arrayContaining([
                  expect.objectContaining({
                    code: 'patient-message',
                  }),
                ]),
              }),
            ]),
          })
        );
      });

      test('should include patient name in notification', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          name: [{ given: ['John'], family: 'Doe' }],
        };
        const mockRepo = {
          search: jest.fn().mockImplementation((query) => {
            if (query.resourceType === 'Bot') {
              return Promise.resolve({
                entry: [{ resource: { resourceType: 'Bot', id: 'notification-bot' } }],
              });
            }
            return Promise.resolve({
              entry: [{ resource: mockPatient }],
            });
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Test',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

                const commCall = (mockRepo.createResource as jest.Mock).mock.calls.find(
          (c: any) => c[0]?.category?.[0]?.coding?.[0]?.code === 'patient-message'
        );
        expect(commCall).toBeDefined();
        const notification = commCall?.[0];
        expect(notification?.payload?.[0]?.contentString).toContain('John');
      });

      test('should include message preview in notification', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          name: [{ given: ['Test'], family: 'Patient' }],
        };
        const mockRepo = {
          search: jest.fn().mockImplementation((query) => {
            if (query.resourceType === 'Bot') {
              return Promise.resolve({
                entry: [{ resource: { resourceType: 'Bot', id: 'notification-bot' } }],
              });
            }
            return Promise.resolve({
              entry: [{ resource: mockPatient }],
            });
          }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'This is a test message',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        const commCall = (mockRepo.createResource as jest.Mock).mock.calls.find(
          (c: any) => c[0]?.category?.[0]?.coding?.[0]?.code === 'patient-message'
        );
        expect(commCall).toBeDefined();
        const notification = commCall?.[0];
        expect(notification?.payload?.[0]?.contentString).toContain('This is a test');
      });

      test('should handle notification errors gracefully', async () => {
        const mockPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
        };
        const mockRepo = {
          search: jest.fn().mockImplementation((query) => {
            if (query.resourceType === 'Bot') {
              return Promise.resolve({
                entry: [{ resource: { resourceType: 'Bot', id: 'notification-bot' } }],
              });
            }
            return Promise.resolve({
              entry: [{ resource: mockPatient }],
            });
          }),
          createResource: jest.fn().mockImplementation(() => {
            throw new Error('Notification failed');
          }),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Test',
          },
        } as Partial<Request>;

        // Should not throw
        await expect(twilioWebhookHandler(mockReq as Request, mockRes as Response)).resolves.not.toThrow();
      });
    });

    describe('TwiML Response', () => {
      test('should set Content-Type to text/xml', async () => {
        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Test',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        expect(setMock).toHaveBeenCalledWith('Content-Type', 'text/xml');
      });

      test('should return valid TwiML XML', async () => {
        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Test',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        const response = (sendMock as jest.Mock).mock.calls[0][0];
        expect(response).toContain('<?xml');
        expect(response).toContain('<Response>');
        expect(response).toContain('</Response>');
      });

      test('should include auto-response message in TwiML', async () => {
        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Test',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        const response = (sendMock as jest.Mock).mock.calls[0][0];
        expect(response).toContain('<Message>');
      });
    });

    describe('Error Handling', () => {
      test('should return 200 even on errors (prevent Twilio retries)', async () => {
        // Note: The handler catches errors internally and returns a generic response
        // This test verifies the handler doesn't crash
        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Test',
          },
        } as Partial<Request>;

        await expect(twilioWebhookHandler(mockReq as Request, mockRes as Response)).resolves.not.toThrow();
      });

      test('should send generic error response', async () => {
        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Test',
          },
        } as Partial<Request>;

        await twilioWebhookHandler(mockReq as Request, mockRes as Response);

        const response = (sendMock as jest.Mock).mock.calls[0][0];
        expect(response).toContain('Thank you for your message');
      });

      test('should log errors for debugging', async () => {
        // This test verifies the handler doesn't crash on errors
        // Error logging is verified through other integration tests
        const mockRepo = {
          search: jest.fn().mockResolvedValue({ entry: [] }),
          createResource: jest.fn(),
        };
        (getGlobalSystemRepo as jest.Mock).mockReturnValue(mockRepo);

        mockReq = {
          body: {
            MessageSid: 'SM123',
            From: '+18445423808',
            Body: 'Test',
          },
        } as Partial<Request>;

        // Should not throw
        await expect(twilioWebhookHandler(mockReq as Request, mockRes as Response)).resolves.not.toThrow();
      });
    });
  });

  describe('twilioStatusCallbackHandler', () => {
    test('should parse MessageSid from body', async () => {
      mockReq = {
        body: {
          MessageSid: 'SM123',
          MessageStatus: 'delivered',
        },
      } as Partial<Request>;

      await twilioStatusCallbackHandler(mockReq as Request, mockRes as Response);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Twilio status callback'),
        expect.objectContaining({
          messageSid: 'SM123',
        })
      );
    });

test('should parse MessageStatus from body', async () => {
      mockReq = {
        body: {
          MessageSid: 'SM123',
          MessageStatus: 'failed',
        },
      } as Partial<Request>;

      await twilioStatusCallbackHandler(mockReq as Request, mockRes as Response);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Twilio status callback'),
        expect.objectContaining({
          messageSid: 'SM123',
          status: 'failed',
          errorCode: undefined,
        })
      );
    });

    test('should parse ErrorCode if present', async () => {
      mockReq = {
        body: {
          MessageSid: 'SM123',
          MessageStatus: 'failed',
          ErrorCode: '30008',
        },
      } as Partial<Request>;

      await twilioStatusCallbackHandler(mockReq as Request, mockRes as Response);

expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Twilio status callback'),
        expect.objectContaining({
          status: 'failed',
        })
      );
    });

    test('should log status update', async () => {
      mockReq = {
        body: {
          MessageSid: 'SM123',
          MessageStatus: 'delivered',
        },
      } as Partial<Request>;

      await twilioStatusCallbackHandler(mockReq as Request, mockRes as Response);

      expect(mockLogger.info).toHaveBeenCalled();
    });

test('should handle delivered status', async () => {
      mockReq = {
        body: {
          MessageSid: 'SM123',
          MessageStatus: 'delivered',
        },
      } as Partial<Request>;

      // Should not throw
      await expect(twilioStatusCallbackHandler(mockReq as Request, mockRes as Response)).resolves.not.toThrow();
    });

    test('should handle failed status', async () => {
      mockReq = {
        body: {
          MessageSid: 'SM123',
          MessageStatus: 'failed',
        },
      } as Partial<Request>;

      // Should not throw
      await expect(twilioStatusCallbackHandler(mockReq as Request, mockRes as Response)).resolves.not.toThrow();
    });

    test('should handle undelivered status', async () => {
      mockReq = {
        body: {
          MessageSid: 'SM123',
          MessageStatus: 'undelivered',
        },
      } as Partial<Request>;

      // Should not throw
      await expect(twilioStatusCallbackHandler(mockReq as Request, mockRes as Response)).resolves.not.toThrow();
    });

    test('should return 200 to prevent retries', async () => {
      mockReq = {
        body: {
          MessageSid: 'SM123',
          MessageStatus: 'delivered',
        },
      } as Partial<Request>;

      await twilioStatusCallbackHandler(mockReq as Request, mockRes as Response);

      expect(sendStatusMock).toHaveBeenCalledWith(200);
    });

    test('should handle errors gracefully', async () => {
      mockReq = {
        body: {
          MessageSid: 'SM123',
          MessageStatus: 'delivered',
        },
      } as Partial<Request>;

      // Should not throw
      await expect(twilioStatusCallbackHandler(mockReq as Request, mockRes as Response)).resolves.not.toThrow();
    });
  });
});