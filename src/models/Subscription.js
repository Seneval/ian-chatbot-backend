const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const subscriptionSchema = new mongoose.Schema({
  subscriptionId: {
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
  
  // Stripe integration
  stripeSubscriptionId: {
    type: String,
    unique: true,
    sparse: true
  },
  stripeCustomerId: {
    type: String,
    required: true
  },
  stripePriceId: String,
  stripeProductId: String,
  
  // Subscription details
  plan: {
    type: String,
    enum: ['trial', 'starter', 'pro', 'enterprise'],
    required: true
  },
  status: {
    type: String,
    enum: [
      'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused'
    ],
    required: true
  },
  
  // Pricing
  currency: {
    type: String,
    default: 'usd',
    lowercase: true
  },
  amount: {
    type: Number,
    required: true // Amount in cents
  },
  interval: {
    type: String,
    enum: ['month', 'year'],
    default: 'month'
  },
  intervalCount: {
    type: Number,
    default: 1
  },
  
  // Trial information
  trialStart: Date,
  trialEnd: Date,
  
  // Billing periods
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  
  // Cancellation
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  cancelAt: Date,
  canceledAt: Date,
  cancellationReason: String,
  
  // Discounts and coupons
  discount: {
    couponId: String,
    percentOff: Number,
    amountOff: Number,
    duration: String, // 'forever', 'once', 'repeating'
    durationInMonths: Number,
    validUntil: Date
  },
  
  // Usage and limits
  quantity: {
    type: Number,
    default: 1
  },
  
  // Billing information
  nextBillingDate: Date,
  lastBillingDate: Date,
  lastPaymentDate: Date,
  lastPaymentAmount: Number,
  
  // Proration and changes
  pendingUpdate: {
    plan: String,
    priceId: String,
    effectiveDate: Date,
    prorateUpgrade: {
      type: Boolean,
      default: true
    }
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: String
  },
  
  // Analytics
  analytics: {
    lifetimeValue: {
      type: Number,
      default: 0
    },
    totalPayments: {
      type: Number,
      default: 0
    },
    failedPayments: {
      type: Number,
      default: 0
    },
    refunds: {
      type: Number,
      default: 0
    }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
}, {
  timestamps: true
});

// Indexes
subscriptionSchema.index({ tenantId: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 }, { unique: true, sparse: true });
subscriptionSchema.index({ stripeCustomerId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });
subscriptionSchema.index({ nextBillingDate: 1 });

// Instance methods
subscriptionSchema.methods.isActive = function() {
  return ['trialing', 'active'].includes(this.status);
};

subscriptionSchema.methods.isPastDue = function() {
  return this.status === 'past_due';
};

subscriptionSchema.methods.isCanceled = function() {
  return ['canceled', 'unpaid', 'incomplete_expired'].includes(this.status);
};

subscriptionSchema.methods.isInTrial = function() {
  return this.status === 'trialing' && 
         this.trialEnd && 
         new Date() < this.trialEnd;
};

subscriptionSchema.methods.daysUntilRenewal = function() {
  if (!this.currentPeriodEnd) return 0;
  
  const now = new Date();
  const renewal = new Date(this.currentPeriodEnd);
  const diffTime = renewal - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

subscriptionSchema.methods.daysUntilTrialEnd = function() {
  if (!this.isInTrial()) return 0;
  
  const now = new Date();
  const trialEnd = new Date(this.trialEnd);
  const diffTime = trialEnd - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

subscriptionSchema.methods.getMonthlyPrice = function() {
  if (this.interval === 'month') {
    return this.amount / this.intervalCount;
  }
  if (this.interval === 'year') {
    return this.amount / (12 * this.intervalCount);
  }
  return this.amount;
};

subscriptionSchema.methods.getDiscountedAmount = function() {
  if (!this.discount) return this.amount;
  
  if (this.discount.percentOff) {
    return this.amount * (1 - this.discount.percentOff / 100);
  }
  
  if (this.discount.amountOff) {
    return Math.max(0, this.amount - this.discount.amountOff);
  }
  
  return this.amount;
};

subscriptionSchema.methods.addPayment = function(amount) {
  this.analytics.totalPayments += 1;
  this.analytics.lifetimeValue += amount;
  this.lastPaymentDate = new Date();
  this.lastPaymentAmount = amount;
  return this.save();
};

subscriptionSchema.methods.addFailedPayment = function() {
  this.analytics.failedPayments += 1;
  return this.save();
};

subscriptionSchema.methods.addRefund = function(amount) {
  this.analytics.refunds += amount;
  this.analytics.lifetimeValue -= amount;
  return this.save();
};

// Static methods
subscriptionSchema.statics.findByTenant = function(tenantId) {
  return this.findOne({ tenantId, status: { $nin: ['canceled', 'incomplete_expired'] } })
           .sort({ createdAt: -1 });
};

subscriptionSchema.statics.findActive = function() {
  return this.find({ status: { $in: ['trialing', 'active'] } });
};

subscriptionSchema.statics.findExpiring = function(days = 3) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);
  
  return this.find({
    status: 'trialing',
    trialEnd: { $lte: cutoffDate }
  });
};

subscriptionSchema.statics.findPastDue = function() {
  return this.find({ status: 'past_due' });
};

subscriptionSchema.statics.findForRenewal = function(days = 1) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  
  return this.find({
    status: 'active',
    nextBillingDate: {
      $gte: startDate,
      $lte: endDate
    }
  });
};

// Virtual for formatted price
subscriptionSchema.virtual('formattedPrice').get(function() {
  const amount = this.amount / 100; // Convert from cents
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency.toUpperCase()
  }).format(amount);
});

// Virtual for plan display name
subscriptionSchema.virtual('planDisplayName').get(function() {
  const planNames = {
    trial: 'Free Trial',
    starter: 'Starter Plan',
    pro: 'Pro Plan',
    enterprise: 'Enterprise Plan'
  };
  return planNames[this.plan] || this.plan;
});

module.exports = mongoose.model('Subscription', subscriptionSchema);