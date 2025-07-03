const express = require('express');
const jwt = require('jsonwebtoken');
const { supabase, isSupabaseAvailable } = require('../config/supabase');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Sentry = require('../instrument');

const router = express.Router();

// Register new tenant with owner user
router.post('/register', async (req, res) => {
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

    let supabaseUserId = null;
    let authMethod = 'legacy';
    let sessionToken = null;

    // Try Supabase registration first (with timeout protection)
    if (isSupabaseAvailable()) {
      try {
        console.log('🔄 Attempting Supabase user creation...');
        
        // Set a timeout for Supabase calls
        const supabasePromise = supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: undefined,
            data: {
              company_name: companyName,
              contact_name: contactName
            }
          }
        });

        // Race against timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Supabase timeout')), 8000);
        });

        const { data: signUpData, error: signUpError } = await Promise.race([
          supabasePromise,
          timeoutPromise
        ]);

        if (signUpError) {
          console.log(`⚠️ Supabase signup failed: ${signUpError.message}`);
          // Continue with legacy mode
        } else if (signUpData.user) {
          supabaseUserId = signUpData.user.id;
          authMethod = 'supabase';
          sessionToken = signUpData.session?.access_token;
          console.log(`✅ Supabase user created: ${supabaseUserId}`);
        }
      } catch (supabaseError) {
        console.log(`⚠️ Supabase registration failed: ${supabaseError.message}`);
        // Continue with legacy mode
      }
    }

    // Create tenant
    console.log('🏢 Creating tenant...');
    const tenant = new Tenant({
      name: companyName,
      slug: tenantSlug,
      email: email,
      supabaseUserId: supabaseUserId
    });

    await tenant.save();
    console.log(`✅ Tenant created: ${tenant.tenantId}`);

    // Create owner user
    console.log('👤 Creating owner user...');
    const ownerUser = new User({
      tenantId: tenant.tenantId,
      email: email,
      name: contactName,
      role: 'owner',
      supabaseUserId: supabaseUserId
    });

    await ownerUser.save();
    console.log(`✅ Owner user created: ${ownerUser.userId}`);

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
        role: ownerUser.role
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
            'Your account is ready to use',
            `Dashboard URL: ${req.protocol}://${req.get('host')}/admin`,
            'Use the provided token for API access'
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

module.exports = router;