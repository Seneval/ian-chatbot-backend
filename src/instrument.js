const Sentry = require("@sentry/node");

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in production, 100% in development
    // Set sample rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
    // Integrations
    integrations: [
      // Capture console.error() calls
      Sentry.captureConsoleIntegration({ levels: ['error'] }),
      // Express integration is automatic
    ],
    // Release tracking
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'local-dev',
    // Environment tracking
    beforeSend(event, hint) {
      // Filter out non-error level events in production
      if (process.env.NODE_ENV === 'production' && event.level !== 'error') {
        return null;
      }
      return event;
    },
  });
  
  console.log('✅ Sentry initialized successfully');
} else {
  console.log('⚠️  Sentry DSN not found, error tracking disabled');
}

module.exports = Sentry;