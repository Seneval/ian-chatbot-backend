const express = require('express');
const router = express.Router();
const Sentry = require('@sentry/node');

// Test endpoint to trigger a Sentry error
router.get('/error', (req, res) => {
  throw new Error('Test Sentry: Este es un error de prueba para verificar que Sentry está funcionando correctamente!');
});

// Test endpoint for async error
router.get('/async-error', async (req, res, next) => {
  try {
    await Promise.reject(new Error('Test Sentry: Error asíncrono de prueba'));
  } catch (error) {
    next(error);
  }
});

// Test endpoint for custom error with context
router.get('/custom-error', (req, res) => {
  Sentry.captureException(new Error('Test Sentry: Error personalizado con contexto'), {
    tags: {
      section: 'test',
      type: 'custom'
    },
    level: 'error',
    user: {
      id: 'test-user-123',
      email: 'test@ian.com'
    },
    extra: {
      endpoint: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    }
  });
  
  res.json({ 
    message: 'Error personalizado enviado a Sentry',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint for warning message
router.get('/warning', (req, res) => {
  Sentry.captureMessage('Test Sentry: Mensaje de advertencia desde iAN Backend', 'warning');
  res.json({ 
    message: 'Advertencia enviada a Sentry',
    level: 'warning'
  });
});

// Test endpoint for breadcrumbs
router.get('/breadcrumb', (req, res) => {
  // Add breadcrumb
  Sentry.addBreadcrumb({
    category: 'test',
    message: 'Usuario accedió al endpoint de prueba',
    level: 'info',
    data: {
      endpoint: req.path,
      timestamp: new Date().toISOString()
    }
  });
  
  // Trigger error after breadcrumb
  throw new Error('Test Sentry: Error con breadcrumbs para contexto');
});

// Test endpoint to verify Sentry is configured
router.get('/status', (req, res) => {
  const client = Sentry.getClient();
  const isEnabled = !!client;
  
  res.json({
    sentryEnabled: isEnabled,
    dsn: process.env.SENTRY_DSN ? 'Configurado' : 'No configurado',
    environment: process.env.NODE_ENV || 'development',
    message: isEnabled ? 'Sentry está activo y capturando errores' : 'Sentry no está configurado'
  });
});

module.exports = router;