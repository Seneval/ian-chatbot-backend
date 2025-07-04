const jwt = require('jsonwebtoken');

// Import MongoDB models
let Tenant, Client;
try {
  Tenant = require('../models/Tenant');
  Client = require('../models/Client');
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
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required');
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

    if (!process.env.ADMIN_JWT_SECRET) {
      throw new Error('ADMIN_JWT_SECRET environment variable is required');
    }
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    
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
    // Check per-chatbot limits (new pricing model)
    if (req.client?.clientId && Client) {
      const client = await Client.findOne({ clientId: req.client.clientId });
      if (!client) {
        return res.status(404).json({ 
          error: 'Cliente no encontrado' 
        });
      }
      
      // Check if chatbot is within daily limits
      const isWithinLimits = await client.isWithinLimits();
      
      if (!isWithinLimits) {
        // Calculate time until midnight in Monterrey timezone
        const now = new Date();
        const monterreyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Monterrey"}));
        const midnight = new Date(monterreyTime);
        midnight.setDate(midnight.getDate() + 1);
        midnight.setHours(0, 0, 0, 0);
        
        const remainingMs = midnight - monterreyTime;
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        const isPaid = client.plan === 'paid';
        
        return res.status(429).json({ 
          error: isPaid 
            ? `Has alcanzado el límite de ${client.limits.messagesPerDay} mensajes por día.`
            : `Has alcanzado el límite gratuito de ${client.limits.messagesPerDay} mensajes por día. Actualiza a Premium por solo $200 MXN/mes para obtener hasta 1,000 mensajes diarios.`,
          code: 'DAILY_LIMIT_EXCEEDED',
          limits: {
            daily: client.limits.messagesPerDay,
            used: client.usage.currentDayMessages,
            resetIn: remainingHours,
            plan: client.plan
          },
          upgrade: !isPaid ? {
            message: 'Actualiza a Premium para más mensajes',
            price: 200,
            currency: 'MXN',
            features: ['1,000 mensajes por día', 'Soporte prioritario', 'Sin límites de sesiones']
          } : undefined
        });
      }
      
      // Store client for later use in updating usage
      req.chatbotClient = client;
    }
    
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