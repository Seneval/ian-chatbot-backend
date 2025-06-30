const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const clientSchema = new mongoose.Schema({
  clientId: { 
    type: String, 
    default: uuidv4, 
    unique: true,
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

// Static methods
clientSchema.statics.findActive = function() {
  return this.find({ isActive: true });
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