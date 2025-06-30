const jwt = require('jsonwebtoken');

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
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Acceso denegado' 
      });
    }
    
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Token de administrador inválido' 
    });
  }
};

module.exports = {
  validateClient,
  validateAdmin
};