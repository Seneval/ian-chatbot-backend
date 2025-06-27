const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sessionId: { 
    type: String, 
    required: true, 
    index: true 
  },
  clientId: { 
    type: String, 
    required: true, 
    index: true 
  },
  messageId: {
    type: String,
    unique: true,
    sparse: true
  },
  role: { 
    type: String, 
    enum: ['user', 'assistant', 'system'], 
    required: true 
  },
  content: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  metadata: {
    tokensUsed: Number,
    responseTime: Number,
    errorMessage: String
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
messageSchema.index({ sessionId: 1, timestamp: 1 });
messageSchema.index({ clientId: 1, timestamp: -1 });
messageSchema.index({ clientId: 1, role: 1 });

// Text index for message search
messageSchema.index({ content: 'text' });

// Static methods
messageSchema.statics.findBySession = function(sessionId, options = {}) {
  const query = { sessionId };
  let findQuery = this.find(query);
  
  if (options.limit) {
    findQuery = findQuery.limit(options.limit);
  }
  
  return findQuery.sort({ timestamp: options.order === 'desc' ? -1 : 1 });
};

messageSchema.statics.findByClient = function(clientId, options = {}) {
  const query = { clientId };
  
  if (options.startDate || options.endDate) {
    query.timestamp = {};
    if (options.startDate) query.timestamp.$gte = options.startDate;
    if (options.endDate) query.timestamp.$lte = options.endDate;
  }
  
  let findQuery = this.find(query);
  
  if (options.limit) {
    findQuery = findQuery.limit(options.limit);
  }
  
  return findQuery.sort({ timestamp: -1 });
};

messageSchema.statics.searchMessages = function(clientId, searchText, options = {}) {
  const query = {
    clientId,
    $text: { $search: searchText }
  };
  
  return this.find(query, {
    score: { $meta: 'textScore' }
  }).sort({
    score: { $meta: 'textScore' }
  }).limit(options.limit || 20);
};

messageSchema.statics.getMessageStats = function(clientId, startDate, endDate) {
  const match = { clientId };
  if (startDate || endDate) {
    match.timestamp = {};
    if (startDate) match.timestamp.$gte = startDate;
    if (endDate) match.timestamp.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        avgLength: { $avg: { $strLenCP: '$content' } }
      }
    },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: '$count' },
        byRole: {
          $push: {
            role: '$_id',
            count: '$count',
            avgLength: '$avgLength'
          }
        }
      }
    }
  ]);
};

messageSchema.statics.getHourlyDistribution = function(clientId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        clientId,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: { $hour: '$timestamp' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Virtual for content preview
messageSchema.virtual('preview').get(function() {
  return this.content.length > 100 
    ? this.content.substring(0, 100) + '...' 
    : this.content;
});

module.exports = mongoose.model('Message', messageSchema);