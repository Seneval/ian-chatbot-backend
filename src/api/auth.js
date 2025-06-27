const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { validateAdmin } = require('../middleware/auth');
const router = express.Router();

// Temporary in-memory storage (will be replaced with MongoDB)
const clients = {};
const admins = {
  'admin': {
    id: 'admin-001',
    username: 'admin',
    // Password: admin123
    password: '$2a$10$YourHashedPasswordHere',
    role: 'admin'
  }
};

// Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const admin = admins[username];
    if (!admin) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }
    
    // For demo purposes, accept 'admin123' as password
    if (password !== 'admin123') {
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }
    
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username, 
        role: admin.role 
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
      allowedDomains = [],
      monthlyMessageLimit = 1000
    } = req.body;
    
    if (!businessName || !contactEmail || !assistantId) {
      return res.status(400).json({ 
        error: 'businessName, contactEmail y assistantId son requeridos' 
      });
    }
    
    const clientId = uuidv4();
    const clientToken = jwt.sign(
      { 
        clientId, 
        assistantId,
        businessName 
      },
      process.env.JWT_SECRET || 'default-secret-change-this'
    );
    
    clients[clientId] = {
      id: clientId,
      businessName,
      contactEmail,
      assistantId,
      allowedDomains,
      monthlyMessageLimit,
      currentMonthMessages: 0,
      createdAt: new Date(),
      status: 'active',
      token: clientToken
    };
    
    res.json({
      clientId,
      token: clientToken,
      widgetCode: `<!-- iAN Chatbot Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://chat.inteligenciaartificialparanegocios.com/widget.js';
    script.setAttribute('data-client-token', '${clientToken}');
    script.setAttribute('data-position', 'bottom-right');
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

// Get all clients
router.get('/clients', validateAdmin, async (req, res) => {
  try {
    const clientList = Object.values(clients).map(client => ({
      id: client.id,
      businessName: client.businessName,
      contactEmail: client.contactEmail,
      status: client.status,
      currentMonthMessages: client.currentMonthMessages,
      monthlyMessageLimit: client.monthlyMessageLimit,
      createdAt: client.createdAt
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
router.get('/client/:clientId', validateAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = clients[clientId];
    
    if (!client) {
      return res.status(404).json({ 
        error: 'Cliente no encontrado' 
      });
    }
    
    res.json({ client });
  } catch (error) {
    console.error('Error getting client:', error);
    res.status(500).json({ 
      error: 'Error al obtener cliente' 
    });
  }
});

// Update client
router.put('/client/:clientId', validateAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    const updates = req.body;
    
    if (!clients[clientId]) {
      return res.status(404).json({ 
        error: 'Cliente no encontrado' 
      });
    }
    
    // Update allowed fields only
    const allowedUpdates = [
      'businessName', 
      'contactEmail', 
      'allowedDomains', 
      'monthlyMessageLimit', 
      'status'
    ];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        clients[clientId][field] = updates[field];
      }
    });
    
    res.json({ 
      message: 'Cliente actualizado',
      client: clients[clientId]
    });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ 
      error: 'Error al actualizar cliente' 
    });
  }
});

// Regenerate client token
router.post('/client/:clientId/regenerate-token', validateAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = clients[clientId];
    
    if (!client) {
      return res.status(404).json({ 
        error: 'Cliente no encontrado' 
      });
    }
    
    const newToken = jwt.sign(
      { 
        clientId, 
        assistantId: client.assistantId,
        businessName: client.businessName 
      },
      process.env.JWT_SECRET || 'default-secret-change-this'
    );
    
    client.token = newToken;
    
    res.json({
      message: 'Token regenerado exitosamente',
      token: newToken
    });
  } catch (error) {
    console.error('Error regenerating token:', error);
    res.status(500).json({ 
      error: 'Error al regenerar token' 
    });
  }
});

module.exports = router;