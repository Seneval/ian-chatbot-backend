const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { validateTenant, validateTenantOwner, validateTenantAdmin } = require('../middleware/tenant');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Demasiados intentos de autenticación, intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour
  message: 'Demasiados registros, intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false
});

// Helper function to generate JWT token
const generateToken = (user, tenant) => {
  return jwt.sign(
    {
      userId: user.userId,
      tenantId: tenant.tenantId,
      email: user.email,
      role: user.role,
      tenantSlug: tenant.slug
    },
    process.env.JWT_SECRET || 'default-secret-change-this',
    { expiresIn: '7d' }
  );
};

// Register new tenant (sign up)
router.post('/register', registrationLimiter, async (req, res) => {
  try {
    const {
      tenantName,
      tenantSlug,
      email,
      password,
      name,
      website,
      description
    } = req.body;

    // Validation
    if (!tenantName || !email || !password || !name) {
      return res.status(400).json({
        error: 'Nombre del negocio, email, contraseña y nombre son requeridos',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    // Check if email or slug already exists
    const [existingUser, existingTenant] = await Promise.all([
      User.findOne({ email: email.toLowerCase() }),
      tenantSlug ? Tenant.findOne({ slug: tenantSlug.toLowerCase() }) : null
    ]);

    if (existingUser) {
      return res.status(409).json({
        error: 'Ya existe una cuenta con este email',
        code: 'EMAIL_EXISTS'
      });
    }

    if (existingTenant) {
      return res.status(409).json({
        error: 'Este nombre de negocio ya está en uso',
        code: 'SLUG_EXISTS'
      });
    }

    // Create tenant
    const tenant = new Tenant({
      name: tenantName,
      slug: tenantSlug || tenantName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'),
      email: email.toLowerCase(),
      website,
      description,
      subscription: {
        plan: 'trial',
        status: 'trialing',
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
      }
    });

    await tenant.save();

    // Create owner user
    const user = new User({
      tenantId: tenant.tenantId,
      email: email.toLowerCase(),
      password,
      name,
      role: 'owner',
      emailVerified: true // Auto-verify for now, can implement email verification later
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user, tenant);

    res.status(201).json({
      message: 'Cuenta creada exitosamente',
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        subscription: tenant.subscription,
        limits: tenant.limits,
        usage: tenant.usage
      },
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token,
      trialDaysLeft: tenant.daysUntilTrialEnd()
    });

  } catch (error) {
    console.error('Error en registro de inquilino:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        error: `Ya existe una cuenta con este ${field}`,
        code: 'DUPLICATE_FIELD'
      });
    }
    
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y contraseña son requeridos',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        error: 'Cuenta bloqueada por múltiples intentos fallidos',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      return res.status(401).json({
        error: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Find tenant
    const tenant = await Tenant.findOne({ tenantId: user.tenantId, isActive: true });
    if (!tenant) {
      return res.status(401).json({
        error: 'Inquilino no encontrado o inactivo',
        code: 'TENANT_NOT_FOUND'
      });
    }

    // Reset login attempts and update last login
    await user.resetLoginAttempts();
    await user.updateLastLogin();

    // Generate token
    const token = generateToken(user, tenant);

    res.json({
      message: 'Inicio de sesión exitoso',
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        slug: tenant.slug,
        subscription: tenant.subscription,
        limits: tenant.limits,
        usage: tenant.usage
      },
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin
      },
      token,
      subscriptionActive: tenant.isSubscriptionActive(),
      trialDaysLeft: tenant.subscription.status === 'trialing' ? tenant.daysUntilTrialEnd() : null
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'LOGIN_ERROR'
    });
  }
});

// Get current user info
router.get('/me', validateTenant, async (req, res) => {
  try {
    res.json({
      tenant: {
        tenantId: req.tenant.tenantId,
        name: req.tenant.name,
        slug: req.tenant.slug,
        email: req.tenant.email,
        website: req.tenant.website,
        subscription: req.tenant.subscription,
        limits: req.tenant.limits,
        usage: req.tenant.usage,
        settings: req.tenant.settings
      },
      user: {
        userId: req.user.userId,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        avatar: req.user.avatar,
        preferences: req.user.preferences,
        lastLogin: req.user.lastLogin
      },
      subscriptionActive: req.tenant.isSubscriptionActive(),
      trialDaysLeft: req.tenant.subscription.status === 'trialing' ? req.tenant.daysUntilTrialEnd() : null
    });
  } catch (error) {
    console.error('Error obteniendo información del usuario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'USER_INFO_ERROR'
    });
  }
});

// Update user profile
router.put('/profile', validateTenant, async (req, res) => {
  try {
    const { name, avatar, timezone, language, preferences } = req.body;
    
    const updates = {};
    if (name) updates.name = name;
    if (avatar) updates.avatar = avatar;
    if (timezone) updates.timezone = timezone;
    if (language) updates.language = language;
    if (preferences) updates.preferences = { ...req.user.preferences, ...preferences };

    const user = await User.findOneAndUpdate(
      { userId: req.user.userId },
      updates,
      { new: true }
    );

    res.json({
      message: 'Perfil actualizado exitosamente',
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        timezone: user.timezone,
        language: user.language,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'PROFILE_UPDATE_ERROR'
    });
  }
});

// Update tenant info (owner only)
router.put('/tenant', validateTenantOwner, async (req, res) => {
  try {
    const { name, website, description, settings } = req.body;
    
    const updates = {};
    if (name) updates.name = name;
    if (website) updates.website = website;
    if (description) updates.description = description;
    if (settings) updates.settings = { ...req.tenant.settings, ...settings };

    const tenant = await Tenant.findOneAndUpdate(
      { tenantId: req.tenant.tenantId },
      updates,
      { new: true }
    );

    res.json({
      message: 'Información del negocio actualizada exitosamente',
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        website: tenant.website,
        description: tenant.description,
        settings: tenant.settings
      }
    });
  } catch (error) {
    console.error('Error actualizando información del inquilino:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'TENANT_UPDATE_ERROR'
    });
  }
});

// Get tenant users (admin+ only)
router.get('/users', validateTenantAdmin, async (req, res) => {
  try {
    const users = await User.findByTenant(req.tenant.tenantId);
    
    res.json({
      users: users.map(user => ({
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'USERS_FETCH_ERROR'
    });
  }
});

// Logout (client-side token invalidation)
router.post('/logout', validateTenant, async (req, res) => {
  // In a JWT system, logout is typically handled client-side by removing the token
  // Here we just confirm the action
  res.json({
    message: 'Sesión cerrada exitosamente'
  });
});

module.exports = router;