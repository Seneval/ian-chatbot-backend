const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { supabase, isSupabaseAvailable } = require('../config/supabase');
const { isMongoDBAvailable } = require('../config/database');

// In-memory storage fallback
const inMemoryStorage = {
  users: new Map(),
  tenants: new Map()
};

// Session validation endpoint - handles OAuth data from frontend
router.post('/session', async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Supabase not available' });
    }

    const { user: supabaseUser, access_token } = req.body;

    if (!supabaseUser || !access_token) {
      return res.status(400).json({ error: 'Missing user data or access token' });
    }

    // Verify the session with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(access_token);

    if (error || !user) {
      console.error('Invalid Supabase session:', error);
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Ensure the user ID matches
    if (user.id !== supabaseUser.id) {
      return res.status(401).json({ error: 'Session mismatch' });
    }

    // Extract user info
    const email = user.email;
    const googleId = user.id;
    const name = user.user_metadata?.full_name || email.split('@')[0];

    // Check if user exists
    let existingUser;
    console.log('🔍 Checking for existing user:', { email, googleId });
    
    if (isMongoDBAvailable()) {
      existingUser = await User.findOne({ 
        $or: [
          { email },
          { googleId },
          { supabaseUserId: googleId }
        ]
      });
      console.log('📊 MongoDB search result:', existingUser ? 'User found' : 'User not found');
    } else {
      existingUser = Array.from(inMemoryStorage.users.values()).find(u => 
        u.email === email || u.googleId === googleId || u.supabaseUserId === googleId
      );
      console.log('💾 In-memory search result:', existingUser ? 'User found' : 'User not found');
    }

    if (existingUser) {
      // User exists - check tenant association
      if (existingUser.tenantId) {
        // User has tenant - log them in
        const token = jwt.sign(
          { 
            userId: existingUser.userId,
            tenantId: existingUser.tenantId,
            email: existingUser.email,
            role: existingUser.role,
            authMethod: 'google'
          },
          process.env.ADMIN_JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.json({ 
          token,
          user: {
            userId: existingUser.userId,
            email: existingUser.email,
            name: existingUser.name,
            role: existingUser.role
          }
        });
      } else {
        // User exists but no tenant
        const tempToken = jwt.sign(
          { email, googleId, name, authMethod: 'google' },
          process.env.ADMIN_JWT_SECRET,
          { expiresIn: '10m' }
        );
        return res.json({ 
          conflict: 'no_tenant',
          tempToken
        });
      }
    } else {
      // New user - needs registration
      console.log('👤 New user detected, needs registration');
      
      // BUT first, let's check if they might have partially registered
      // Check by email only (maybe they registered with password before)
      let userByEmail;
      if (isMongoDBAvailable()) {
        userByEmail = await User.findOne({ email });
      } else {
        userByEmail = Array.from(inMemoryStorage.users.values()).find(u => u.email === email);
      }
      
      if (userByEmail) {
        console.log('📧 Found user by email only - updating with Google ID');
        // User exists with same email but no Google ID - link them
        if (isMongoDBAvailable()) {
          userByEmail.googleId = googleId;
          userByEmail.supabaseUserId = googleId;
          userByEmail.authMethod = 'hybrid';
          await userByEmail.save();
        } else {
          userByEmail.googleId = googleId;
          userByEmail.supabaseUserId = googleId;
          userByEmail.authMethod = 'hybrid';
          inMemoryStorage.users.set(userByEmail.userId, userByEmail);
        }
        
        // Now log them in if they have a tenant
        if (userByEmail.tenantId) {
          const token = jwt.sign(
            { 
              userId: userByEmail.userId,
              tenantId: userByEmail.tenantId,
              email: userByEmail.email,
              role: userByEmail.role,
              authMethod: 'hybrid'
            },
            process.env.ADMIN_JWT_SECRET,
            { expiresIn: '7d' }
          );

          return res.json({ 
            token,
            user: {
              userId: userByEmail.userId,
              email: userByEmail.email,
              name: userByEmail.name,
              role: userByEmail.role
            }
          });
        }
      }
      
      const tempToken = jwt.sign(
        { email, googleId, name, authMethod: 'google' },
        process.env.ADMIN_JWT_SECRET,
        { expiresIn: '10m' }
      );
      return res.json({ 
        requiresRegistration: true,
        tempToken
      });
    }

  } catch (error) {
    console.error('OAuth session error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Error al procesar la sesión' });
  }
});

// Complete registration for Google OAuth users
router.post('/complete-registration', async (req, res) => {
  try {
    const { token, tenantName, tenantSlug } = req.body;

    if (!token || !tenantName || !tenantSlug) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify temporary token
    let tokenData;
    try {
      tokenData = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!tokenData.googleId || !tokenData.email) {
      return res.status(400).json({ error: 'Invalid token data' });
    }

    // Check if tenant slug already exists
    let existingTenant;
    if (isMongoDBAvailable()) {
      existingTenant = await Tenant.findOne({ slug: tenantSlug });
    } else {
      existingTenant = Array.from(inMemoryStorage.tenants.values()).find(t => t.slug === tenantSlug);
    }

    if (existingTenant) {
      return res.status(400).json({ error: 'Tenant slug already exists' });
    }

    // Create tenant
    const tenantId = uuidv4();
    const tenantData = {
      tenantId,
      name: tenantName,
      slug: tenantSlug,
      createdAt: new Date()
    };

    if (isMongoDBAvailable()) {
      const tenant = new Tenant(tenantData);
      await tenant.save();
    } else {
      inMemoryStorage.tenants.set(tenantId, tenantData);
    }

    // Create user
    const userId = uuidv4();
    const userData = {
      userId,
      tenantId,
      email: tokenData.email,
      name: tokenData.name || tokenData.email.split('@')[0],
      googleId: tokenData.googleId,
      supabaseUserId: tokenData.googleId,
      role: 'owner',
      authMethod: 'google',
      isEmailVerified: true, // Google emails are pre-verified
      createdAt: new Date()
    };

    console.log('👤 Creating user with data:', {
      email: userData.email,
      googleId: userData.googleId,
      tenantId: userData.tenantId
    });

    if (isMongoDBAvailable()) {
      const user = new User(userData);
      await user.save();
      console.log('✅ User saved to MongoDB:', user.userId);
    } else {
      inMemoryStorage.users.set(userId, userData);
      console.log('💾 User saved to in-memory storage');
    }

    // Generate auth token
    const authToken = jwt.sign(
      { 
        userId,
        tenantId,
        email: userData.email,
        role: userData.role,
        authMethod: 'google'
      },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token: authToken,
      user: {
        userId,
        email: userData.email,
        name: userData.name,
        role: userData.role
      }
    });

  } catch (error) {
    console.error('Complete registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Link existing account to Google
router.post('/link-account', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify temporary token
    let tokenData;
    try {
      tokenData = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!tokenData.googleId || !tokenData.email) {
      return res.status(400).json({ error: 'Invalid token data' });
    }

    // Find user by email
    let user;
    if (isMongoDBAvailable()) {
      user = await User.findOne({ email: tokenData.email });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      // Update user with Google ID
      user.googleId = tokenData.googleId;
      user.supabaseUserId = tokenData.googleId;
      user.authMethod = 'hybrid'; // Can use both password and Google
      await user.save();
    } else {
      user = Array.from(inMemoryStorage.users.values()).find(u => u.email === tokenData.email);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // For in-memory, we don't store passwords, so skip verification
      user.googleId = tokenData.googleId;
      user.supabaseUserId = tokenData.googleId;
      user.authMethod = 'hybrid';
      inMemoryStorage.users.set(user.userId, user);
    }

    // Generate auth token
    const authToken = jwt.sign(
      { 
        userId: user.userId,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        authMethod: 'hybrid'
      },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token: authToken,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Link account error:', error);
    res.status(500).json({ error: 'Failed to link account' });
  }
});

module.exports = router;