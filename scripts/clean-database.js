#!/usr/bin/env node

/**
 * Script to clean database - removes all data except the super admin account
 * 
 * CAUTION: This will permanently delete data!
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import all models
const AdminUser = require('../src/models/AdminUser');
const Client = require('../src/models/Client');
const Tenant = require('../src/models/Tenant');
const User = require('../src/models/User');
const Session = require('../src/models/Session');
const Message = require('../src/models/Message');
const Subscription = require('../src/models/Subscription');

async function cleanDatabase() {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the super admin (patriciohml)
    const superAdmin = await AdminUser.findOne({ 
      username: 'patriciohml',
      role: 'super_admin' 
    });

    if (!superAdmin) {
      console.error('❌ Super admin account not found! Aborting to prevent data loss.');
      process.exit(1);
    }

    console.log(`✅ Found super admin: ${superAdmin.username} (${superAdmin.email})`);
    console.log('\n⚠️  WARNING: This will delete ALL data except the super admin account!');
    console.log('   - All chatbots');
    console.log('   - All tenants');
    console.log('   - All tenant users');
    console.log('   - All sessions and messages');
    console.log('   - All subscriptions');
    console.log('   - All other admin users\n');

    // Wait for user confirmation
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🗑️  Starting cleanup...\n');

    // Delete all clients (chatbots)
    const clientsDeleted = await Client.deleteMany({});
    console.log(`✅ Deleted ${clientsDeleted.deletedCount} chatbots`);

    // Delete all tenants
    const tenantsDeleted = await Tenant.deleteMany({});
    console.log(`✅ Deleted ${tenantsDeleted.deletedCount} tenants`);

    // Delete all tenant users
    const usersDeleted = await User.deleteMany({});
    console.log(`✅ Deleted ${usersDeleted.deletedCount} tenant users`);

    // Delete all sessions
    const sessionsDeleted = await Session.deleteMany({});
    console.log(`✅ Deleted ${sessionsDeleted.deletedCount} sessions`);

    // Delete all messages
    const messagesDeleted = await Message.deleteMany({});
    console.log(`✅ Deleted ${messagesDeleted.deletedCount} messages`);

    // Delete all subscriptions
    const subscriptionsDeleted = await Subscription.deleteMany({});
    console.log(`✅ Deleted ${subscriptionsDeleted.deletedCount} subscriptions`);

    // Delete all admin users except the super admin
    const adminsDeleted = await AdminUser.deleteMany({
      adminId: { $ne: superAdmin.adminId }
    });
    console.log(`✅ Deleted ${adminsDeleted.deletedCount} other admin users`);

    console.log('\n🎉 Database cleaned successfully!');
    console.log(`   Only remaining account: ${superAdmin.username} (super_admin)`);

  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanDatabase();