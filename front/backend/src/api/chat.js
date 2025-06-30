const express = require('express');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Initialize OpenAI client with Claude's integrated access
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-demo-key-for-development'
});

// In-memory storage for now (replace with MongoDB in production)
const sessions = {};
const messageHistory = {};

// Create or get session
router.post('/session', async (req, res) => {
  try {
    const { clientId, assistantId } = req.client;
    const sessionId = uuidv4();
    
    console.log('Creating session for client:', { clientId, assistantId });
    
    sessions[sessionId] = {
      clientId,
      assistantId,
      threadId: null,
      createdAt: new Date()
    };
    
    // Create OpenAI thread for this session
    const thread = await openai.beta.threads.create();
    sessions[sessionId].threadId = thread.id;
    
    console.log('Session created:', { sessionId, threadId: thread.id });
    
    res.json({
      sessionId,
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
    
    if (!session.threadId) {
      return res.status(400).json({ 
        error: 'Thread ID no encontrado en la sesión' 
      });
    }
    
    const assistantId = session.assistantId;
    if (!assistantId) {
      return res.status(400).json({ 
        error: 'Assistant ID no encontrado para esta sesión' 
      });
    }
    
    console.log('Processing message with:', { sessionId, threadId: session.threadId, assistantId, clientId });
    
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
    
    // Store IDs locally to avoid any reference issues
    const threadId = session.threadId;
    const runId = run.id;
    
    // Validate IDs before proceeding
    if (!threadId || !runId) {
      throw new Error(`Missing IDs - threadId: ${threadId}, runId: ${runId}`);
    }
    
    // Poll for completion
    console.log('Retrieving run status for:', { threadId, runId });
    console.log('Type of threadId:', typeof threadId, 'Value:', threadId);
    console.log('Type of runId:', typeof runId, 'Value:', runId);
    
    // Double check the values right before the API call
    if (threadId === undefined || threadId === null) {
      throw new Error('threadId is undefined or null right before API call!');
    }
    
    // Use correct format with thread_id in params object
    let runStatus = await openai.beta.threads.runs.retrieve(runId, { thread_id: threadId });
    console.log('Initial run status:', runStatus.status);
    
    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Polling run status...');
      runStatus = await openai.beta.threads.runs.retrieve(runId, { thread_id: threadId });
      console.log('Current run status:', runStatus.status);
      
      if (runStatus.status === 'failed') {
        console.error('Run failed:', runStatus);
        throw new Error('Assistant run failed: ' + JSON.stringify(runStatus.last_error));
      }
    }
    
    // Get the assistant's response
    console.log('Getting messages for thread:', threadId);
    const messages = await openai.beta.threads.messages.list(threadId);
    const lastMessage = messages.data[0];
    
    // Store message history for analytics
    if (!messageHistory[clientId]) {
      messageHistory[clientId] = [];
    }
    
    messageHistory[clientId].push({
      sessionId,
      userMessage: message,
      assistantMessage: lastMessage.content[0].text.value,
      timestamp: new Date()
    });
    
    res.json({
      message: lastMessage.content[0].text.value,
      messageId: lastMessage.id
    });
  } catch (error) {
    console.error('Error processing message:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      code: error.code,
      param: error.param,
      type: error.type
    });
    
    res.status(500).json({ 
      error: 'Error al procesar mensaje',
      details: error.message,
      type: error.type,
      param: error.param
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
    
    const messages = await openai.beta.threads.messages.list(session.threadId);
    
    res.json({
      messages: messages.data.reverse().map(msg => ({
        role: msg.role,
        content: msg.content[0].text.value,
        timestamp: msg.created_at
      }))
    });
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ 
      error: 'Error al obtener historial' 
    });
  }
});

// Test endpoint to verify assistant exists
router.get('/test-assistant/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;
    console.log('Testing assistant:', assistantId);
    
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    console.log('Assistant found:', assistant.name);
    
    res.json({ 
      success: true, 
      assistant: {
        id: assistant.id,
        name: assistant.name,
        model: assistant.model,
        instructions: assistant.instructions?.substring(0, 100) + '...'
      }
    });
  } catch (error) {
    console.error('Error retrieving assistant:', error);
    res.json({ 
      success: false, 
      error: error.message,
      details: error.response?.data || error
    });
  }
});

module.exports = router;