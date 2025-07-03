const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const clientSchema = new mongoose.Schema({
  clientId: { 
    type: String, 
    default: uuidv4, 
    unique: true
  },
  tenantId: {
    type: String,
    required: true
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
    enum: ['free', 'paid'], 
    default: 'free' 
  },
  
  // Pricing information for per-chatbot model
  pricing: {
    isPaid: {
      type: Boolean,
      default: false
    },
    amount: {
      type: Number,
      default: 0 // 0 for free, 200 for paid
    },
    currency: {
      type: String,
      default: 'MXN'
    },
    stripeSubscriptionId: String,
    stripeCustomerId: String,
    subscriptionStatus: {
      type: String,
      enum: ['active', 'past_due', 'canceled', 'unpaid', 'trialing', 'none'],
      default: 'none'
    },
    nextBillingDate: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    }
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
  // Usage limits based on plan
  limits: {
    messagesPerDay: {
      type: Number,
      default: 10 // 10 calls/day for free, updated when plan changes
    },
    messagesPerMonth: {
      type: Number,
      default: 300 // ~10/day for free, updated when plan changes
    }
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
  usage: {
    totalMessages: {
      type: Number,
      default: 0
    },
    totalSessions: {
      type: Number,
      default: 0
    },
    currentDayMessages: {
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
    lastDayReset: {
      type: Date,
      default: Date.now
    },
    lastMonthReset: {
      type: Date,
      default: Date.now
    }
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
  const monterreyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Monterrey"}));
  const lastMonthReset = new Date(this.usage.lastMonthReset);
  const lastDayReset = new Date(this.usage.lastDayReset);
  const lastDayResetMonterrey = new Date(lastDayReset.toLocaleString("en-US", {timeZone: "America/Monterrey"}));
  
  // Check if we need to reset daily counters (using Monterrey timezone)
  if (monterreyTime.toDateString() !== lastDayResetMonterrey.toDateString()) {
    this.usage.currentDayMessages = 0;
    this.usage.lastDayReset = now;
  }
  
  // Check if we need to reset monthly counters
  if (now.getMonth() !== lastMonthReset.getMonth() || now.getFullYear() !== lastMonthReset.getFullYear()) {
    this.usage.currentMonthMessages = 0;
    this.usage.currentMonthSessions = 0;
    this.usage.lastMonthReset = now;
  }
  
  this.usage.totalMessages += 1;
  this.usage.currentDayMessages += 1;
  this.usage.currentMonthMessages += 1;
  this.lastActive = now;
  return this.save();
};

clientSchema.methods.incrementSessionCount = function() {
  const now = new Date();
  const lastReset = new Date(this.usage.lastMonthReset);
  
  // Check if we need to reset monthly counters
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.usage.currentMonthMessages = 0;
    this.usage.currentMonthSessions = 0;
    this.usage.lastMonthReset = now;
  }
  
  this.usage.totalSessions += 1;
  this.usage.currentMonthSessions += 1;
  this.lastActive = now;
  return this.save();
};

// Check if chatbot has exceeded limits
clientSchema.methods.isWithinLimits = async function() {
  const now = new Date();
  const monterreyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Monterrey"}));
  const lastDayReset = new Date(this.usage.lastDayReset);
  const lastDayResetMonterrey = new Date(lastDayReset.toLocaleString("en-US", {timeZone: "America/Monterrey"}));
  
  // Reset daily counter if needed (check if it's a new day in Monterrey timezone)
  if (monterreyTime.toDateString() !== lastDayResetMonterrey.toDateString()) {
    this.usage.currentDayMessages = 0;
    this.usage.lastDayReset = now;
    await this.save(); // Persist the reset to database
  }
  
  // Check daily limit
  return this.usage.currentDayMessages < this.limits.messagesPerDay;
};

// Update limits when plan changes
clientSchema.methods.updatePlan = function(plan, isPaid = false) {
  this.plan = plan;
  this.pricing.isPaid = isPaid;
  
  if (plan === 'paid') {
    this.limits.messagesPerDay = 1000;
    this.limits.messagesPerMonth = 30000;
    this.pricing.amount = 200;
  } else {
    this.limits.messagesPerDay = 10;
    this.limits.messagesPerMonth = 300;
    this.pricing.amount = 0;
  }
  
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