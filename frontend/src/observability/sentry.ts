import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initFrontendObservability() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_APP_ENV as string | undefined) ?? import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
    sendDefaultPii: false,
  });
}

export function captureFrontendError(error: unknown, context?: Record<string, unknown>) {
  if (!dsn) return;
  Sentry.captureException(error, { extra: context });
}
