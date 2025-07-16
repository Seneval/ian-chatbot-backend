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

    // Check if tenant exists in Supabase database
    let existingTenant;
    console.log('🔍 Checking for existing tenant:', { email, googleId });
    
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .or(`email.eq.${email},google_id.eq.${googleId}`)
      .single();

    if (tenantError && tenantError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking existing tenant:', tenantError);
      return res.status(500).json({ error: 'Database error' });
    }

    existingTenant = tenantData;
    console.log('🏢 Supabase tenant search result:', existingTenant ? 'Tenant found' : 'Tenant not found');

    if (existingTenant) {
      // Tenant exists - log them in
      console.log('✅ Tenant found:', {
        id: existingTenant.id,
        email: existingTenant.email,
        plan: existingTenant.plan
      });

      // Update Google ID if not set
      if (!existingTenant.google_id && googleId) {
        const { error: updateError } = await supabase
          .from('tenants')
          .update({ google_id: googleId })
          .eq('id', existingTenant.id);

        if (updateError) {
          console.error('Error updating Google ID:', updateError);
        } else {
          console.log('✅ Updated tenant with Google ID');
        }
      }

      // Determine if this is a super admin
      const isSuperAdmin = existingTenant.email === 'patriciohml@gmail.com';

      const token = jwt.sign(
        { 
          tenantId: existingTenant.id,
          email: existingTenant.email,
          name: name,
          role: isSuperAdmin ? 'super_admin' : 'owner',
          plan: existingTenant.plan,
          authMethod: 'google'
        },
        process.env.ADMIN_JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({ 
        token,
        tenant: {
          id: existingTenant.id,
          name: existingTenant.name,
          slug: existingTenant.slug,
          email: existingTenant.email,
          plan: existingTenant.plan
        },
        user: {
          email: existingTenant.email,
          name: name,
          role: isSuperAdmin ? 'super_admin' : 'owner'
        }
      });
    } else {
      // New user - needs registration
      console.log('👤 New user detected, needs registration');
      
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

// Complete registration for Google OAuth users - Uses Supabase database
router.post('/complete-registration', async (req, res) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Supabase not available' });
    }

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

    console.log('🔐 Token data:', {
      email: tokenData.email,
      googleId: tokenData.googleId,
      name: tokenData.name
    });

    // Check if tenant slug already exists
    const { data: existingTenant, error: tenantCheckError } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single();

    if (tenantCheckError && tenantCheckError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking tenant slug:', tenantCheckError);
      return res.status(500).json({ error: 'Error checking tenant availability' });
    }

    if (existingTenant) {
      return res.status(400).json({ error: 'Tenant slug already exists' });
    }

    // Check if user email already exists
    const { data: existingUser, error: userCheckError } = await supabase
      .from('tenants')
      .select('id, email')
      .eq('email', tokenData.email)
      .single();

    if (userCheckError && userCheckError.code !== 'PGRST116') {
      console.error('Error checking user email:', userCheckError);
      return res.status(500).json({ error: 'Error checking user availability' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Determine if this is a super admin
    const isSuperAdmin = tokenData.email === 'patriciohml@gmail.com';
    const plan = isSuperAdmin ? 'super_admin' : 'free';

    // Create tenant in Supabase
    const { data: newTenant, error: tenantCreateError } = await supabase
      .from('tenants')
      .insert([{
        name: tenantName,
        slug: tenantSlug,
        email: tokenData.email,
        google_id: tokenData.googleId,
        plan: plan,
        is_active: true
      }])
      .select()
      .single();

    if (tenantCreateError) {
      console.error('Error creating tenant:', tenantCreateError);
      return res.status(500).json({ error: 'Failed to create tenant' });
    }

    console.log('✅ Tenant created:', {
      id: newTenant.id,
      name: newTenant.name,
      email: newTenant.email,
      plan: newTenant.plan
    });

    // Generate auth token with tenant context
    const authToken = jwt.sign(
      { 
        tenantId: newTenant.id,
        email: newTenant.email,
        name: tokenData.name || tokenData.email.split('@')[0],
        role: isSuperAdmin ? 'super_admin' : 'owner',
        plan: newTenant.plan,
        authMethod: 'google'
      },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token: authToken,
      tenant: {
        id: newTenant.id,
        name: newTenant.name,
        slug: newTenant.slug,
        email: newTenant.email,
        plan: newTenant.plan
      },
      user: {
        email: newTenant.email,
        name: tokenData.name || tokenData.email.split('@')[0],
        role: isSuperAdmin ? 'super_admin' : 'owner'
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