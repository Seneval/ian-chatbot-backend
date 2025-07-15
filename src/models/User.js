const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: uuidv4,
    unique: true
  },
  tenantId: {
    type: String,
    required: true
  },
  supabaseUserId: {
    type: String,
    unique: true,
    sparse: true
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      // Password is required only if no OAuth method is used
      return !this.googleId && !this.supabaseUserId;
    },
    minlength: 6
  },
  authMethod: {
    type: String,
    enum: ['password', 'google', 'hybrid'],
    default: 'password'
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'member'
  },
  
  // Profile information
  avatar: String, // URL to avatar image
  phone: {
    type: String,
    trim: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  language: {
    type: String,
    default: 'es'
  },
  
  // Authentication
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  
  // Preferences
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    marketingEmails: {
      type: Boolean,
      default: false
    },
    weeklyReports: {
      type: Boolean,
      default: true
    }
  },
  
  // Metadata
  invitedBy: String, // userId who invited this user
  invitedAt: Date,
  acceptedInviteAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
}, {
  timestamps: true
});

// Compound indexes (email already unique in schema)
userSchema.index({ tenantId: 1, email: 1 });
userSchema.index({ tenantId: 1, role: 1 });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: {
        loginAttempts: 1
      },
      $unset: {
        lockUntil: 1
      }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // If we have hit max attempts and it's not locked yet, lock the account
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // Lock for 2 hours
    };
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1
    }
  });
};

userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

userSchema.methods.generateEmailVerificationToken = function() {
  this.emailVerificationToken = uuidv4();
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return this.save();
};

userSchema.methods.generatePasswordResetToken = function() {
  this.passwordResetToken = uuidv4();
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return this.save();
};

userSchema.methods.verifyEmail = function() {
  this.emailVerified = true;
  this.emailVerificationToken = undefined;
  this.emailVerificationExpires = undefined;
  return this.save();
};

userSchema.methods.hasPermission = function(permission) {
  const permissions = {
    owner: ['*'], // All permissions
    admin: [
      'client.create', 'client.read', 'client.update', 'client.delete',
      'analytics.read', 'user.read', 'user.invite',
      'settings.read', 'settings.update'
    ],
    member: [
      'client.read', 'analytics.read'
    ]
  };
  
  const userPermissions = permissions[this.role] || [];
  return userPermissions.includes('*') || userPermissions.includes(permission);
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

userSchema.statics.findByTenant = function(tenantId) {
  return this.find({ tenantId, isActive: true }).sort({ createdAt: -1 });
};

userSchema.statics.findOwners = function(tenantId) {
  return this.find({ tenantId, role: 'owner', isActive: true });
};

userSchema.statics.findByVerificationToken = function(token) {
  return this.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() },
    isActive: true
  });
};

userSchema.statics.findByPasswordResetToken = function(token) {
  return this.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: Date.now() },
    isActive: true
  });
};

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (!this.isModified('password')) return next();
  
  // Skip hashing if no password (OAuth users)
  if (!this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware for email
userSchema.pre('save', function(next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase();
  }
  next();
});

// Post-save middleware to update tenant user count
userSchema.post('save', async function() {
  if (this.isNew && this.isActive) {
    try {
      const Tenant = mongoose.model('Tenant');
      await Tenant.findOneAndUpdate(
        { tenantId: this.tenantId },
        { $inc: { 'usage.currentUsers': 1 } }
      );
    } catch (error) {
      console.error('Error updating tenant user count:', error);
    }
  }
});

// Post-remove middleware to update tenant user count
userSchema.post('remove', async function() {
  try {
    const Tenant = mongoose.model('Tenant');
    await Tenant.findOneAndUpdate(
      { tenantId: this.tenantId },
      { $inc: { 'usage.currentUsers': -1 } }
    );
  } catch (error) {
    console.error('Error updating tenant user count:', error);
  }
});

module.exports = mongoose.model('User', userSchema);