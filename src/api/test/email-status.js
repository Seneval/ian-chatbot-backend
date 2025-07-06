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
  if (process.env.NODE_ENV === 'production' && req.headers['x-test-api-key'] !== process.env.TEST_API_KEY) {
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

// Diagnose email configuration
router.get('/diagnose', async (req, res) => {
  try {
    const diagnosis = {
      configured: emailService.isConfigured,
      env: {
        SMTP_HOST: process.env.SMTP_HOST || 'NOT SET',
        SMTP_PORT: process.env.SMTP_PORT || 'NOT SET',
        SMTP_USER: process.env.SMTP_USER || 'NOT SET',
        SMTP_PASS: process.env.SMTP_PASS ? 'SET (hidden)' : 'NOT SET',
        EMAIL_FROM: process.env.EMAIL_FROM || 'NOT SET',
        FRONTEND_URL: process.env.FRONTEND_URL || 'NOT SET'
      },
      service: {
        fromEmail: emailService.fromEmail,
        frontendUrl: emailService.frontendUrl,
        transporterExists: !!emailService.transporter
      }
    };
    
    // Try to verify transporter connection
    if (emailService.transporter) {
      try {
        await emailService.transporter.verify();
        diagnosis.connectionTest = {
          success: true,
          message: 'SMTP connection successful'
        };
      } catch (verifyError) {
        diagnosis.connectionTest = {
          success: false,
          error: verifyError.message,
          code: verifyError.code,
          response: verifyError.response
        };
      }
    } else {
      diagnosis.connectionTest = {
        success: false,
        error: 'No transporter created'
      };
    }
    
    // Check if FROM email might be the issue
    if (emailService.fromEmail === 'onboarding@resend.dev') {
      diagnosis.warnings = diagnosis.warnings || [];
      diagnosis.warnings.push('Using default Resend test email. Consider using your own domain email.');
    }
    
    res.json(diagnosis);
  } catch (error) {
    res.status(500).json({ 
      error: 'Diagnosis failed',
      message: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;