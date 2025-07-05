#!/usr/bin/env node

/**
 * Script to create a test tenant for super admin testing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Tenant = require('../src/models/Tenant');

async function createTestTenant() {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create test tenant
    const tenant = new Tenant({
      tenantId: uuidv4(),
      name: 'Test Organization',
      slug: 'test-org',
      email: 'test@example.com',
      description: 'Test organization for super admin',
      subscription: {
        plan: 'free',
        status: 'active'
      }
    });

    await tenant.save();
    
    console.log('\n✅ Test tenant created successfully!');
    console.log(`   Tenant ID: ${tenant.tenantId}`);
    console.log(`   Name: ${tenant.name}`);
    console.log(`   Slug: ${tenant.slug}`);
    console.log('\nYou can now create chatbots for this tenant.');

  } catch (error) {
    if (error.code === 11000) {
      console.error('❌ A tenant with slug "test-org" already exists');
    } else {
      console.error('❌ Error creating tenant:', error.message);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
createTestTenant();