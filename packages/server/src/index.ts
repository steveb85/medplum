// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import express from 'express';
import gracefulShutdown from 'http-graceful-shutdown';
import dotenv from 'dotenv';
import { initApp, shutdownApp } from './app';
import { loadConfig } from './config/loader';
import { globalLogger } from './logger';
import { getServerVersion } from './util/version';

// Load environment variables from .env file
dotenv.config();
export async function main(configName: string): Promise<void> {
  process.on('unhandledRejection', (err: any) => {
    globalLogger.error('Unhandled promise rejection', err);
  });

  process.on('uncaughtException', (err) => {
    globalLogger.error('Uncaught exception thrown', err);

    if (err.message && typeof err.message === 'string' && err.message.includes('Connection terminated unexpectedly')) {
      // The pg-pool library throws this error when the database connection is lost.
      // This can happen when the database server is restarted.
      // We do *not* want to exit the process in this case.
      return;
    }

    if (err.message && typeof err.message === 'string' && err.message.includes('Unexpected end of input')) {
      // Workaround for OpenTelemetry bug: https://github.com/open-telemetry/opentelemetry-js/issues/5095
      // The otel library can throw this error on malformed X-Forwarded-For headers.
      // We do *not* want to exit the process in this case.
      return;
    }

    process.exit(1);
  });

  globalLogger.info('Starting Medplum Server...', { configName, version: getServerVersion() });

  const config = await loadConfig(configName);
  globalLogger.info('Config loaded', {
    vmContextBotsEnabled: config.vmContextBotsEnabled,
    vmContextBotsEnabledType: typeof config.vmContextBotsEnabled,
  });

  // Copy VAPID keys from config to process.env for Bot access
  // This allows the push notification bot to access VAPID keys via process.env
  if (config.VAPID_PUBLIC_KEY) {
    process.env.VAPID_PUBLIC_KEY = config.VAPID_PUBLIC_KEY;
    globalLogger.info('VAPID_PUBLIC_KEY loaded from config');
  }
  if (config.VAPID_PRIVATE_KEY) {
    process.env.VAPID_PRIVATE_KEY = config.VAPID_PRIVATE_KEY;
    globalLogger.info('VAPID_PRIVATE_KEY loaded from config');
  }

  const app = await initApp(express(), config);
  const server = app.listen(config.port);
  server.keepAliveTimeout = config.keepAliveTimeout ?? 90000;
  globalLogger.info('Server started', { port: config.port });
  gracefulShutdown(server, {
    timeout: config.shutdownTimeoutMilliseconds,
    development: process.env.NODE_ENV !== 'production',
    preShutdown: async (signal) => {
      globalLogger.info(
        `Shutdown signal received... allowing graceful shutdown for up to ${config.shutdownTimeoutMilliseconds} milliseconds`,
        { signal }
      );
    },
    onShutdown: () => shutdownApp(),
    finally: () => {
      globalLogger.info('Shutdown complete');
    },
  });
}

if (import.meta.main) {
  main(process.argv.length === 3 ? process.argv[2] : 'file:medplum.config.json').catch((err) => {
    console.log(err);
    process.exit(1);
  });
}
