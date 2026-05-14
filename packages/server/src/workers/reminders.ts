import { Queue, Worker, QueueBaseOptions } from 'bullmq';
import type { MedplumServerConfig } from '../config/types';
import { globalLogger } from '../logger';
import { checkAndSendReminders } from '../cron/reminders';
import type { WorkerInitializer, WorkerInitializerOptions } from './utils';
import { getBullmqRedisConnectionOptions, getWorkerBullmqConfig, queueRegistry } from './utils';

const queueName = 'ReminderQueue';

export interface ReminderJobData {
  readonly type: 'hourly-check';
}

const JOB_SCHEDULER_KEY = 'reminder-hourly';

export const initReminderWorker: WorkerInitializer = (config, options?: WorkerInitializerOptions) => {
  const defaultOptions: QueueBaseOptions = {
    connection: getBullmqRedisConnectionOptions(config),
  };

  const queue = new Queue<ReminderJobData>(queueName, {
    ...defaultOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  });

  // Schedule a repeatable job every 60 minutes
  queue.upsertJobScheduler(
    JOB_SCHEDULER_KEY,
    { pattern: '0 * * * *' }, // Every hour at minute 0
    { data: { type: 'hourly-check' } }
  ).catch((err) => {
    globalLogger.error('Failed to upsert reminder job scheduler', { error: err });
  });

  let worker: Worker<ReminderJobData> | undefined;
  if (options?.workerEnabled !== false) {
    const workerBullmq = getWorkerBullmqConfig(config, 'reminder');
    worker = new Worker<ReminderJobData>(queueName, execReminder, {
      ...defaultOptions,
      ...workerBullmq,
    });
    worker.on('completed', (job) => globalLogger.info(`Reminder job ${job.id} completed`));
    worker.on('failed', (job, err) => globalLogger.error(`Reminder job ${job?.id} failed`, { error: err }));
  }

  return { queue, worker, name: queueName };
};

async function execReminder(job: { data: ReminderJobData }): Promise<void> {
  globalLogger.info('Executing reminder check', { type: job.data.type });
  await checkAndSendReminders();
}

export function getReminderQueue(): Queue<ReminderJobData> | undefined {
  return queueRegistry.get(queueName);
}
