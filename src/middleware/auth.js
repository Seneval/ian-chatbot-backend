const jwt = require('jsonwebtoken');

// Import MongoDB models
let Tenant;
try {
  Tenant = require('../models/Tenant');
} catch (error) {
  console.log('⚠️  MongoDB models not available for usage middleware');
}

const validateClient = async (req, res, next) => {
  try {
    // Extract client token from headers or query params
    const token = req.headers['x-client-token'] || req.query.token;
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Token de cliente requerido' 
      });
    }

    // Verify the token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-change-this');
      req.client = decoded;
      
      // Log the request for analytics
      console.log(`Cliente ${decoded.clientId} accediendo a ${req.path}`);
      
      next();
    } catch (error) {
      return res.status(401).json({ 
        error: 'Token inválido o expirado' 
      });
    }
  } catch (error) {
    console.error('Error en validación de cliente:', error);
    res.status(500).json({ 
      error: 'Error en autenticación' 
    });
  }
};

const validateAdmin = async (req, res, next) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Token de administrador requerido' 
      });
    }

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'admin-secret-change-this');
    
    // Accept both admin and owner roles
    if (decoded.role !== 'admin' && decoded.role !== 'owner') {
      return res.status(403).json({ 
        error: 'Acceso denegado' 
      });
    }
    
    req.admin = decoded;
    
    // Add tenant context for owners
    if (decoded.role === 'owner' && decoded.tenantId) {
      req.tenantId = decoded.tenantId;
      console.log(`🏢 Owner access for tenant: ${decoded.tenantId}`);
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Token de administrador inválido' 
    });
  }
};

const checkUsageLimit = async (req, res, next) => {
  try {
    // Only check limits if we have tenant info and MongoDB available
    if (!req.client?.tenantId || !Tenant) {
      return next();
    }
    
    const tenant = await Tenant.findOne({ tenantId: req.client.tenantId });
    if (!tenant) {
      return res.status(404).json({ 
        error: 'Tenant no encontrado' 
      });
    }
    
    // Reset counters if needed (this will happen automatically but let's be explicit)
    await tenant.updateUsage('currentDayMessages', 0); // This will trigger reset logic
    
    // Check if tenant is within daily limits
    const limits = tenant.isWithinLimits();
    
    if (!limits.dailyMessages) {
      const remainingHours = 24 - new Date().getHours();
      return res.status(429).json({ 
        error: `Has alcanzado el límite de ${tenant.limits.maxMessagesPerDay} mensajes por día. Intenta de nuevo en ${remainingHours} horas o actualiza tu plan.`,
        code: 'DAILY_LIMIT_EXCEEDED',
        limits: {
          daily: tenant.limits.maxMessagesPerDay,
          used: tenant.usage.currentDayMessages,
          resetIn: remainingHours
        }
      });
    }
    
    if (!limits.messages) {
      return res.status(429).json({ 
        error: `Has alcanzado el límite mensual de ${tenant.limits.maxMessagesPerMonth} mensajes. Actualiza tu plan para continuar.`,
        code: 'MONTHLY_LIMIT_EXCEEDED',
        limits: {
          monthly: tenant.limits.maxMessagesPerMonth,
          used: tenant.usage.currentMonthMessages
        }
      });
    }
    
    // Store tenant for later use in updating usage
    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('Error checking usage limits:', error);
    // Don't block requests on usage check errors in production
    next();
  }
};

module.exports = {
  validateClient,
  validateAdmin,
  checkUsageLimit
};