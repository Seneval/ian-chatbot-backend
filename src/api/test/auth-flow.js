const express = require('express');
const { supabase, isSupabaseAvailable } = require('../../config/supabase');
const Tenant = require('../../models/Tenant');
const { validateTenant } = require('../../middleware/tenant');
const Sentry = require('../../instrument');

const router = express.Router();

// Complete auth flow test: Supabase signup → Create tenant → Test authentication
router.post('/complete-flow', async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Supabase not configured'
      });
    }

    const timestamp = Date.now();
    const testEmail = `test-${timestamp}@example.com`;
    const testPassword = 'Test123!@#';
    const companyName = `Test Company ${timestamp}`;
    const slug = `test-company-${timestamp}`;

    console.log('🧪 Starting complete auth flow test...');

    // Step 1: Sign up user in Supabase
    console.log('1. Creating Supabase user...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        emailRedirectTo: undefined
      }
    });

    if (signUpError) {
      throw new Error(`Supabase signup failed: ${signUpError.message}`);
    }

    if (!signUpData.user) {
      throw new Error('No user returned from Supabase signup');
    }

    console.log(`✅ Supabase user created: ${signUpData.user.id}`);

    // Step 2: Create tenant linked to Supabase user
    console.log('2. Creating tenant...');
    const tenant = new Tenant({
      supabaseUserId: signUpData.user.id,
      name: companyName,
      slug: slug,
      email: testEmail
    });

    await tenant.save();
    console.log(`✅ Tenant created: ${tenant.tenantId}`);

    // Step 3: Sign in to get session token (if user was confirmed)
    let sessionToken = null;
    if (signUpData.session) {
      sessionToken = signUpData.session.access_token;
      console.log('✅ User auto-confirmed, got session token');
    } else {
      console.log('⚠️ User needs email confirmation, no session token');
      
      // Try to sign in anyway (might work if confirmations are disabled)
      try {
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword
        });
        
        if (signInData.session) {
          sessionToken = signInData.session.access_token;
          console.log('✅ Sign in successful, got session token');
        }
      } catch (signInError) {
        console.log(`⚠️ Sign in failed: ${signInError.message}`);
      }
    }

    // Step 4: Test our validateTenant middleware (simulate request)
    let tenantValidationResult = null;
    if (sessionToken) {
      console.log('4. Testing tenant validation...');
      
      // Simulate Express request/response for middleware test
      const mockReq = {
        headers: {
          authorization: `Bearer ${sessionToken}`
        },
        path: '/test'
      };
      
      const mockRes = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          this.responseData = data;
          return this;
        }
      };

      try {
        await new Promise((resolve, reject) => {
          validateTenant(mockReq, mockRes, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });

        if (mockRes.statusCode) {
          tenantValidationResult = {
            success: false,
            status: mockRes.statusCode,
            response: mockRes.responseData
          };
        } else {
          tenantValidationResult = {
            success: true,
            tenant: {
              tenantId: mockReq.tenant?.tenantId,
              name: mockReq.tenant?.name,
              supabaseUserId: mockReq.tenant?.supabaseUserId
            },
            supabaseUser: {
              id: mockReq.supabaseUser?.id,
              email: mockReq.supabaseUser?.email
            }
          };
        }
        
        console.log('✅ Tenant validation successful');
      } catch (validationError) {
        console.log(`❌ Tenant validation failed: ${validationError.message}`);
        tenantValidationResult = {
          success: false,
          error: validationError.message
        };
      }
    }

    // Step 5: Verify tenant-Supabase relationship
    console.log('5. Verifying relationships...');
    const foundTenant = await Tenant.findBySupabaseUserId(signUpData.user.id);
    const relationshipValid = foundTenant && foundTenant.tenantId === tenant.tenantId;

    console.log('🎉 Complete auth flow test finished');

    res.json({
      success: true,
      testData: {
        email: testEmail,
        password: testPassword,
        companyName,
        slug
      },
      results: {
        supabaseSignup: {
          success: true,
          userId: signUpData.user.id,
          userConfirmed: !!signUpData.session,
          needsEmailConfirmation: !signUpData.session
        },
        tenantCreation: {
          success: true,
          tenantId: tenant.tenantId,
          supabaseUserId: tenant.supabaseUserId
        },
        authentication: {
          sessionTokenObtained: !!sessionToken,
          tokenPreview: sessionToken ? sessionToken.substring(0, 20) + '...' : null
        },
        tenantValidation: tenantValidationResult,
        relationships: {
          tenantFoundBySupabaseId: !!foundTenant,
          relationshipValid
        }
      },
      nextSteps: sessionToken 
        ? [
            `Test API access: curl -H "Authorization: Bearer ${sessionToken}" ${req.protocol}://${req.get('host')}/api/tenant/me`,
            'Use this token to test protected endpoints'
          ]
        : [
            'Email confirmation required in Supabase',
            'Check Supabase dashboard Authentication → Settings',
            'Disable "Enable email confirmations" for testing'
          ]
    });

  } catch (error) {
    console.error('❌ Auth flow test failed:', error);
    
    Sentry.captureException(error, {
      extra: {
        endpoint: '/api/test/auth-flow/complete-flow',
        testEmail: testEmail || 'unknown',
        errorStep: 'auth-flow-test'
      }
    });

    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Test tenant endpoint access (requires authentication)
router.get('/test-tenant-endpoint', validateTenant, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Successfully accessed tenant-protected endpoint',
      tenant: {
        tenantId: req.tenant.tenantId,
        name: req.tenant.name,
        email: req.tenant.email,
        subscription: req.tenant.subscription
      },
      user: {
        id: req.supabaseUser.id,
        email: req.supabaseUser.email
      }
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        endpoint: '/api/test/auth-flow/test-tenant-endpoint',
        tenantId: req.tenant?.tenantId
      }
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Quick test to validate a specific token
router.post('/validate-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token required in request body'
      });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Supabase not configured'
      });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError) {
      return res.status(401).json({
        success: false,
        error: userError.message
      });
    }

    const tenant = await Tenant.findBySupabaseUserId(userData.user.id);

    res.json({
      success: true,
      user: userData.user,
      tenant: tenant ? {
        tenantId: tenant.tenantId,
        name: tenant.name,
        slug: tenant.slug
      } : null,
      message: tenant ? 'Token valid, tenant found' : 'Token valid, no tenant associated'
    });

  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        endpoint: '/api/test/auth-flow/validate-token'
      }
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;