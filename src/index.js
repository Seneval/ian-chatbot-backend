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

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// Serve admin static files
app.use('/admin', express.static(path.join(__dirname, '../../admin')));

// Serve demo.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'demo.html'));
});

// Serve test-assistant.html
app.get('/test-assistant', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'test-assistant.html'));
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

// Widget serving
app.get('/widget.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../../widget/build/widget.js'));
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