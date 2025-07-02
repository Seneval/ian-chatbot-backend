const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const clientSchema = new mongoose.Schema({
  clientId: { 
    type: String, 
    default: uuidv4, 
    unique: true,
    index: true 
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  businessName: { 
    type: String, 
    required: true,
    trim: true 
  },
  contactPerson: {
    type: String,
    trim: true
  },
  email: { 
    type: String, 
    required: true,
    lowercase: true,
    trim: true 
  },
  phone: {
    type: String,
    trim: true
  },
  assistantId: { 
    type: String, 
    required: true,
    trim: true 
  },
  token: { 
    type: String, 
    unique: true,
    sparse: true 
  },
  plan: { 
    type: String, 
    enum: ['basic', 'pro', 'enterprise'], 
    default: 'basic' 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'overdue'], 
    default: 'pending' 
  },
  monthlyMessageLimit: {
    type: Number,
    default: 1000
  },
  widgetTitle: {
    type: String,
    default: 'Asistente Virtual',
    trim: true
  },
  widgetGreeting: {
    type: String,
    default: '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?',
    trim: true
  },
  // Usage tracking
  totalMessages: {
    type: Number,
    default: 0
  },
  totalSessions: {
    type: Number,
    default: 0
  },
  currentMonthMessages: {
    type: Number,
    default: 0
  },
  currentMonthSessions: {
    type: Number,
    default: 0
  },
  lastMonthReset: {
    type: Date,
    default: Date.now
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastActive: Date,
  updatedAt: Date
}, {
  timestamps: true
});

// Indexes for better query performance
clientSchema.index({ tenantId: 1, email: 1 });
clientSchema.index({ tenantId: 1, clientId: 1 });
clientSchema.index({ tenantId: 1, isActive: 1 });
clientSchema.index({ tenantId: 1, createdAt: -1 });
clientSchema.index({ email: 1 });
clientSchema.index({ assistantId: 1 });
clientSchema.index({ isActive: 1 });
clientSchema.index({ createdAt: -1 });

// Instance methods
clientSchema.methods.regenerateToken = function() {
  this.token = uuidv4();
  return this.save();
};

clientSchema.methods.updateActivity = function() {
  this.lastActive = new Date();
  return this.save();
};

clientSchema.methods.incrementMessageCount = function() {
  const now = new Date();
  const lastReset = new Date(this.lastMonthReset);
  
  // Check if we need to reset monthly counters
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.currentMonthMessages = 0;
    this.currentMonthSessions = 0;
    this.lastMonthReset = now;
  }
  
  this.totalMessages += 1;
  this.currentMonthMessages += 1;
  this.lastActive = now;
  return this.save();
};

clientSchema.methods.incrementSessionCount = function() {
  const now = new Date();
  const lastReset = new Date(this.lastMonthReset);
  
  // Check if we need to reset monthly counters
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.currentMonthMessages = 0;
    this.currentMonthSessions = 0;
    this.lastMonthReset = now;
  }
  
  this.totalSessions += 1;
  this.currentMonthSessions += 1;
  this.lastActive = now;
  return this.save();
};

// Static methods
clientSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

clientSchema.statics.findByTenant = function(tenantId) {
  return this.find({ tenantId, isActive: true }).sort({ createdAt: -1 });
};

clientSchema.statics.findByToken = function(token) {
  return this.findOne({ token, isActive: true });
};

// Virtual for display name
clientSchema.virtual('displayName').get(function() {
  return this.contactPerson || this.businessName;
});

// Pre-save middleware
clientSchema.pre('save', function(next) {
  if (!this.token) {
    this.token = uuidv4();
  }
  next();
});

module.exports = mongoose.model('Client', clientSchema);