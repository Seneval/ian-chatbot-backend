const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const adminUserSchema = new mongoose.Schema({
  adminId: { 
    type: String, 
    default: uuidv4, 
    unique: true 
  },
  username: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 30
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
    required: true,
    minlength: 8
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin'],
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  loginHistory: [{
    timestamp: Date,
    ip: String,
    userAgent: String,
    success: Boolean
  }],
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: Date
}, {
  timestamps: true
});

// Indexes are automatically created by unique: true in schema definition
// No need to manually add them

// Hash password before saving
adminUserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
adminUserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Instance method to record login attempt
adminUserSchema.methods.recordLogin = async function(ip, userAgent, success = true) {
  this.loginHistory.push({
    timestamp: new Date(),
    ip,
    userAgent,
    success
  });
  
  // Keep only last 100 login attempts
  if (this.loginHistory.length > 100) {
    this.loginHistory = this.loginHistory.slice(-100);
  }
  
  if (success) {
    this.lastLogin = new Date();
  }
  
  return this.save();
};

// Static method to find by username or email
adminUserSchema.statics.findByCredentials = async function(usernameOrEmail) {
  return this.findOne({
    $or: [
      { username: usernameOrEmail.toLowerCase() },
      { email: usernameOrEmail.toLowerCase() }
    ],
    isActive: true
  });
};

// Static method to check if any admin exists
adminUserSchema.statics.hasAdmins = async function() {
  const count = await this.countDocuments();
  return count > 0;
};

module.exports = mongoose.model('AdminUser', adminUserSchema);