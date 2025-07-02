const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

const validateTenant = async (req, res, next) => {
  try {
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
    
    // Log the request for analytics
    console.log(`Tenant ${tenant.name} (${tenant.tenantId}) - User ${user.email} accessing ${req.method} ${req.path}`);
    
    next();
  } catch (error) {
    console.error('Error en validación de inquilino:', error);
    res.status(500).json({ 
      error: 'Error en autenticación',
      code: 'AUTHENTICATION_ERROR'
    });
  }
};

const validateTenantOwner = async (req, res, next) => {
  // First validate tenant
  await validateTenant(req, res, (err) => {
    if (err) return next(err);
    
    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({ 
        error: 'Acceso denegado: Se requieren permisos de propietario',
        code: 'OWNER_REQUIRED'
      });
    }
    
    next();
  });
};

const validateTenantAdmin = async (req, res, next) => {
  // First validate tenant
  await validateTenant(req, res, (err) => {
    if (err) return next(err);
    
    // Check if user is owner or admin
    if (!['owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Acceso denegado: Se requieren permisos de administrador',
        code: 'ADMIN_REQUIRED'
      });
    }
    
    next();
  });
};

const validateTenantPermission = (permission) => {
  return async (req, res, next) => {
    // First validate tenant
    await validateTenant(req, res, (err) => {
      if (err) return next(err);
      
      // Check if user has the required permission
      if (!req.user.hasPermission(permission)) {
        return res.status(403).json({ 
          error: `Acceso denegado: Se requiere permiso ${permission}`,
          code: 'PERMISSION_REQUIRED',
          details: { permission }
        });
      }
      
      next();
    });
  };
};

const checkTenantLimits = (resource) => {
  return async (req, res, next) => {
    try {
      if (!req.tenant) {
        return res.status(401).json({ 
          error: 'Información de inquilino requerida',
          code: 'TENANT_INFO_REQUIRED'
        });
      }

      const limits = req.tenant.isWithinLimits();
      
      switch (resource) {
        case 'clients':
          if (!limits.clients) {
            return res.status(403).json({ 
              error: 'Límite de clientes alcanzado',
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
              error: 'Límite de usuarios alcanzado',
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
              error: 'Límite de mensajes mensuales alcanzado',
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
              error: 'Uno o más límites del plan han sido alcanzados',
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
      console.error('Error verificando límites del inquilino:', error);
      res.status(500).json({ 
        error: 'Error verificando límites',
        code: 'LIMIT_CHECK_ERROR'
      });
    }
  };
};

// Super admin middleware (for platform administration)
const validateSuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Token de super administrador requerido',
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
        error: 'Acceso denegado: Se requieren permisos de super administrador',
        code: 'SUPER_ADMIN_REQUIRED'
      });
    }
    
    req.superAdmin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Token de super administrador inválido',
      code: 'INVALID_SUPER_ADMIN_TOKEN'
    });
  }
};

module.exports = {
  validateTenant,
  validateTenantOwner,
  validateTenantAdmin,
  validateTenantPermission,
  checkTenantLimits,
  validateSuperAdmin
};