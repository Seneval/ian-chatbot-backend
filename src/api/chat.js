const express = require('express');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-demo-key-for-development'
});

// Import MongoDB models
let Session, Message, Client;
try {
  Session = require('../models/Session');
  Message = require('../models/Message');
  Client = require('../models/Client');
} catch (error) {
  console.log('⚠️  MongoDB models not available, using in-memory storage');
}

// Fallback in-memory storage if MongoDB is not available
const inMemorySessions = {};
const inMemoryMessages = {};

// Check if MongoDB is available
const isMongoDBAvailable = () => {
  return Session && Message && Client && process.env.MONGODB_URI;
};

// Create or get session
router.post('/session', async (req, res) => {
  try {
    const { clientId, tenantId, assistantId } = req.client;
    const sessionId = uuidv4();
    
    console.log('Creating session for client:', { clientId, tenantId, assistantId });
    
    // Create OpenAI thread for this session
    const thread = await openai.beta.threads.create();
    
    let savedSession;
    
    if (isMongoDBAvailable()) {
      // Use MongoDB
      const session = new Session({
        sessionId,
        clientId,
        tenantId, // Critical: track session to tenant
        threadId: thread.id,
        metadata: {
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          referrer: req.headers['referer']
        }
      });
      savedSession = await session.save();
      
      // Update client statistics
      const client = await Client.findOne({ clientId });
      if (client) {
        await client.incrementSessionCount();
      }
    } else {
      // Use in-memory storage
      const sessionData = {
        sessionId,
        clientId,
        assistantId,
        threadId: thread.id,
        createdAt: new Date(),
        messageCount: 0,
        isActive: true
      };
      inMemorySessions[sessionId] = sessionData;
      savedSession = sessionData;
    }
    
    console.log('Session created:', { sessionId, threadId: thread.id });
    
    res.json({
      sessionId: savedSession.sessionId,
      threadId: thread.id
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ 
      error: 'Error al crear sesión' 
    });
  }
});

// Send message to assistant
router.post('/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    const { clientId, tenantId } = req.client;
    
    if (!sessionId || !message) {
      return res.status(400).json({ 
        error: 'sessionId y message son requeridos' 
      });
    }
    
    let session;
    let assistantId;
    
    if (isMongoDBAvailable()) {
      // Use MongoDB
      session = await Session.findOne({ sessionId, clientId });
      if (!session) {
        return res.status(404).json({ 
          error: 'Sesión no encontrada' 
        });
      }
      
      // Get assistantId from client
      const client = await Client.findOne({ clientId });
      if (!client) {
        return res.status(404).json({ 
          error: 'Cliente no encontrado' 
        });
      }
      assistantId = client.assistantId;
    } else {
      // Use in-memory storage
      session = inMemorySessions[sessionId];
      if (!session || session.clientId !== clientId) {
        return res.status(404).json({ 
          error: 'Sesión no encontrada' 
        });
      }
      assistantId = session.assistantId;
    }
    
    if (!session.threadId) {
      return res.status(400).json({ 
        error: 'Thread ID no encontrado en la sesión' 
      });
    }
    
    if (!assistantId) {
      return res.status(400).json({ 
        error: 'Assistant ID no encontrado para esta sesión' 
      });
    }
    
    console.log('Processing message with:', { sessionId, threadId: session.threadId, assistantId, clientId });
    
    // Save user message
    if (isMongoDBAvailable()) {
      const userMessage = new Message({
        sessionId,
        clientId,
        tenantId, // Critical: track message to tenant
        role: 'user',
        content: message
      });
      await userMessage.save();
    } else {
      const messageId = uuidv4();
      inMemoryMessages[messageId] = {
        messageId,
        sessionId,
        clientId,
        role: 'user',
        content: message,
        timestamp: new Date()
      };
    }
    
    // Add message to thread
    console.log('Adding message to thread:', session.threadId);
    await openai.beta.threads.messages.create(session.threadId, {
      role: 'user',
      content: message
    });
    console.log('Message added successfully');
    
    // Run the assistant
    console.log('Creating run for thread:', session.threadId, 'with assistant:', assistantId);
    const run = await openai.beta.threads.runs.create(session.threadId, {
      assistant_id: assistantId
    });
    
    if (!run || !run.id) {
      console.error('Run creation failed - no run ID returned:', run);
      throw new Error('Failed to create run - no run ID returned');
    }
    console.log('Run created successfully:', run.id);
    
    // Poll for completion with correct API format
    let runStatus = run;
    const maxPolls = 30;
    let pollCount = 0;
    
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Polling run status (attempt ${pollCount + 1}/${maxPolls})...`);
      
      // CRITICAL: Use the correct format with thread_id in params
      runStatus = await openai.beta.threads.runs.retrieve(run.id, { 
        thread_id: session.threadId 
      });
      
      console.log('Run status:', runStatus.status);
      pollCount++;
    }
    
    if (runStatus.status === 'failed') {
      console.error('Run failed:', runStatus);
      throw new Error('El asistente no pudo procesar la solicitud');
    }
    
    if (pollCount >= maxPolls) {
      throw new Error('Timeout esperando respuesta del asistente');
    }
    
    // Get messages
    console.log('Retrieving messages from thread:', session.threadId);
    const messages = await openai.beta.threads.messages.list(session.threadId);
    
    // Find the assistant's response
    const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
    
    if (!assistantMessage) {
      throw new Error('No se encontró respuesta del asistente');
    }
    
    const responseContent = assistantMessage.content[0].text.value;
    
    // Save assistant message and update statistics
    if (isMongoDBAvailable()) {
      const assistantMsg = new Message({
        sessionId,
        clientId,
        tenantId, // Critical: track message to tenant
        messageId: assistantMessage.id,
        role: 'assistant',
        content: responseContent
      });
      await assistantMsg.save();
      
      // Update session
      await session.incrementMessageCount();
      
      // Update client statistics
      const client = await Client.findOne({ clientId });
      if (client) {
        await client.incrementMessageCount();
      }
    } else {
      const messageId = uuidv4();
      inMemoryMessages[messageId] = {
        messageId: assistantMessage.id,
        sessionId,
        clientId,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date()
      };
      
      // Update session in memory
      if (inMemorySessions[sessionId]) {
        inMemorySessions[sessionId].messageCount = (inMemorySessions[sessionId].messageCount || 0) + 2;
        inMemorySessions[sessionId].lastMessageAt = new Date();
      }
    }
    
    console.log('Assistant response received and saved');
    
    res.json({
      message: responseContent,
      sessionId,
      messageId: assistantMessage.id
    });
  } catch (error) {
    console.error('Error processing message:', error);
    
    // Save error message if using MongoDB
    if (isMongoDBAvailable() && req.body.sessionId) {
      try {
        const errorMessage = new Message({
          sessionId: req.body.sessionId,
          clientId: req.client.clientId,
          tenantId: req.client.tenantId, // Critical: track message to tenant
          role: 'system',
          content: `Error: ${error.message}`,
          metadata: {
            errorMessage: error.message
          }
        });
        await errorMessage.save();
      } catch (saveError) {
        console.error('Error saving error message:', saveError);
      }
    }
    
    res.status(500).json({ 
      error: error.message || 'Error al procesar mensaje',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get session history
router.get('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { clientId } = req.client;
    const { limit = 50, offset = 0 } = req.query;
    
    let messages;
    
    if (isMongoDBAvailable()) {
      // Verify session belongs to client
      const session = await Session.findOne({ sessionId, clientId });
      if (!session) {
        return res.status(404).json({ 
          error: 'Sesión no encontrada' 
        });
      }
      
      // Get messages
      messages = await Message.findBySession(sessionId, {
        limit: parseInt(limit),
        order: 'asc'
      });
    } else {
      // Use in-memory storage
      const session = inMemorySessions[sessionId];
      if (!session || session.clientId !== clientId) {
        return res.status(404).json({ 
          error: 'Sesión no encontrada' 
        });
      }
      
      messages = Object.values(inMemoryMessages)
        .filter(msg => msg.sessionId === sessionId)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    }
    
    res.json({
      sessionId,
      messages: messages.map(msg => ({
        messageId: msg.messageId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || msg.createdAt
      })),
      total: messages.length
    });
  } catch (error) {
    console.error('Error getting session history:', error);
    res.status(500).json({ 
      error: 'Error al obtener historial' 
    });
  }
});

// Get client sessions
router.get('/sessions', async (req, res) => {
  try {
    const { clientId } = req.client;
    const { limit = 20, offset = 0, active } = req.query;
    
    let sessions;
    
    if (isMongoDBAvailable()) {
      const options = {};
      if (active !== undefined) {
        options.active = active === 'true';
      }
      
      sessions = await Session.findByClient(clientId, options);
      sessions = sessions
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    } else {
      // Use in-memory storage
      sessions = Object.values(inMemorySessions)
        .filter(s => {
          if (s.clientId !== clientId) return false;
          if (active !== undefined) {
            return s.isActive === (active === 'true');
          }
          return true;
        })
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    }
    
    res.json({
      sessions: sessions.map(session => ({
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        lastMessageAt: session.lastMessageAt,
        messageCount: session.messageCount,
        isActive: session.isActive
      })),
      total: sessions.length
    });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ 
      error: 'Error al obtener sesiones' 
    });
  }
});

// End session
router.post('/sessions/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { clientId } = req.client;
    
    if (isMongoDBAvailable()) {
      const session = await Session.findOne({ sessionId, clientId });
      if (!session) {
        return res.status(404).json({ 
          error: 'Sesión no encontrada' 
        });
      }
      
      await session.endSession();
    } else {
      // Use in-memory storage
      const session = inMemorySessions[sessionId];
      if (!session || session.clientId !== clientId) {
        return res.status(404).json({ 
          error: 'Sesión no encontrada' 
        });
      }
      
      session.isActive = false;
    }
    
    res.json({
      message: 'Sesión finalizada exitosamente'
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ 
      error: 'Error al finalizar sesión' 
    });
  }
});

module.exports = router;