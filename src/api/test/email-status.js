const express = require('express');
const emailService = require('../../services/email');
const router = express.Router();

// Check email service status
router.get('/status', async (req, res) => {
  const status = {
    configured: emailService.isConfigured,
    env: {
      SMTP_HOST: !!process.env.SMTP_HOST,
      SMTP_PORT: !!process.env.SMTP_PORT,
      SMTP_USER: !!process.env.SMTP_USER,
      SMTP_PASS: !!process.env.SMTP_PASS,
      EMAIL_FROM: process.env.EMAIL_FROM || 'not set',
      FRONTEND_URL: process.env.FRONTEND_URL || 'not set'
    },
    fromEmail: emailService.fromEmail,
    frontendUrl: emailService.frontendUrl
  };
  
  res.json(status);
});

// Test sending email (protected)
router.post('/test-send', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  
  try {
    const testToken = 'test-token-123';
    const result = await emailService.sendVerificationEmail(email, 'Test User', testToken);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;