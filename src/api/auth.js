const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { validateAdmin } = require('../middleware/auth');
const router = express.Router();

// Import MongoDB models
let Client, User, Tenant;
try {
  Client = require('../models/Client');
  User = require('../models/User');
  Tenant = require('../models/Tenant');
} catch (error) {
  console.log('⚠️  MongoDB models not available, using in-memory storage');
}

// Fallback in-memory storage if MongoDB is not available
const inMemoryClients = {};

// Admin users (still in-memory for simplicity)
const admins = {
  'admin': {
    id: 'admin-001',
    username: 'admin',
    // Password: admin123
    password: '$2a$10$YourHashedPasswordHere',
    role: 'admin'
  }
};

// Check if MongoDB is available
const isMongoDBAvailable = () => {
  return Client && process.env.MONGODB_URI;
};

// Admin login (supports both legacy admin and tenant users)
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    console.log('🔐 Login attempt:', { username, email, hasPassword: !!password });
    
    // Try tenant user login first (email-based)
    if (User && Tenant && (email || username.includes('@'))) {
      const loginEmail = email || username;
      console.log('👤 Attempting tenant user login for:', loginEmail);
      
      try {
        const user = await User.findByEmail(loginEmail);
        if (user && await user.comparePassword(password)) {
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
              process.env.ADMIN_JWT_SECRET || 'admin-secret-change-this',
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
    
    // Fall back to legacy admin login
    console.log('🔧 Attempting legacy admin login for:', username);
    const admin = admins[username];
    if (!admin) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas. Use su email y contraseña de registro.' 
      });
    }
    
    // For demo purposes, accept 'admin123' as password
    if (password !== 'admin123') {
      return res.status(401).json({ 
        error: 'Credenciales inválidas. Use su email y contraseña de registro.' 
      });
    }
    
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username, 
        role: admin.role,
        type: 'legacy'
      },
      process.env.ADMIN_JWT_SECRET || 'admin-secret-change-this',
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      }
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
      plan = 'basic',
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
    
    const clientId = uuidv4();
    const clientData = {
      clientId,
      tenantId: req.tenantId || req.body.tenantId, // Auto-assign tenant ID for owners
      businessName,
      email: contactEmail,
      contactPerson,
      phone,
      assistantId,
      plan: plan || 'free', // Default to free plan
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
      process.env.JWT_SECRET || 'default-secret-change-this'
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
    
    if (isMongoDBAvailable()) {
      // Use MongoDB
      if (req.tenantId) {
        // Owner: only see their tenant's clients
        clients = await Client.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
        console.log(`📋 Filtering clients for tenant ${req.tenantId}`);
      } else {
        // Admin: see all clients
        clients = await Client.find({}).sort({ createdAt: -1 });
      }
    } else {
      // Use in-memory storage
      clients = Object.values(inMemoryClients);
      if (req.tenantId) {
        clients = clients.filter(c => c.tenantId === req.tenantId);
      }
    }
    
    const clientList = clients.map(client => ({
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
      paymentStatus: client.paymentStatus
    }));
    
    res.json({ clients: clientList });
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
        const newToken = jwt.sign(
          { 
            clientId: client.clientId,
            tenantId: client.tenantId, // Critical: include tenant for usage tracking
            assistantId: client.assistantId,
            businessName: client.businessName,
            widgetTitle: client.widgetTitle,
            widgetGreeting: client.widgetGreeting
          },
          process.env.JWT_SECRET || 'default-secret-change-this'
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
        const newToken = jwt.sign(
          { 
            clientId: client.clientId,
            tenantId: client.tenantId, // Critical: include tenant for usage tracking
            assistantId: client.assistantId,
            businessName: client.businessName,
            widgetTitle: client.widgetTitle,
            widgetGreeting: client.widgetGreeting
          },
          process.env.JWT_SECRET || 'default-secret-change-this'
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
      const jwtToken = jwt.sign(
        { 
          clientId: client.clientId,
          tenantId: client.tenantId, // Critical: include tenant for usage tracking
          assistantId: client.assistantId,
          businessName: client.businessName,
          widgetTitle: client.widgetTitle,
          widgetGreeting: client.widgetGreeting
        },
        process.env.JWT_SECRET || 'default-secret-change-this'
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
      
      const newToken = jwt.sign(
        { 
          clientId: client.clientId,
          tenantId: client.tenantId, // Critical: include tenant for usage tracking
          assistantId: client.assistantId,
          businessName: client.businessName,
          widgetTitle: client.widgetTitle,
          widgetGreeting: client.widgetGreeting
        },
        process.env.JWT_SECRET || 'default-secret-change-this'
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

module.exports = router;