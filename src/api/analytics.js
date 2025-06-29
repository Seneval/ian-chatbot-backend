const express = require('express');
const router = express.Router();
const { validateAdmin } = require('../middleware/auth');

// Import MongoDB models
let Client, Session, Message;
try {
  Client = require('../models/Client');
  Session = require('../models/Session');
  Message = require('../models/Message');
} catch (error) {
  console.log('⚠️  MongoDB models not available, using mock data');
}

// Check if MongoDB is available
const isMongoDBAvailable = () => {
  return Client && Session && Message && process.env.MONGODB_URI;
};

// Get analytics overview for a client
router.get('/overview/:clientId', validateAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;
    
    let data;
    
    if (isMongoDBAvailable()) {
      // Verify client exists
      const client = await Client.findOne({ clientId });
      if (!client) {
        return res.status(404).json({ 
          error: 'Cliente no encontrado' 
        });
      }
      
      // Parse dates
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
      const end = endDate ? new Date(endDate) : new Date();
      
      // Get session stats
      const sessionStats = await Session.getSessionStats(clientId, start, end);
      const sessionData = sessionStats[0] || {
        totalSessions: 0,
        totalMessages: 0,
        avgMessagesPerSession: 0
      };
      
      // Get message stats
      const messageStats = await Message.getMessageStats(clientId, start, end);
      const messageData = messageStats[0] || {
        totalMessages: 0,
        byRole: []
      };
      
      // Get hourly distribution (last 7 days for performance)
      const hourlyStats = await Message.getHourlyDistribution(clientId, 7);
      
      // Get recent sessions for activity tracking
      const recentSessions = await Session.findByClient(clientId, { active: true });
      const activeSessions = recentSessions.length;
      
      // Get most recent messages for common topics analysis
      const recentMessages = await Message.findByClient(clientId, {
        startDate: start,
        endDate: end,
        limit: 100
      });
      
      // Simple topic extraction (count most common words)
      const topicWords = {};
      recentMessages.forEach(msg => {
        if (msg.role === 'user') {
          const words = msg.content.toLowerCase().split(/\s+/);
          words.forEach(word => {
            if (word.length > 4) { // Only words longer than 4 chars
              topicWords[word] = (topicWords[word] || 0) + 1;
            }
          });
        }
      });
      
      const commonTopics = Object.entries(topicWords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
      
      data = {
        clientId,
        businessName: client.businessName,
        period: { startDate: start, endDate: end },
        metrics: {
          totalConversations: sessionData.totalSessions,
          totalMessages: messageData.totalMessages,
          averageMessagesPerConversation: sessionData.avgMessagesPerSession || 0,
          activeConversations: activeSessions,
          messagesByRole: messageData.byRole,
          peakHours: hourlyStats.map(h => ({
            hour: h._id,
            count: h.count
          })),
          commonTopics,
          // Client usage vs limits
          currentMonthMessages: client.currentMonthMessages,
          monthlyMessageLimit: client.monthlyMessageLimit,
          usagePercentage: (client.currentMonthMessages / client.monthlyMessageLimit) * 100
        },
        lastActive: client.lastActive
      };
    } else {
      // Mock data for development
      data = {
        clientId,
        period: { startDate, endDate },
        metrics: {
          totalConversations: 0,
          totalMessages: 0,
          averageMessagesPerConversation: 0,
          activeConversations: 0,
          messagesByRole: [],
          peakHours: [],
          commonTopics: [],
          currentMonthMessages: 0,
          monthlyMessageLimit: 1000,
          usagePercentage: 0
        }
      };
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ 
      error: 'Error al obtener analytics' 
    });
  }
});

// Get conversation logs for a client
router.get('/conversations/:clientId', validateAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { limit = 20, offset = 0, startDate, endDate } = req.query;
    
    let conversations = [];
    let total = 0;
    
    if (isMongoDBAvailable()) {
      // Verify client exists
      const client = await Client.findOne({ clientId });
      if (!client) {
        return res.status(404).json({ 
          error: 'Cliente no encontrado' 
        });
      }
      
      // Get sessions with filters
      const sessionQuery = { clientId };
      if (startDate || endDate) {
        sessionQuery.createdAt = {};
        if (startDate) sessionQuery.createdAt.$gte = new Date(startDate);
        if (endDate) sessionQuery.createdAt.$lte = new Date(endDate);
      }
      
      // Get total count
      total = await Session.countDocuments(sessionQuery);
      
      // Get paginated sessions
      const sessions = await Session.find(sessionQuery)
        .sort({ createdAt: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit));
      
      // For each session, get summary info
      conversations = await Promise.all(sessions.map(async (session) => {
        // Get first and last messages
        const messages = await Message.find({ sessionId: session.sessionId })
          .sort({ timestamp: 1 })
          .select('content role timestamp');
        
        const firstMessage = messages[0];
        const lastMessage = messages[messages.length - 1];
        
        return {
          sessionId: session.sessionId,
          createdAt: session.createdAt,
          lastMessageAt: session.lastMessageAt,
          messageCount: session.messageCount,
          isActive: session.isActive,
          duration: session.duration,
          firstMessage: firstMessage ? {
            content: firstMessage.content.substring(0, 100) + '...',
            role: firstMessage.role,
            timestamp: firstMessage.timestamp
          } : null,
          lastMessage: lastMessage ? {
            content: lastMessage.content.substring(0, 100) + '...',
            role: lastMessage.role,
            timestamp: lastMessage.timestamp
          } : null
        };
      }));
    }
    
    res.json({
      clientId,
      conversations,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ 
      error: 'Error al obtener conversaciones' 
    });
  }
});

// Get detailed conversation messages
router.get('/conversations/:clientId/:sessionId', validateAdmin, async (req, res) => {
  try {
    const { clientId, sessionId } = req.params;
    
    let conversation = null;
    
    if (isMongoDBAvailable()) {
      // Verify session belongs to client
      const session = await Session.findOne({ sessionId, clientId });
      if (!session) {
        return res.status(404).json({ 
          error: 'Conversación no encontrada' 
        });
      }
      
      // Get all messages
      const messages = await Message.find({ sessionId })
        .sort({ timestamp: 1 });
      
      conversation = {
        sessionId: session.sessionId,
        clientId: session.clientId,
        threadId: session.threadId,
        createdAt: session.createdAt,
        lastMessageAt: session.lastMessageAt,
        messageCount: session.messageCount,
        isActive: session.isActive,
        metadata: session.metadata,
        messages: messages.map(msg => ({
          messageId: msg.messageId,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp || msg.createdAt,
          metadata: msg.metadata
        }))
      };
    }
    
    if (!conversation) {
      return res.status(404).json({ 
        error: 'Conversación no encontrada' 
      });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error('Error getting conversation details:', error);
    res.status(500).json({ 
      error: 'Error al obtener detalles de conversación' 
    });
  }
});

// Get client usage summary
router.get('/usage/:clientId', validateAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { period = 'month' } = req.query; // month, week, day
    
    let usage = {};
    
    if (isMongoDBAvailable()) {
      const client = await Client.findOne({ clientId });
      if (!client) {
        return res.status(404).json({ 
          error: 'Cliente no encontrado' 
        });
      }
      
      // Calculate date range based on period
      const now = new Date();
      let startDate;
      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      // Get message count for period
      const messageCount = await Message.countDocuments({
        clientId,
        timestamp: { $gte: startDate }
      });
      
      // Get session count for period
      const sessionCount = await Session.countDocuments({
        clientId,
        createdAt: { $gte: startDate }
      });
      
      // Calculate daily average
      const daysDiff = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
      
      usage = {
        clientId,
        businessName: client.businessName,
        period: {
          type: period,
          startDate,
          endDate: now
        },
        usage: {
          totalMessages: messageCount,
          totalSessions: sessionCount,
          dailyAverageMessages: Math.round(messageCount / daysDiff),
          dailyAverageSessions: Math.round(sessionCount / daysDiff),
          currentMonthMessages: client.currentMonthMessages,
          monthlyMessageLimit: client.monthlyMessageLimit,
          remainingMessages: client.monthlyMessageLimit - client.currentMonthMessages,
          usagePercentage: Math.round((client.currentMonthMessages / client.monthlyMessageLimit) * 100)
        },
        limits: {
          plan: client.plan,
          monthlyMessageLimit: client.monthlyMessageLimit,
          willResetOn: new Date(now.getFullYear(), now.getMonth() + 1, 1)
        }
      };
    } else {
      // Mock data
      usage = {
        clientId,
        period: {
          type: period,
          startDate: new Date(),
          endDate: new Date()
        },
        usage: {
          totalMessages: 0,
          totalSessions: 0,
          dailyAverageMessages: 0,
          dailyAverageSessions: 0,
          currentMonthMessages: 0,
          monthlyMessageLimit: 1000,
          remainingMessages: 1000,
          usagePercentage: 0
        },
        limits: {
          plan: 'basic',
          monthlyMessageLimit: 1000,
          willResetOn: new Date()
        }
      };
    }
    
    res.json(usage);
  } catch (error) {
    console.error('Error getting usage data:', error);
    res.status(500).json({ 
      error: 'Error al obtener datos de uso' 
    });
  }
});

// Search messages
router.get('/search/:clientId', validateAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { query, limit = 20 } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Query parameter is required' 
      });
    }
    
    let results = [];
    
    if (isMongoDBAvailable()) {
      // Verify client exists
      const client = await Client.findOne({ clientId });
      if (!client) {
        return res.status(404).json({ 
          error: 'Cliente no encontrado' 
        });
      }
      
      // Search messages using text index
      results = await Message.searchMessages(clientId, query, { limit: parseInt(limit) });
      
      // Enrich results with session info
      results = await Promise.all(results.map(async (msg) => {
        const session = await Session.findOne({ sessionId: msg.sessionId });
        return {
          messageId: msg.messageId,
          sessionId: msg.sessionId,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp || msg.createdAt,
          score: msg.score,
          sessionInfo: session ? {
            createdAt: session.createdAt,
            messageCount: session.messageCount
          } : null
        };
      }));
    }
    
    res.json({
      query,
      results,
      total: results.length
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({ 
      error: 'Error al buscar mensajes' 
    });
  }
});

module.exports = router;