const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Import AdminUser model
let AdminUser;
try {
  AdminUser = require('../models/AdminUser');
} catch (error) {
  console.log('⚠️  AdminUser model not available');
}

// Check if MongoDB is available
const isMongoDBAvailable = () => {
  return AdminUser && process.env.MONGODB_URI;
};

// POST /api/admin/setup - One-time admin setup
router.post('/setup', async (req, res) => {
  try {
    // Check if MongoDB is available
    if (!isMongoDBAvailable()) {
      return res.status(503).json({ 
        error: 'Base de datos no disponible para configuración de admin' 
      });
    }

    // Check if setup key is configured
    const setupKey = process.env.ADMIN_SETUP_KEY;
    if (!setupKey) {
      return res.status(403).json({ 
        error: 'Configuración de admin no habilitada' 
      });
    }

    // Verify setup key
    const { setupKey: providedKey, username, email, password } = req.body;
    if (providedKey !== setupKey) {
      // Log failed attempt
      console.error('❌ Failed admin setup attempt with wrong key from IP:', req.ip);
      return res.status(403).json({ 
        error: 'Clave de configuración inválida' 
      });
    }

    // Check if any admin already exists
    const hasAdmins = await AdminUser.hasAdmins();
    if (hasAdmins) {
      return res.status(403).json({ 
        error: 'La configuración inicial ya fue completada' 
      });
    }

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email y password son requeridos' 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 8 caracteres' 
      });
    }

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Email inválido' 
      });
    }

    // Create the first admin user
    const adminUser = new AdminUser({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      role: 'super_admin' // First admin gets super_admin role
    });

    await adminUser.save();

    // Record successful setup
    await adminUser.recordLogin(req.ip, req.headers['user-agent'], true);

    console.log('✅ First admin user created successfully:', username);

    // Generate JWT token
    const adminToken = jwt.sign(
      { 
        adminId: adminUser.adminId,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Admin configurado exitosamente',
      token: adminToken,
      admin: {
        adminId: adminUser.adminId,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      },
      warning: 'Por seguridad, elimina ADMIN_SETUP_KEY del entorno ahora'
    });

  } catch (error) {
    console.error('Error in admin setup:', error);
    
    // Check for duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        error: `El ${field} ya está en uso` 
      });
    }
    
    res.status(500).json({ 
      error: 'Error al configurar admin' 
    });
  }
});

// GET /api/admin/setup/status - Check if setup is available
router.get('/setup/status', async (req, res) => {
  try {
    if (!isMongoDBAvailable()) {
      return res.json({ 
        setupAvailable: false,
        reason: 'database_unavailable' 
      });
    }

    const hasAdmins = await AdminUser.hasAdmins();
    const setupKeyConfigured = !!process.env.ADMIN_SETUP_KEY;

    res.json({
      setupAvailable: !hasAdmins && setupKeyConfigured,
      hasAdmins,
      setupKeyConfigured
    });
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({ 
      error: 'Error al verificar estado de configuración' 
    });
  }
});

module.exports = router;