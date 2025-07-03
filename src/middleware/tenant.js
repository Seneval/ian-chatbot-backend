const { supabase, isSupabaseAvailable } = require('../config/supabase');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Sentry = require('../instrument');

/**
 * Middleware to validate tenant authentication using Supabase
 * Extracts user from Supabase JWT and finds corresponding tenant
 */
async function validateTenant(req, res, next) {
  try {
    // Check if Supabase is configured
    if (!isSupabaseAvailable()) {
      // Fallback to legacy JWT authentication if Supabase is not configured
      return validateTenantLegacy(req, res, next);
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No token provided. Please include Authorization: Bearer <token> header.',
        code: 'MISSING_TOKEN'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Validate token with Supabase
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError) {
      Sentry.captureException(userError, {
        extra: { 
          token: token.substring(0, 20) + '...',
          endpoint: req.path
        }
      });
      
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
        details: userError.message 
      });
    }

    if (!userData.user) {
      return res.status(401).json({ 
        error: 'No user found for token',
        code: 'USER_NOT_FOUND'
      });
    }

    // Find tenant by Supabase user ID
    const tenant = await Tenant.findBySupabaseUserId(userData.user.id);

    if (!tenant) {
      Sentry.captureMessage('User without tenant attempted access', {
        level: 'warning',
        user: { 
          id: userData.user.id, 
          email: userData.user.email 
        },
        extra: { endpoint: req.path }
      });
      
      return res.status(404).json({ 
        error: 'Tenant not found. Please complete registration.',
        code: 'TENANT_NOT_FOUND'
      });
    }

    // Check if tenant is active
    if (!tenant.isActive) {
      Sentry.captureMessage('Inactive tenant attempted access', {
        level: 'warning',
        user: { 
          id: userData.user.id, 
          email: userData.user.email 
        },
        extra: { 
          tenantId: tenant.tenantId,
          endpoint: req.path 
        }
      });
      
      return res.status(403).json({ 
        error: 'Tenant account is inactive. Please contact support.',
        code: 'TENANT_INACTIVE'
      });
    }

    // Check if tenant is suspended
    if (tenant.isSuspended) {
      return res.status(403).json({ 
        error: 'Tenant account is suspended',
        code: 'ACCOUNT_SUSPENDED',
        reason: tenant.suspensionReason || 'Account suspended'
      });
    }

    // Check subscription status
    if (!tenant.isSubscriptionActive()) {
      return res.status(402).json({ 
        error: 'Subscription expired or inactive',
        code: 'SUBSCRIPTION_INACTIVE',
        subscription: {
          status: tenant.subscription.status,
          plan: tenant.subscription.plan
        }
      });
    }

    // Attach tenant and user to request
    req.tenant = tenant;
    req.supabaseUser = userData.user;
    req.tenantId = tenant.tenantId;
    req.auth = {
      userId: userData.user.id,
      email: userData.user.email,
      tenantId: tenant.tenantId
    };

    // Update tenant last activity
    tenant.lastActivity = new Date();
    await tenant.save();

    console.log(`Tenant ${tenant.name} (${tenant.tenantId}) - User ${userData.user.email} accessing ${req.method} ${req.path}`);

    next();
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        endpoint: req.path,
        hasToken: !!req.headers.authorization,
        supabaseAvailable: isSupabaseAvailable()
      }
    });
    
    res.status(500).json({ 
      error: 'Authentication error. Please try again.',
      code: 'AUTHENTICATION_ERROR'
    });
  }
}

/**
 * Legacy JWT-based tenant validation for backwards compatibility
 */
async function validateTenantLegacy(req, res, next) {
  try {
    const jwt = require('jsonwebtoken');
    
    // Extract token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Token de acceso requerido',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify the token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-change-this');
    } catch (error) {
      return res.status(401).json({ 
        error: 'Token inválido o expirado',
        code: 'INVALID_TOKEN'
      });
    }

    // Check if this is a tenant user token (has tenantId)
    if (!decoded.tenantId || !decoded.userId) {
      return res.status(401).json({ 
        error: 'Token no válido para inquilino',
        code: 'INVALID_TENANT_TOKEN'
      });
    }

    // Find the user and tenant
    const [user, tenant] = await Promise.all([
      User.findOne({ userId: decoded.userId, isActive: true }),
      Tenant.findOne({ tenantId: decoded.tenantId, isActive: true })
    ]);

    if (!user) {
      return res.status(401).json({ 
        error: 'Usuario no encontrado o inactivo',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!tenant) {
      return res.status(401).json({ 
        error: 'Inquilino no encontrado o inactivo',
        code: 'TENANT_NOT_FOUND'
      });
    }

    // Check if user belongs to the tenant
    if (user.tenantId !== tenant.tenantId) {
      return res.status(403).json({ 
        error: 'Usuario no pertenece a este inquilino',
        code: 'USER_TENANT_MISMATCH'
      });
    }

    // Check if tenant subscription is active
    if (!tenant.isSubscriptionActive()) {
      return res.status(403).json({ 
        error: 'Suscripción inactiva o expirada',
        code: 'SUBSCRIPTION_INACTIVE',
        details: {
          status: tenant.subscription.status,
          trialEnd: tenant.subscription.trialEnd
        }
      });
    }

    // Check if tenant is suspended
    if (tenant.isSuspended) {
      return res.status(403).json({ 
        error: 'Cuenta suspendida',
        code: 'ACCOUNT_SUSPENDED',
        details: {
          reason: tenant.suspensionReason
        }
      });
    }

    // Attach user and tenant to request
    req.user = user;
    req.tenant = tenant;
    req.tenantId = tenant.tenantId;
    
    console.log(`Tenant ${tenant.name} (${tenant.tenantId}) - User ${user.email} accessing ${req.method} ${req.path}`);
    
    next();
  } catch (error) {
    console.error('Error en validación de inquilino:', error);
    res.status(500).json({ 
      error: 'Error en autenticación',
      code: 'AUTHENTICATION_ERROR'
    });
  }
}

/**
 * Middleware to validate tenant owner permissions
 * Must be used after validateTenant
 */
async function validateTenantOwner(req, res, next) {
  if (!req.tenant) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  // For Supabase users, check if they are the tenant creator
  if (req.supabaseUser) {
    if (req.tenant.supabaseUserId !== req.supabaseUser.id) {
      return res.status(403).json({ 
        error: 'Owner permissions required',
        code: 'OWNER_REQUIRED'
      });
    }
  } else if (req.user) {
    // For legacy JWT users, check role
    if (req.user.role !== 'owner') {
      return res.status(403).json({ 
        error: 'Acceso denegado: Se requieren permisos de propietario',
        code: 'OWNER_REQUIRED'
      });
    }
  }

  next();
}

/**
 * Middleware to validate tenant admin permissions
 */
async function validateTenantAdmin(req, res, next) {
  await validateTenant(req, res, (err) => {
    if (err) return next(err);
    
    // For Supabase users, owner is considered admin
    if (req.supabaseUser) {
      if (req.tenant.supabaseUserId !== req.supabaseUser.id) {
        return res.status(403).json({ 
          error: 'Admin permissions required',
          code: 'ADMIN_REQUIRED'
        });
      }
    } else if (req.user) {
      // For legacy JWT users, check role
      if (!['owner', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ 
          error: 'Acceso denegado: Se requieren permisos de administrador',
          code: 'ADMIN_REQUIRED'
        });
      }
    }
    
    next();
  });
}

/**
 * Check tenant limits for specific resources
 */
const checkTenantLimits = (resource) => {
  return async (req, res, next) => {
    try {
      if (!req.tenant) {
        return res.status(401).json({ 
          error: 'Tenant information required',
          code: 'TENANT_INFO_REQUIRED'
        });
      }

      const limits = req.tenant.isWithinLimits();
      
      switch (resource) {
        case 'clients':
          if (!limits.clients) {
            return res.status(403).json({ 
              error: 'Client limit exceeded',
              code: 'CLIENT_LIMIT_EXCEEDED',
              details: {
                current: req.tenant.usage.currentClients,
                limit: req.tenant.limits.maxClients
              }
            });
          }
          break;
          
        case 'users':
          if (!limits.users) {
            return res.status(403).json({ 
              error: 'User limit exceeded',
              code: 'USER_LIMIT_EXCEEDED',
              details: {
                current: req.tenant.usage.currentUsers,
                limit: req.tenant.limits.maxUsers
              }
            });
          }
          break;
          
        case 'messages':
          if (!limits.messages) {
            return res.status(403).json({ 
              error: 'Monthly message limit exceeded',
              code: 'MESSAGE_LIMIT_EXCEEDED',
              details: {
                current: req.tenant.usage.currentMonthMessages,
                limit: req.tenant.limits.maxMessagesPerMonth
              }
            });
          }
          break;
          
        default:
          if (!limits.overall) {
            return res.status(403).json({ 
              error: 'One or more plan limits have been reached',
              code: 'PLAN_LIMITS_EXCEEDED',
              details: {
                limits: req.tenant.limits,
                usage: req.tenant.usage
              }
            });
          }
      }
      
      next();
    } catch (error) {
      console.error('Error checking tenant limits:', error);
      res.status(500).json({ 
        error: 'Error checking limits',
        code: 'LIMIT_CHECK_ERROR'
      });
    }
  };
};

// Super admin middleware (for platform administration)
const validateSuperAdmin = async (req, res, next) => {
  try {
    const jwt = require('jsonwebtoken');
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Super admin token required',
        code: 'MISSING_SUPER_ADMIN_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'admin-secret-change-this');
    
    // Check if it's the legacy admin or a super admin email
    const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || 'admin@platform.com').split(',');
    const isLegacyAdmin = decoded.role === 'admin' && decoded.username === 'admin';
    const isSuperAdmin = superAdminEmails.includes(decoded.email);
    
    if (!isLegacyAdmin && !isSuperAdmin) {
      return res.status(403).json({ 
        error: 'Access denied: Super admin permissions required',
        code: 'SUPER_ADMIN_REQUIRED'
      });
    }
    
    req.superAdmin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Invalid super admin token',
      code: 'INVALID_SUPER_ADMIN_TOKEN'
    });
  }
};

module.exports = {
  validateTenant,
  validateTenantOwner,
  validateTenantAdmin,
  checkTenantLimits,
  validateSuperAdmin
};