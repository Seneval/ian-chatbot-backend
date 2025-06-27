require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const chatRoutes = require('./api/chat');
const chatDemoRoutes = require('./api/chat-demo');
const analyticsRoutes = require('./api/analytics');
const authRoutes = require('./api/auth');
const testRoutes = require('./api/test');

// Import middleware
const { validateClient } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://ianwebsite.vercel.app',
      'https://ianwebsite-git-dev-patricios-projects-fbd72f4d.vercel.app',
      'https://ian-chatbot-backend.vercel.app',
      'https://ianchatbotbackend.vercel.app',
      'https://ian-chatbot-backend-h6zr.vercel.app',
      /^https:\/\/.*\.vercel\.app$/  // Allow all Vercel preview deployments
    ];
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    });
    
    callback(null, isAllowed);
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  message: 'Demasiadas solicitudes, intenta de nuevo más tarde.'
});

app.use('/api/', limiter);

// Serve widget.js
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, '../public/widget.js'));
});

// Root endpoint - API info
app.get('/', (req, res) => {
  res.json({
    name: 'iAN Chatbot API',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      chat: '/api/chat/*',
      analytics: '/api/analytics/*'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'iAN Chatbot API'
  });
});

// Routes
app.use('/api/test', testRoutes); // NO authentication required for testing
app.use('/api/chat', validateClient, chatRoutes);
app.use('/api/chat-demo', validateClient, chatDemoRoutes);
app.use('/api/analytics', validateClient, analyticsRoutes);
app.use('/api/auth', authRoutes);


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Algo salió mal', 
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Servidor iAN Chatbot corriendo en puerto ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;