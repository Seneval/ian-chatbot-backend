// Load environment variables FIRST
require('dotenv').config();

// Initialize Sentry AFTER environment variables are loaded
require('./instrument');
const Sentry = require('@sentry/node');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import database connection
const { connectDB } = require('./config/database');

// Import routes
const chatRoutes = require('./api/chat');
const chatDemoRoutes = require('./api/chat-demo');
const analyticsRoutes = require('./api/analytics');
const authRoutes = require('./api/auth');
const tenantAuthRoutes = require('./api/tenant-auth');
const tenantRegisterRoutes = require('./api/tenant-register');
const testRoutes = require('./api/test');
const testSentryRoutes = require('./api/test-sentry');

// Import middleware
const { validateClient } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Vercel deployment (secure configuration)
if (process.env.VERCEL) {
  // Trust Vercel's proxy in production
  app.set('trust proxy', 1);
} else {
  // Don't trust proxy in development for security
  app.set('trust proxy', false);
}

// Debug middleware for CORS
app.use((req, res, next) => {
  console.log(`CORS Request: ${req.method} ${req.path} from ${req.headers.origin}`);
  next();
});

// Connect to MongoDB
const initializeDatabase = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
    } else {
      console.log('⚠️  MONGODB_URI not found, using in-memory storage');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.log('⚠️  Falling back to in-memory storage');
  }
};

// Initialize database connection
initializeDatabase();

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allowed origins - combine hardcoded and environment variable origins
    const hardcodedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://ianwebsite.vercel.app',
      'https://ianwebsite-git-dev-patricios-projects-fbd72f4d.vercel.app',
      'https://ian-chatbot-backend.vercel.app',
      'https://ianchatbotbackend.vercel.app',
      'https://ian-chatbot-backend-h6zr.vercel.app',
      'https://seneval.github.io',  // GitHub Pages domain for testing
      'https://inteligenciaartificialparanegocios.com',
      'https://www.inteligenciaartificialparanegocios.com',
      'https://admin.inteligenciaartificialparanegocios.com',  // Admin subdomain
      /^https:\/\/.*\.vercel\.app$/  // Allow all Vercel preview deployments
    ];
    
    // Parse additional origins from environment variable
    const envOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : [];
    
    const allowedOrigins = [...hardcodedOrigins, ...envOrigins];
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));

// Enhanced JSON parsing with better error handling
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // Store raw body for debugging
    req.rawBody = buf;
  }
}));

// Body parser error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Body parser error:', err.message);
    console.error('Raw body:', req.rawBody?.toString());
    
    Sentry.captureException(err, {
      extra: {
        rawBody: req.rawBody?.toString(),
        contentType: req.headers['content-type'],
        endpoint: req.path,
        method: req.method
      }
    });
    
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON format in request body',
      details: 'Please check for special characters that need escaping',
      position: err.message.match(/position (\d+)/)?.[1] || 'unknown'
    });
  }
  next(err);
});

// Handle preflight requests
app.options('*', cors(corsOptions));

// No need for request handler middleware in serverless - handled by wrapper

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  message: 'Demasiadas solicitudes, intenta de nuevo más tarde.'
});

app.use('/api/', limiter);

// Handle admin subdomain
app.use((req, res, next) => {
  const host = req.get('host');
  
  // If accessing via admin.inteligenciaartificialparanegocios.com
  if (host && host.startsWith('admin.')) {
    // Redirect root to /admin
    if (req.path === '/') {
      return res.redirect('/admin');
    }
    
    // For /agencias, serve from /admin/agencias
    if (req.path === '/agencias' || req.path === '/agencias/') {
      return res.redirect('/admin/agencias/');
    }
  }
  
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// Serve admin static files
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Serve homepage static files
app.use('/homepage', express.static(path.join(__dirname, '../public/homepage')));

// Serve marketing homepage at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/homepage/index.html'));
});

// Serve registration page
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/register.html'));
});

// Alternative path for registration  
app.get('/admin/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/register.html'));
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'iAN Chatbot Backend API',
    version: '2.0',
    status: 'operational',
    endpoints: {
      health: '/api/health',
      admin: '/admin',
      docs: 'https://github.com/Seneval/ian-chatbot-backend'
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
app.use('/api/test-sentry', testSentryRoutes); // Sentry test routes
app.use('/api/register', tenantRegisterRoutes); // Tenant registration (no auth required)
app.use('/api/tenant', tenantAuthRoutes); // Multi-tenant authentication
app.use('/api/chat', validateClient, chatRoutes);
app.use('/api/chat-demo', validateClient, chatDemoRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/auth', authRoutes); // Legacy admin auth

// Widget serving
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, '../public/widget.js'));
});

// Test page for widget
app.get('/test-chat', (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).send('<h1>Error: Token requerido</h1><p>Por favor proporciona un token válido.</p>');
  }
  
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Chat - iAN Chatbot</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            background: #f5f5f5;
            margin: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        h1 { 
            color: #111827; 
            margin-bottom: 10px;
        }
        p { 
            color: #6b7280; 
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .token-info {
            background: #f3f4f6;
            padding: 16px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 14px;
            word-break: break-all;
            color: #374151;
        }
        .status {
            margin-top: 20px;
            padding: 16px;
            background: #d1fae5;
            color: #065f46;
            border-radius: 8px;
            border: 1px solid #6ee7b7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Página de Prueba - iAN Chatbot</h1>
        <p>Este es un sitio de ejemplo. El chatbot aparecerá en la esquina inferior derecha.</p>
        <p>Puedes interactuar con el chat para probar su funcionamiento.</p>
        
        <div class="token-info">
            <strong>Token activo:</strong><br>
            ${token.substring(0, 50)}...
        </div>
        
        <div class="status">
            ✅ Widget cargándose... Si no aparece en 5 segundos, verifica la consola del navegador.
        </div>
    </div>
    
    <!-- iAN Chatbot Widget -->
    <script>
        window.CHATBOT_API_URL = 'http://localhost:3000/api';
        window.CHATBOT_DEMO_MODE = false;
        
        (function() {
            var script = document.createElement('script');
            script.src = '/widget.js';
            script.setAttribute('data-client-token', '${token}');
            script.setAttribute('data-position', 'bottom-right');
            script.async = true;
            script.onload = function() {
                console.log('✅ Widget cargado exitosamente');
            };
            script.onerror = function() {
                console.error('❌ Error al cargar el widget');
            };
            document.head.appendChild(script);
        })();
    </script>
</body>
</html>`;
  
  res.send(html);
});

// Sentry error handler - MUST be before any other error middleware
Sentry.setupExpressErrorHandler(app);

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

// Start server (only in non-serverless environments)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor iAN Chatbot corriendo en puerto ${PORT}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Export app for serverless
module.exports = app;