const express = require('express');
const router = express.Router();

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

// Test endpoint for uncaught promise rejection
router.get('/promise-error', (req, res) => {
  Promise.reject(new Error('Test Sentry: Promise rejection de prueba'));
  res.json({ message: 'Error enviado a Sentry' });
});

module.exports = router;