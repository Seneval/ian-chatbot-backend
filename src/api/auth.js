const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { validateAdmin } = require('../middleware/auth');
const router = express.Router();

// Handle preflight requests for CORS
router.options('/*', (req, res) => {
  const origin = req.headers.origin;
  
  // Allow origins that include our domains or localhost
  if (origin && (origin.includes('inteligenciaartificialparanegocios.com') || origin.includes('localhost') || origin.includes('vercel.app'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-client-token, x-admin-setup-key, x-test-api-key');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
  }
  
  res.status(204).end();
});

// Import MongoDB models
let Client, User, Tenant, AdminUser;
try {
  Client = require('../models/Client');
  User = require('../models/User');
  Tenant = require('../models/Tenant');
  AdminUser = require('../models/AdminUser');
} catch (error) {
  console.log('⚠️  MongoDB models not available, using in-memory storage');
}

// Fallback in-memory storage if MongoDB is not available
const inMemoryClients = {};

// Check if MongoDB is available
const isMongoDBAvailable = () => {
  return Client && process.env.MONGODB_URI;
};

// Admin login (supports both legacy admin and tenant users)
router.post('/admin/login', async (req, res) => {
  // Set CORS headers for all requests to this endpoint
  const origin = req.headers.origin;
  if (origin && (origin.includes('inteligenciaartificialparanegocios.com') || origin.includes('localhost') || origin.includes('vercel.app'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  }
  try {
    const { username, password, email } = req.body;
    console.log('🔐 Login attempt:', { username, email, hasPassword: !!password, origin });
    console.log('🔐 Full request body received:', req.body);
    
    // Try tenant user login first (email-based)
    if (User && Tenant && (email || username.includes('@'))) {
      const loginEmail = email || username;
      console.log('👤 Attempting tenant user login for:', loginEmail);
      
      try {
        const user = await User.findByEmail(loginEmail);
        if (user && await user.comparePassword(password)) {
          // Check if email is verified
          if (!user.emailVerified) {
            return res.status(403).json({
              error: 'Por favor verifica tu email antes de iniciar sesión. Revisa tu bandeja de entrada.',
              code: 'EMAIL_NOT_VERIFIED',
              email: user.email
            });
          }
          
          const tenant = await Tenant.findOne({ tenantId: user.tenantId });
          
          if (tenant) {
            console.log('✅ Tenant user login successful');
            
            const token = jwt.sign(
              { 
                id: user.userId,
                tenantId: user.tenantId,
                email: user.email,
                role: user.role,
                type: 'tenant'
              },
              process.env.ADMIN_JWT_SECRET,
              { expiresIn: '24h' }
            );
            
            return res.json({
              token,
              admin: {
                id: user.userId,
                username: user.email,
                role: user.role,
                tenant: {
                  name: tenant.name,
                  tenantId: tenant.tenantId
                }
              }
            });
          }
        }
      } catch (dbError) {
        console.log('⚠️ Database error during tenant login:', dbError.message);
      }
    }
    
    // Try AdminUser login
    if (AdminUser) {
      console.log('🔧 Attempting admin user login for:', username);
      
      try {
        const adminUser = await AdminUser.findByCredentials(username);
        if (adminUser && await adminUser.comparePassword(password)) {
          console.log('✅ Admin user login successful');
          
          // Record successful login
          await adminUser.recordLogin(req.ip, req.headers['user-agent'], true);
          
          // Check if ADMIN_JWT_SECRET is configured
          if (!process.env.ADMIN_JWT_SECRET) {
            throw new Error('ADMIN_JWT_SECRET environment variable is required');
          }
          
          const token = jwt.sign(
            { 
              id: adminUser.adminId,
              username: adminUser.username,
              email: adminUser.email,
              role: adminUser.role,
              type: 'admin'
            },
            process.env.ADMIN_JWT_SECRET,
            { expiresIn: '24h' }
          );
          
          return res.json({
            token,
            admin: {
              id: adminUser.adminId,
              username: adminUser.username,
              role: adminUser.role,
              email: adminUser.email
            }
          });
        } else {
          // Record failed login attempt if admin exists
          if (adminUser) {
            await adminUser.recordLogin(req.ip, req.headers['user-agent'], false);
          }
        }
      } catch (dbError) {
        console.log('⚠️ Database error during admin login:', dbError.message);
        if (dbError.message === 'ADMIN_JWT_SECRET environment variable is required') {
          return res.status(500).json({ 
            error: 'Configuración del servidor incompleta. Contacte al administrador.' 
          });
        }
      }
    }
    
    // If we reach here, login failed
    return res.status(401).json({ 
      error: 'Credenciales inválidas' 
    });
  } catch (error) {
    console.error('Error in admin login:', error);
    res.status(500).json({ 
      error: 'Error al iniciar sesión' 
    });
  }
});

// Create new client
router.post('/client', validateAdmin, async (req, res) => {
  try {
    const { 
      businessName, 
      contactEmail, 
      assistantId,
      contactPerson,
      phone,
      plan = 'free',
      notes,
      monthlyMessageLimit = 1000,
      widgetTitle,
      widgetGreeting
    } = req.body;
    
    if (!businessName || !contactEmail || !assistantId) {
      return res.status(400).json({ 
        error: 'businessName, contactEmail y assistantId son requeridos' 
      });
    }
    
    // Validate assistant ID format
    if (!assistantId.startsWith('asst_')) {
      return res.status(400).json({
        error: `Invalid assistant ID format: '${assistantId}'. Assistant IDs must start with 'asst_'`
      });
    }
    
    const clientId = uuidv4();
    const clientData = {
      clientId,
      tenantId: req.tenantId || req.body.tenantId, // Auto-assign tenant ID for owners
      businessName,
      email: contactEmail,
      contactPerson,
      phone,
      assistantId,
      plan: plan, // Will use 'free' from default parameter
      notes,
      widgetTitle: widgetTitle || 'Asistente Virtual',
      widgetGreeting: widgetGreeting || '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?',
      // Set pricing based on plan
      pricing: {
        isPaid: plan === 'paid',
        amount: plan === 'paid' ? 200 : 0,
        currency: 'MXN',
        subscriptionStatus: plan === 'paid' ? 'pending' : 'none'
      },
      limits: {
        messagesPerDay: plan === 'paid' ? 1000 : 10,
        messagesPerMonth: plan === 'paid' ? 30000 : 300
      },
      usage: {
        totalMessages: 0,
        totalSessions: 0,
        currentDayMessages: 0,
        currentMonthMessages: 0,
        currentMonthSessions: 0,
        lastDayReset: new Date(),
        lastMonthReset: new Date()
      }
    };
    
    // Owners can only create clients for their tenant
    if (req.tenantId && req.body.tenantId && req.body.tenantId !== req.tenantId) {
      return res.status(403).json({ 
        error: 'No puedes crear clientes para otros tenants' 
      });
    }
    
    let savedClient;
    
    if (isMongoDBAvailable()) {
      // Use MongoDB
      const client = new Client(clientData);
      savedClient = await client.save();
    } else {
      // Use in-memory storage
      clientData.token = uuidv4();
      clientData.createdAt = new Date();
      clientData.isActive = true;
      clientData.totalMessages = 0;
      clientData.totalSessions = 0;
      clientData.currentMonthMessages = 0;
      clientData.currentMonthSessions = 0;
      inMemoryClients[clientId] = clientData;
      savedClient = clientData;
    }
    
    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    // Generate JWT token with client info including tenantId
    const clientToken = jwt.sign(
      { 
        clientId: savedClient.clientId,
        tenantId: savedClient.tenantId, // Critical: include tenant for usage tracking
        assistantId: savedClient.assistantId,
        businessName: savedClient.businessName,
        widgetTitle: savedClient.widgetTitle,
        widgetGreeting: savedClient.widgetGreeting
      },
      process.env.JWT_SECRET
    );
    
    // Update token in database if using MongoDB
    if (isMongoDBAvailable()) {
      savedClient.token = clientToken;
      await savedClient.save();
    } else {
      inMemoryClients[clientId].token = clientToken;
    }
    
    // Generate widget URL based on environment
    const widgetUrl = process.env.WIDGET_URL || 'https://ian-chatbot-backend-h6zr.vercel.app/widget.js';
    
    res.json({
      clientId: savedClient.clientId,
      token: clientToken,
      widgetCode: `<!-- iAN Chatbot Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${widgetUrl}';
    script.setAttribute('data-client-token', '${clientToken}');
    script.setAttribute('data-position', 'bottom-right');
    script.setAttribute('data-title', '${savedClient.widgetTitle}');
    script.setAttribute('data-greeting', '${savedClient.widgetGreeting}');
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ 
      error: 'Error al crear cliente' 
    });
  }
});

// Get all clients (filtered by tenant for owners)
router.get('/clients', validateAdmin, async (req, res) => {
  try {
    let clients;
    let tenantMap = {}; // Map to store tenant info
    
    if (isMongoDBAvailable()) {
      // Use MongoDB
      if (req.tenantId) {
        // Owner: only see their tenant's clients
        clients = await Client.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
        console.log(`📋 Filtering clients for tenant ${req.tenantId}`);
      } else {
        // Admin: see all clients
        clients = await Client.find({}).sort({ createdAt: -1 });
        
        // If super_admin, fetch tenant information
        if (req.admin.role === 'super_admin' && Tenant) {
          // Get unique tenant IDs from clients
          const tenantIds = [...new Set(clients.map(c => c.tenantId).filter(Boolean))];
          
          // Fetch all tenants in one query
          const tenants = await Tenant.find({ tenantId: { $in: tenantIds } });
          
          // Create a map for quick lookup
          tenants.forEach(tenant => {
            tenantMap[tenant.tenantId] = {
              tenantId: tenant.tenantId,
              name: tenant.name,
              slug: tenant.slug,
              email: tenant.email
            };
          });
        }
      }
    } else {
      // Use in-memory storage
      clients = Object.values(inMemoryClients);
      if (req.tenantId) {
        clients = clients.filter(c => c.tenantId === req.tenantId);
      }
    }
    
    const clientList = clients.map(client => {
      const baseClient = {
        id: client.clientId,
        businessName: client.businessName,
        contactEmail: client.email || client.contactEmail,
        contactPerson: client.contactPerson,
        plan: client.plan,
        status: client.isActive ? 'active' : 'inactive',
        currentMonthMessages: client.currentMonthMessages,
        monthlyMessageLimit: client.monthlyMessageLimit,
        totalMessages: client.totalMessages,
        totalSessions: client.totalSessions,
        createdAt: client.createdAt,
        lastActive: client.lastActive,
        notes: client.notes,
        paymentStatus: client.paymentStatus,
        // Include usage and limits for per-chatbot pricing model
        usage: client.usage,
        limits: client.limits,
        pricing: client.pricing
      };
      
      // Add tenant info only for super_admin
      if (req.admin.role === 'super_admin' && client.tenantId && tenantMap[client.tenantId]) {
        baseClient.tenantInfo = tenantMap[client.tenantId];
      }
      
      return baseClient;
    });
    
    // Include user role in response for frontend
    res.json({ 
      clients: clientList,
      userRole: req.admin.role 
    });
  } catch (error) {
    console.error('Error getting clients:', error);
    res.status(500).json({ 
      error: 'Error al obtener clientes' 
    });
  }
});

// Get client details
router.get('/clients/:clientId', validateAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    let client;
    
    if (isMongoDBAvailable()) {
      // Use MongoDB
      client = await Client.findOne({ clientId });
    } else {
      // Use in-memory storage
      client = inMemoryClients[clientId];
    }
    
    if (!client) {
      return res.status(404).json({ 
        error: 'Cliente no encontrado' 
      });
    }
    
    res.json({ 
      client: {
        id: client.clientId,
        businessName: client.businessName,
        contactEmail: client.email || client.contactEmail,
        contactPerson: client.contactPerson,
        phone: client.phone,
        assistantId: client.assistantId,
        plan: client.plan,
        notes: client.notes,
        isActive: client.isActive,
        monthlyMessageLimit: client.monthlyMessageLimit,
        currentMonthMessages: client.currentMonthMessages,
        totalMessages: client.totalMessages,
        totalSessions: client.totalSessions,
        widgetTitle: client.widgetTitle,
        widgetGreeting: client.widgetGreeting,
        createdAt: client.createdAt,
        lastActive: client.lastActive,
        paymentStatus: client.paymentStatus,
        token: client.token
      }
    });
  } catch (error) {
    console.error('Error getting client:', error);
    res.status(500).json({ 
      error: 'Error al obtener cliente' 
    });
  }
});

// Update client
router.put('/clients/:clientId', validateAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    const updates = req.body;
    
    let client;
    
    if (isMongoDBAvailable()) {
      // Use MongoDB
      client = await Client.findOne({ clientId });
      if (!client) {
        return res.status(404).json({ 
          error: 'Cliente no encontrado' 
        });
      }
      
      // Update allowed fields
      const allowedUpdates = [
        'businessName', 
        'email',
        'contactPerson',
        'phone',
        'plan',
        'notes',
        'monthlyMessageLimit', 
        'isActive',
        'paymentStatus',
        'widgetTitle',
        'widgetGreeting'
      ];
      
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          // Handle email field mapping
          if (field === 'email' && updates.contactEmail !== undefined) {
            client[field] = updates.contactEmail;
          } else if (field === 'isActive' && updates.status !== undefined) {
            client[field] = updates.status === 'active';
          } else if (updates[field] !== undefined) {
            client[field] = updates[field];
          }
        }
      });
      
      await client.save();
      
      // If widgetTitle or widgetGreeting changed, regenerate token
      if (updates.widgetTitle !== undefined || updates.widgetGreeting !== undefined) {
        if (!process.env.JWT_SECRET) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        const newToken = jwt.sign(
          { 
            clientId: client.clientId,
            tenantId: client.tenantId, // Critical: include tenant for usage tracking
            assistantId: client.assistantId,
            businessName: client.businessName,
            widgetTitle: client.widgetTitle,
            widgetGreeting: client.widgetGreeting
          },
          process.env.JWT_SECRET
        );
        client.token = newToken;
        await client.save();
      }
    } else {
      // Use in-memory storage
      client = inMemoryClients[clientId];
      if (!client) {
        return res.status(404).json({ 
          error: 'Cliente no encontrado' 
        });
      }
      
      // Update allowed fields
      const allowedUpdates = [
        'businessName', 
        'contactEmail', 
        'contactPerson',
        'phone',
        'plan',
        'notes',
        'monthlyMessageLimit', 
        'status',
        'paymentStatus',
        'widgetTitle',
        'widgetGreeting'
      ];
      
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          client[field] = updates[field];
        }
      });
      
      // If widgetTitle or widgetGreeting changed, regenerate token
      if (updates.widgetTitle !== undefined || updates.widgetGreeting !== undefined) {
        if (!process.env.JWT_SECRET) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        const newToken = jwt.sign(
          { 
            clientId: client.clientId,
            tenantId: client.tenantId, // Critical: include tenant for usage tracking
            assistantId: client.assistantId,
            businessName: client.businessName,
            widgetTitle: client.widgetTitle,
            widgetGreeting: client.widgetGreeting
          },
          process.env.JWT_SECRET
        );
        client.token = newToken;
      }
    }
    
    res.json({ 
      message: 'Cliente actualizado',
      client: {
        id: client.clientId,
        businessName: client.businessName,
        isActive: client.isActive || (client.status === 'active')
      }
    });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ 
      error: 'Error al actualizar cliente' 
    });
  }
});

// Delete client
router.delete('/clients/:clientId', validateAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (isMongoDBAvailable()) {
      // Use MongoDB
      const result = await Client.deleteOne({ clientId });
      if (result.deletedCount === 0) {
        return res.status(404).json({ 
          error: 'Cliente no encontrado' 
        });
      }
    } else {
      // Use in-memory storage
      if (!inMemoryClients[clientId]) {
        return res.status(404).json({ 
          error: 'Cliente no encontrado' 
        });
      }
      delete inMemoryClients[clientId];
    }
    
    res.json({ 
      message: 'Cliente eliminado exitosamente' 
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ 
      error: 'Error al eliminar cliente' 
    });
  }
});

// Regenerate client token
router.post('/clients/:clientId/regenerate-token', validateAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    let client;
    
    if (isMongoDBAvailable()) {
      // Use MongoDB
      client = await Client.findOne({ clientId });
      if (!client) {
        return res.status(404).json({ 
          error: 'Cliente no encontrado' 
        });
      }
      
      const newToken = await client.regenerateToken();
      
      // Update JWT with latest client info
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required');
      }
      const jwtToken = jwt.sign(
        { 
          clientId: client.clientId,
          tenantId: client.tenantId, // Critical: include tenant for usage tracking
          assistantId: client.assistantId,
          businessName: client.businessName,
          widgetTitle: client.widgetTitle,
          widgetGreeting: client.widgetGreeting
        },
        process.env.JWT_SECRET
      );
      
      client.token = jwtToken;
      await client.save();
      
      res.json({
        message: 'Token regenerado exitosamente',
        token: jwtToken
      });
    } else {
      // Use in-memory storage
      client = inMemoryClients[clientId];
      if (!client) {
        return res.status(404).json({ 
          error: 'Cliente no encontrado' 
        });
      }
      
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required');
      }
      const newToken = jwt.sign(
        { 
          clientId: client.clientId,
          tenantId: client.tenantId, // Critical: include tenant for usage tracking
          assistantId: client.assistantId,
          businessName: client.businessName,
          widgetTitle: client.widgetTitle,
          widgetGreeting: client.widgetGreeting
        },
        process.env.JWT_SECRET
      );
      
      client.token = newToken;
      
      res.json({
        message: 'Token regenerado exitosamente',
        token: newToken
      });
    }
  } catch (error) {
    console.error('Error regenerating token:', error);
    res.status(500).json({ 
      error: 'Error al regenerar token' 
    });
  }
});

// Get admin profile
router.get('/admin/profile', validateAdmin, async (req, res) => {
  try {
    // Check if it's an AdminUser
    if (req.admin.type === 'admin' && AdminUser) {
      const adminUser = await AdminUser.findOne({ adminId: req.admin.id });
      if (!adminUser) {
        return res.status(404).json({ error: 'Admin no encontrado' });
      }
      
      return res.json({
        profile: {
          adminId: adminUser.adminId,
          username: adminUser.username,
          email: adminUser.email,
          role: adminUser.role,
          lastLogin: adminUser.lastLogin,
          createdAt: adminUser.createdAt,
          type: 'admin'
        }
      });
    }
    
    // For tenant users
    if (req.admin.type === 'tenant' && User && Tenant) {
      const user = await User.findOne({ userId: req.admin.id });
      const tenant = await Tenant.findOne({ tenantId: req.admin.tenantId });
      
      if (!user || !tenant) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      return res.json({
        profile: {
          userId: user.userId,
          username: user.email,
          email: user.email,
          name: user.name,
          role: user.role,
          tenant: tenant.name,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          type: 'tenant'
        }
      });
    }
    
    res.status(400).json({ error: 'Tipo de usuario no válido' });
  } catch (error) {
    console.error('Error getting admin profile:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// Update admin profile
router.put('/admin/profile', validateAdmin, async (req, res) => {
  try {
    const { email, username } = req.body;
    
    // Only AdminUsers can update their profile
    if (req.admin.type !== 'admin' || !AdminUser) {
      return res.status(403).json({ 
        error: 'Solo los administradores pueden actualizar su perfil aquí' 
      });
    }
    
    const adminUser = await AdminUser.findOne({ adminId: req.admin.id });
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin no encontrado' });
    }
    
    // Check if email or username already exists
    if (email && email !== adminUser.email) {
      const existingEmail = await AdminUser.findOne({ 
        email: email.toLowerCase(), 
        adminId: { $ne: adminUser.adminId } 
      });
      if (existingEmail) {
        return res.status(409).json({ error: 'Este email ya está en uso' });
      }
      adminUser.email = email.toLowerCase();
    }
    
    if (username && username !== adminUser.username) {
      const existingUsername = await AdminUser.findOne({ 
        username: username.toLowerCase(), 
        adminId: { $ne: adminUser.adminId } 
      });
      if (existingUsername) {
        return res.status(409).json({ error: 'Este nombre de usuario ya está en uso' });
      }
      adminUser.username = username.toLowerCase();
    }
    
    await adminUser.save();
    
    res.json({
      message: 'Perfil actualizado exitosamente',
      profile: {
        adminId: adminUser.adminId,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// Change admin password
router.post('/admin/change-password', validateAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Contraseña actual y nueva son requeridas' 
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'La nueva contraseña debe tener al menos 8 caracteres' 
      });
    }
    
    // Only AdminUsers can change password here
    if (req.admin.type !== 'admin' || !AdminUser) {
      return res.status(403).json({ 
        error: 'Solo los administradores pueden cambiar su contraseña aquí' 
      });
    }
    
    const adminUser = await AdminUser.findOne({ adminId: req.admin.id });
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin no encontrado' });
    }
    
    // Verify current password
    const isMatch = await adminUser.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    
    // Update password (will be hashed by pre-save hook)
    adminUser.password = newPassword;
    await adminUser.save();
    
    // Record password change in login history
    await adminUser.recordLogin(req.ip, 'Password Changed', true);
    
    res.json({
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error changing admin password:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});


// List all admin users (super_admin only)
router.get('/admin/users', validateAdmin, async (req, res) => {
  try {
    // Only super_admin can list all admins
    if (req.admin.type !== 'admin' || req.admin.role !== 'super_admin' || !AdminUser) {
      return res.status(403).json({ 
        error: 'Solo super administradores pueden ver la lista de administradores' 
      });
    }
    
    const admins = await AdminUser.find({}, {
      password: 0,
      passwordResetToken: 0,
      passwordResetExpires: 0
    }).sort({ createdAt: -1 });
    
    res.json({
      admins: admins.map(admin => ({
        adminId: admin.adminId,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt
      }))
    });
  } catch (error) {
    console.error('Error listing admin users:', error);
    res.status(500).json({ error: 'Error al obtener lista de administradores' });
  }
});

module.exports = router;