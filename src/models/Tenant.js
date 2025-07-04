const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const tenantSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    default: uuidv4,
    unique: true
  },
  supabaseUserId: {
    type: String,
    unique: true,
    sparse: true // Allow null values but ensure uniqueness when present
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    maxlength: 500
  },
  logo: {
    type: String // URL to logo image
  },
  
  // Subscription information
  subscription: {
    plan: {
      type: String,
      enum: ['trial', 'starter', 'pro', 'enterprise'],
      default: 'trial'
    },
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'canceled', 'unpaid'],
      default: 'trialing'
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    },
    trialEnd: {
      type: Date,
      default: function() {
        // 14 days from now
        return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      }
    }
  },
  
  // Plan limits
  limits: {
    maxClients: {
      type: Number,
      default: function() {
        switch(this.subscription?.plan) {
          case 'starter': return 50;
          case 'pro': return 200;
          case 'enterprise': return 1000;
          default: return 5; // trial
        }
      }
    },
    maxUsers: {
      type: Number,
      default: function() {
        switch(this.subscription?.plan) {
          case 'starter': return 3;
          case 'pro': return 10;
          case 'enterprise': return 50;
          default: return 1; // trial
        }
      }
    },
    maxMessagesPerMonth: {
      type: Number,
      default: function() {
        switch(this.subscription?.plan) {
          case 'starter': return 100000;
          case 'pro': return 500000;
          case 'enterprise': return 2000000;
          default: return 1000; // trial
        }
      }
    },
    maxMessagesPerDay: {
      type: Number,
      default: function() {
        switch(this.subscription?.plan) {
          case 'starter': return 5000;
          case 'pro': return 20000;
          case 'enterprise': return 100000;
          default: return 10; // trial - 10 calls/day free
        }
      }
    }
  },
  
  // Usage tracking
  usage: {
    currentClients: {
      type: Number,
      default: 0
    },
    currentUsers: {
      type: Number,
      default: 1 // Owner user
    },
    currentMonthMessages: {
      type: Number,
      default: 0
    },
    currentDayMessages: {
      type: Number,
      default: 0
    },
    totalMessages: {
      type: Number,
      default: 0
    },
    lastUsageReset: {
      type: Date,
      default: Date.now
    },
    lastDayReset: {
      type: Date,
      default: Date.now
    }
  },
  
  // Settings
  settings: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'es'
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    usageAlerts: {
      type: Boolean,
      default: true
    }
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspensionReason: String,
  
  // Metadata
  lastActivity: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
}, {
  timestamps: true
});

// Indexes for performance (slug and email already unique in schema)
tenantSchema.index({ 'subscription.status': 1 });
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ createdAt: -1 });

// Instance methods
tenantSchema.methods.updateUsage = function(field, increment = 1) {
  const now = new Date();
  const lastReset = new Date(this.usage.lastUsageReset);
  const lastDayReset = new Date(this.usage.lastDayReset);
  
  // Reset monthly counters if needed
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.usage.currentMonthMessages = 0;
    this.usage.lastUsageReset = now;
  }
  
  // Reset daily counters if needed (new day)
  if (now.toDateString() !== lastDayReset.toDateString()) {
    this.usage.currentDayMessages = 0;
    this.usage.lastDayReset = now;
  }
  
  this.usage[field] += increment;
  this.lastActivity = now;
  return this.save();
};

tenantSchema.methods.isWithinLimits = function() {
  return {
    clients: this.usage.currentClients < this.limits.maxClients,
    users: this.usage.currentUsers < this.limits.maxUsers,
    messages: this.usage.currentMonthMessages < this.limits.maxMessagesPerMonth,
    dailyMessages: this.usage.currentDayMessages < this.limits.maxMessagesPerDay,
    overall: this.usage.currentClients < this.limits.maxClients && 
             this.usage.currentUsers < this.limits.maxUsers &&
             this.usage.currentMonthMessages < this.limits.maxMessagesPerMonth &&
             this.usage.currentDayMessages < this.limits.maxMessagesPerDay
  };
};

tenantSchema.methods.isSubscriptionActive = function() {
  const now = new Date();
  const status = this.subscription.status;
  
  if (status === 'trialing') {
    return now < this.subscription.trialEnd;
  }
  
  return ['active', 'trialing'].includes(status);
};

tenantSchema.methods.daysUntilTrialEnd = function() {
  if (this.subscription.status !== 'trialing') return 0;
  
  const now = new Date();
  const trialEnd = new Date(this.subscription.trialEnd);
  const diffTime = trialEnd - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Static methods
tenantSchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug, isActive: true });
};

tenantSchema.statics.findActive = function() {
  return this.find({ isActive: true, isSuspended: false });
};

tenantSchema.statics.findExpiring = function(days = 3) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);
  
  return this.find({
    'subscription.status': 'trialing',
    'subscription.trialEnd': { $lte: cutoffDate },
    isActive: true
  });
};

tenantSchema.statics.findBySupabaseUserId = function(supabaseUserId) {
  return this.findOne({ supabaseUserId, isActive: true });
};

tenantSchema.statics.createTestTenant = async function(suffix = '') {
  const timestamp = Date.now();
  return this.create({
    supabaseUserId: `test-${timestamp}${suffix}`,
    slug: `test-company-${timestamp}${suffix}`,
    name: `Test Company ${suffix}`,
    email: `test${timestamp}${suffix}@example.com`
  });
};

// Virtual for display
tenantSchema.virtual('displayName').get(function() {
  return this.name;
});

// Pre-save middleware
tenantSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate slug from name if not provided
    if (!this.slug && this.name) {
      this.slug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .trim();
    }
  }
  next();
});

module.exports = mongoose.model('Tenant', tenantSchema);