const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { supabase, isSupabaseAvailable } = require('../config/supabase');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Sentry = require('../instrument');
const emailService = require('../services/email');

const router = express.Router();

// Add URL-encoded form support
router.use(express.urlencoded({ extended: true }));

// Register new tenant with owner user (accepts both JSON and form data)
router.post('/', async (req, res) => {
  try {
    const { 
      companyName, 
      email, 
      password, 
      contactName,
      slug 
    } = req.body;

    // Validate required fields
    if (!companyName || !email || !password || !contactName) {
      return res.status(400).json({
        success: false,
        error: 'Company name, email, password, and contact name are required'
      });
    }

    // Generate slug if not provided
    const tenantSlug = slug || companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    // Check if slug already exists
    const existingTenant = await Tenant.findOne({ slug: tenantSlug });
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        error: 'Company name already taken. Please choose a different name.'
      });
    }

    // Use legacy mode only for now (Supabase causing timeouts in serverless)
    let supabaseUserId = null;
    let authMethod = 'legacy';
    let sessionToken = null;
    
    console.log('🔄 Using legacy authentication mode (Supabase disabled for stability)');

    // Create tenant
    console.log('🏢 Creating tenant...');
    const tenantData = {
      name: companyName,
      slug: tenantSlug,
      email: email
    };
    
    // Only set supabaseUserId if it's not null (for legacy registrations)
    if (supabaseUserId) {
      tenantData.supabaseUserId = supabaseUserId;
    }
    
    const tenant = new Tenant(tenantData);

    await tenant.save();
    console.log(`✅ Tenant created: ${tenant.tenantId}`);

    // Create owner user
    console.log('👤 Creating owner user...');
    
    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const userData = {
      tenantId: tenant.tenantId,
      email: email,
      password: password, // Required field
      name: contactName,
      role: 'owner',
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires
    };
    
    // Only set supabaseUserId if it's not null
    if (supabaseUserId) {
      userData.supabaseUserId = supabaseUserId;
    }
    
    const ownerUser = new User(userData);

    await ownerUser.save();
    console.log(`✅ Owner user created: ${ownerUser.userId}`);
    
    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, contactName, verificationToken);
      console.log('📧 Verification email sent to:', email);
    } catch (emailError) {
      console.error('❌ Failed to send verification email:', emailError);
      // Continue registration even if email fails
    }

    // Generate legacy JWT token for immediate access
    const legacyToken = jwt.sign(
      {
        tenantId: tenant.tenantId,
        userId: ownerUser.userId,
        role: 'owner',
        email: email,
        authMethod: 'legacy'
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    // Prepare response
    const response = {
      success: true,
      message: `Welcome to iAN! Your ${authMethod === 'supabase' ? 'modern' : 'legacy'} account has been created.`,
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email
      },
      user: {
        userId: ownerUser.userId,
        name: ownerUser.name,
        email: ownerUser.email,
        role: ownerUser.role,
        emailVerified: ownerUser.emailVerified
      },
      authentication: {
        method: authMethod,
        legacyToken: legacyToken,
        supabaseToken: sessionToken,
        needsEmailConfirmation: authMethod === 'supabase' && !sessionToken
      },
      nextSteps: authMethod === 'supabase' && sessionToken
        ? [
            'You can now access your dashboard',
            `Dashboard URL: ${req.protocol}://${req.get('host')}/admin`,
            'Use either token for API access'
          ]
        : authMethod === 'supabase' && !sessionToken
        ? [
            'Please check your email to confirm your account',
            'Use the legacy token for immediate access',
            `Dashboard URL: ${req.protocol}://${req.get('host')}/admin`
          ]
        : [
            'Your account has been created',
            'Please check your email to verify your account',
            `Dashboard URL: ${req.protocol}://${req.get('host')}/admin`,
            'You can login immediately, but some features may be limited until email verification'
          ]
    };

    // Log successful registration
    Sentry.addBreadcrumb({
      message: 'Tenant registration successful',
      data: {
        tenantId: tenant.tenantId,
        authMethod: authMethod,
        hasSupabaseUser: !!supabaseUserId
      }
    });

    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Tenant registration failed:', error);
    
    Sentry.captureException(error, {
      extra: {
        endpoint: '/api/tenant/register',
        requestBody: {
          companyName: req.body.companyName,
          email: req.body.email,
          contactName: req.body.contactName,
          slug: req.body.slug
        }
      }
    });

    // Handle specific MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      if (field === 'email') {
        return res.status(400).json({
          success: false,
          error: 'Este email ya está registrado. Por favor usa otro email o inicia sesión.'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Check if company name/slug is available
router.get('/check-availability/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Normalize slug
    const normalizedSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    const existingTenant = await Tenant.findOne({ slug: normalizedSlug });

    res.json({
      available: !existingTenant,
      slug: normalizedSlug,
      suggestions: existingTenant ? [
        `${normalizedSlug}-inc`,
        `${normalizedSlug}-corp`,
        `${normalizedSlug}-${Math.floor(Math.random() * 1000)}`
      ] : []
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        endpoint: '/api/tenant/check-availability',
        slug: req.params.slug
      }
    });

    res.status(500).json({
      available: false,
      error: 'Unable to check availability'
    });
  }
});

// Simple form-data test endpoint
router.post('/test-form', async (req, res) => {
  try {
    console.log('📝 Form data received:', req.body);
    console.log('📝 Content-Type:', req.headers['content-type']);
    
    const { companyName, email, password, contactName } = req.body;
    
    res.json({
      success: true,
      message: 'Form data received successfully',
      receivedData: {
        companyName: companyName || 'missing',
        email: email || 'missing', 
        passwordLength: password ? password.length : 0,
        contactName: contactName || 'missing'
      },
      contentType: req.headers['content-type'],
      method: req.method
    });
  } catch (error) {
    console.error('Form test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;