const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { validateTenant, validateTenantOwner, validateTenantAdmin } = require('../middleware/tenant');
const emailService = require('../services/email');

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
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  return jwt.sign(
    {
      userId: user.userId,
      tenantId: tenant.tenantId,
      email: user.email,
      role: user.role,
      tenantSlug: tenant.slug
    },
    process.env.JWT_SECRET,
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
    
    // Block unverified emails
    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Por favor verifica tu email antes de iniciar sesión. Revisa tu bandeja de entrada.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
        resendUrl: '/api/tenant/resend-verification'
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
        lastLogin: user.lastLogin,
        emailVerified: user.emailVerified
      },
      token,
      subscriptionActive: tenant.isSubscriptionActive(),
      trialDaysLeft: tenant.subscription.status === 'trialing' ? tenant.daysUntilTrialEnd() : null,
      requiresEmailVerification: !user.emailVerified
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
        lastLogin: req.user.lastLogin,
        emailVerified: req.user.emailVerified
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

// Email verification endpoint
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find user with this verification token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error de Verificación</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f5f5f5; }
            .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #E74C3C; }
            a { color: #4A90E2; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Error de Verificación</h1>
            <p>El enlace de verificación es inválido o ha expirado.</p>
            <p>Por favor, <a href="/admin/register.html">regístrate nuevamente</a> o contacta soporte.</p>
          </div>
        </body>
        </html>
      `);
    }
    
    // Mark email as verified
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(user.email, user.name);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }
    
    // Redirect to login with success message
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verificado</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f5f5f5; }
          .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #27AE60; }
          a { display: inline-block; margin-top: 20px; padding: 12px 30px; background-color: #4A90E2; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ ¡Email Verificado!</h1>
          <p>Tu cuenta ha sido verificada exitosamente.</p>
          <p>Ya puedes acceder a todas las funciones de iAN Chatbot.</p>
          <a href="/admin/login.html">Ir al Login</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f5f5f5; }
          .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #E74C3C; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Error del Servidor</h1>
          <p>Ocurrió un error al verificar tu email. Por favor, intenta más tarde.</p>
        </div>
      </body>
      </html>
    `);
  }
});

// Resend verification email
router.post('/resend-verification', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requerido' });
    }
    
    const user = await User.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return res.json({ 
        message: 'Si el email existe en nuestro sistema, recibirás un correo de verificación.' 
      });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({ error: 'Este email ya está verificado' });
    }
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();
    
    // Send verification email
    await emailService.sendVerificationEmail(user.email, user.name, verificationToken);
    
    res.json({ 
      message: 'Email de verificación enviado. Por favor revisa tu bandeja de entrada.' 
    });
  } catch (error) {
    console.error('Error resending verification:', error);
    res.status(500).json({ error: 'Error al enviar email de verificación' });
  }
});

module.exports = router;