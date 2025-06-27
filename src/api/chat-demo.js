const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage
const sessions = {};
const messageHistory = {};

// Demo responses for testing without OpenAI
const demoResponses = [
  "¡Hola! Soy tu asistente de marketing. ¿En qué puedo ayudarte hoy?",
  "Puedo ayudarte con estrategias de marketing digital, redes sociales, y más.",
  "¿Has considerado usar Instagram Ads para llegar a tu audiencia objetivo?",
  "El marketing de contenidos es clave para construir autoridad en tu nicho.",
  "¿Cuál es tu principal objetivo de marketing en este momento?",
  "Te puedo ayudar a crear un plan de marketing personalizado para tu negocio."
];

// Create demo session
router.post('/session', async (req, res) => {
  try {
    const { clientId } = req.client;
    const sessionId = uuidv4();
    
    sessions[sessionId] = {
      clientId,
      createdAt: new Date(),
      messageCount: 0
    };
    
    res.json({
      sessionId,
      mode: 'demo'
    });
  } catch (error) {
    console.error('Error creating demo session:', error);
    res.status(500).json({ 
      error: 'Error al crear sesión demo' 
    });
  }
});

// Send message to demo assistant
router.post('/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    const { clientId } = req.client;
    
    if (!sessionId || !message) {
      return res.status(400).json({ 
        error: 'sessionId y message son requeridos' 
      });
    }
    
    const session = sessions[sessionId];
    if (!session || session.clientId !== clientId) {
      return res.status(404).json({ 
        error: 'Sesión no encontrada' 
      });
    }
    
    // Simulate thinking delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // Get a demo response
    const responseIndex = session.messageCount % demoResponses.length;
    const assistantMessage = demoResponses[responseIndex];
    session.messageCount++;
    
    // Store message history
    if (!messageHistory[clientId]) {
      messageHistory[clientId] = [];
    }
    
    messageHistory[clientId].push({
      sessionId,
      userMessage: message,
      assistantMessage,
      timestamp: new Date()
    });
    
    res.json({
      message: assistantMessage,
      messageId: uuidv4()
    });
  } catch (error) {
    console.error('Error processing demo message:', error);
    res.status(500).json({ 
      error: 'Error al procesar mensaje' 
    });
  }
});

// Get chat history
router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { clientId } = req.client;
    
    const session = sessions[sessionId];
    if (!session || session.clientId !== clientId) {
      return res.status(404).json({ 
        error: 'Sesión no encontrada' 
      });
    }
    
    const history = messageHistory[clientId]?.filter(m => m.sessionId === sessionId) || [];
    
    res.json({
      messages: history.flatMap(h => [
        {
          role: 'user',
          content: h.userMessage,
          timestamp: h.timestamp
        },
        {
          role: 'assistant',
          content: h.assistantMessage,
          timestamp: h.timestamp
        }
      ])
    });
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ 
      error: 'Error al obtener historial' 
    });
  }
});

module.exports = router;