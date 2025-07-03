const express = require('express');
const jwt = require('jsonwebtoken');
const Tenant = require('../../models/Tenant');
const User = require('../../models/User');
const Sentry = require('../../instrument');

const router = express.Router();

// Simple tenant registration test
router.post('/simple', async (req, res) => {
  try {
    const { 
      companyName = 'Debug Test Company',
      email = `debug-${Date.now()}@example.com`,
      password = 'TestPass123!',
      contactName = 'Debug User'
    } = req.body;

    console.log('🧪 Starting simple registration test...');
    console.log('📥 Input:', { companyName, email, contactName });

    // Generate slug
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    console.log('🏷️ Generated slug:', slug);

    // Check environment
    console.log('🔧 Environment check:');
    console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'set' : 'missing');
    console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'set' : 'missing');

    // Step 1: Create tenant
    console.log('🏢 Creating tenant...');
    const tenant = new Tenant({
      name: companyName,
      slug: slug + '-' + Date.now(),
      email: email
    });

    await tenant.save();
    console.log('✅ Tenant created:', tenant.tenantId);

    // Step 2: Create user
    console.log('👤 Creating user...');
    const user = new User({
      tenantId: tenant.tenantId,
      email: email,
      password: password,
      name: contactName,
      role: 'owner'
    });

    await user.save();
    console.log('✅ User created:', user.userId);

    // Step 3: Generate token
    console.log('🔑 Generating token...');
    const token = jwt.sign(
      {
        tenantId: tenant.tenantId,
        userId: user.userId,
        role: 'owner',
        email: email,
        authMethod: 'legacy'
      },
      process.env.JWT_SECRET || 'fallback-debug-secret',
      { expiresIn: '7d' }
    );

    console.log('✅ Token generated');

    res.json({
      success: true,
      message: 'Simple registration completed successfully',
      data: {
        tenant: {
          tenantId: tenant.tenantId,
          name: tenant.name,
          slug: tenant.slug,
          email: tenant.email
        },
        user: {
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token: token.substring(0, 20) + '...',
        fullToken: token
      }
    });

  } catch (error) {
    console.error('❌ Simple registration failed:', error);
    
    Sentry.captureException(error, {
      extra: {
        endpoint: '/api/test/registration/simple',
        requestBody: req.body
      }
    });

    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;