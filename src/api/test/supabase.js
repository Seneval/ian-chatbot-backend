const express = require('express');
const { supabase, isSupabaseAvailable, validateSupabaseConnection } = require('../../config/supabase');
const Sentry = require('../../instrument');

const router = express.Router();

// Test Supabase connection
router.get('/connection', async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        connected: false,
        error: 'Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
      });
    }

    const result = await validateSupabaseConnection();
    
    res.json({
      connected: result.connected,
      timestamp: new Date(),
      config: {
        url: process.env.SUPABASE_URL ? 'configured' : 'missing',
        anonKey: process.env.SUPABASE_ANON_KEY ? 'configured' : 'missing'
      },
      ...result
    });
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        endpoint: '/api/test/supabase/connection',
        supabaseConfigured: isSupabaseAvailable()
      }
    });
    
    res.status(500).json({
      connected: false,
      error: err.message,
      timestamp: new Date()
    });
  }
});

// Test user signup (creates a test user)
router.post('/test-signup', async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Supabase not configured'
      });
    }

    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'Test123!@#';

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });

    if (signUpError) {
      Sentry.captureException(signUpError, {
        extra: {
          endpoint: '/api/test/supabase/test-signup',
          testEmail
        }
      });
      
      return res.status(400).json({
        success: false,
        error: signUpError.message,
        testEmail
      });
    }

    res.json({
      success: true,
      user: signUpData.user,
      session: signUpData.session,
      testEmail,
      testPassword,
      message: 'Test user created successfully'
    });
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        endpoint: '/api/test/supabase/test-signup'
      }
    });
    
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Test user signin
router.post('/test-signin', async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Supabase not configured'
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      Sentry.captureException(signInError, {
        extra: {
          endpoint: '/api/test/supabase/test-signin',
          email
        }
      });
      
      return res.status(400).json({
        success: false,
        error: signInError.message
      });
    }

    res.json({
      success: true,
      user: signInData.user,
      session: signInData.session,
      message: 'Test signin successful'
    });
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        endpoint: '/api/test/supabase/test-signin'
      }
    });
    
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Test token validation
router.post('/validate-token', async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        valid: false,
        error: 'Supabase not configured'
      });
    }

    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;

    if (!token) {
      return res.status(400).json({
        valid: false,
        error: 'No token provided'
      });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError) {
      return res.status(401).json({
        valid: false,
        error: userError.message,
        token: token.substring(0, 20) + '...'
      });
    }

    res.json({
      valid: true,
      user: userData.user,
      token: token.substring(0, 20) + '...',
      message: 'Token is valid'
    });
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        endpoint: '/api/test/supabase/validate-token',
        hasToken: !!req.headers.authorization
      }
    });
    
    res.status(500).json({
      valid: false,
      error: err.message
    });
  }
});

// Get Supabase status and configuration
router.get('/status', (req, res) => {
  res.json({
    configured: isSupabaseAvailable(),
    environment: {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'missing',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'set' : 'missing'
    },
    timestamp: new Date(),
    endpoints: [
      'GET /api/test/supabase/connection - Test connection',
      'POST /api/test/supabase/test-signup - Create test user',
      'POST /api/test/supabase/test-signin - Sign in user',
      'POST /api/test/supabase/validate-token - Validate JWT token',
      'GET /api/test/supabase/status - This endpoint'
    ]
  });
});

module.exports = router;