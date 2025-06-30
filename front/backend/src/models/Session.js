const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  clientId: { 
    type: String, 
    required: true, 
    index: true 
  },
  threadId: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  lastMessageAt: { 
    type: Date, 
    default: Date.now 
  },
  messageCount: { 
    type: Number, 
    default: 0 
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    referrer: String
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
sessionSchema.index({ clientId: 1, createdAt: -1 });
sessionSchema.index({ clientId: 1, isActive: 1 });

// Instance methods
sessionSchema.methods.incrementMessageCount = function() {
  this.messageCount += 1;
  this.lastMessageAt = new Date();
  return this.save();
};

sessionSchema.methods.endSession = function() {
  this.isActive = false;
  return this.save();
};

// Static methods
sessionSchema.statics.findByClient = function(clientId, options = {}) {
  const query = { clientId };
  if (options.active !== undefined) {
    query.isActive = options.active;
  }
  return this.find(query).sort({ createdAt: -1 });
};

sessionSchema.statics.getActiveSessionsCount = function(clientId) {
  return this.countDocuments({ clientId, isActive: true });
};

sessionSchema.statics.getSessionStats = function(clientId, startDate, endDate) {
  const match = { clientId };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalMessages: { $sum: '$messageCount' },
        avgMessagesPerSession: { $avg: '$messageCount' }
      }
    }
  ]);
};

// Virtual for session duration
sessionSchema.virtual('duration').get(function() {
  if (!this.lastMessageAt || !this.createdAt) return 0;
  return this.lastMessageAt - this.createdAt;
});

module.exports = mongoose.model('Session', sessionSchema);