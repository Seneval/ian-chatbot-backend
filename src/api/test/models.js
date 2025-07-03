const express = require('express');
const Tenant = require('../../models/Tenant');
const User = require('../../models/User');
const Client = require('../../models/Client');
const Sentry = require('../../instrument');

const router = express.Router();

// Test Tenant model operations
router.post('/tenant', async (req, res) => {
  try {
    const tenant = await Tenant.createTestTenant();
    res.json({ 
      success: true, 
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        supabaseUserId: tenant.supabaseUserId,
        subscription: tenant.subscription
      }
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { endpoint: '/api/test/models/tenant' }
    });
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test Tenant findBySupabaseUserId
router.get('/tenant/:supabaseUserId', async (req, res) => {
  try {
    const { supabaseUserId } = req.params;
    const tenant = await Tenant.findBySupabaseUserId(supabaseUserId);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }
    
    res.json({ 
      success: true, 
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        supabaseUserId: tenant.supabaseUserId
      }
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { 
        endpoint: '/api/test/models/tenant/:supabaseUserId',
        supabaseUserId: req.params.supabaseUserId
      }
    });
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test Client creation with tenantId
router.post('/client', async (req, res) => {
  try {
    const { tenantId, assistantId } = req.body;
    
    if (!tenantId || !assistantId) {
      return res.status(400).json({
        success: false,
        error: 'tenantId and assistantId are required'
      });
    }

    // Verify tenant exists
    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant) {
      return res.status(400).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    const client = new Client({
      tenantId,
      businessName: `Test Business ${Date.now()}`,
      email: `test-client-${Date.now()}@example.com`,
      assistantId,
      contactPerson: 'Test Contact'
    });

    await client.save();

    res.json({ 
      success: true, 
      client: {
        clientId: client.clientId,
        tenantId: client.tenantId,
        businessName: client.businessName,
        email: client.email,
        assistantId: client.assistantId,
        token: client.token
      }
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { 
        endpoint: '/api/test/models/client',
        body: req.body
      }
    });
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test finding clients by tenant
router.get('/clients/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const clients = await Client.findByTenant(tenantId);
    
    res.json({ 
      success: true, 
      count: clients.length,
      clients: clients.map(client => ({
        clientId: client.clientId,
        businessName: client.businessName,
        email: client.email,
        isActive: client.isActive
      }))
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { 
        endpoint: '/api/test/models/clients/:tenantId',
        tenantId: req.params.tenantId
      }
    });
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test full tenant-client relationship
router.post('/full-test', async (req, res) => {
  try {
    const { assistantId = 'asst_test123' } = req.body;
    
    // 1. Create test tenant
    console.log('1. Creating test tenant...');
    const tenant = await Tenant.createTestTenant();
    
    // 2. Create test client for the tenant
    console.log('2. Creating test client...');
    const client = new Client({
      tenantId: tenant.tenantId,
      businessName: `Test Business for ${tenant.name}`,
      email: `client-${Date.now()}@example.com`,
      assistantId,
      contactPerson: 'Test Contact'
    });
    
    await client.save();
    
    // 3. Verify relationships
    console.log('3. Verifying relationships...');
    const foundTenant = await Tenant.findOne({ tenantId: tenant.tenantId });
    const foundClients = await Client.findByTenant(tenant.tenantId);
    
    // 4. Test tenant methods
    const isActive = tenant.isSubscriptionActive();
    const limits = tenant.isWithinLimits();
    const daysLeft = tenant.daysUntilTrialEnd();
    
    res.json({
      success: true,
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        supabaseUserId: tenant.supabaseUserId,
        subscription: {
          plan: tenant.subscription.plan,
          status: tenant.subscription.status,
          isActive,
          daysLeft
        },
        limits,
        usage: tenant.usage
      },
      client: {
        clientId: client.clientId,
        businessName: client.businessName,
        email: client.email,
        token: client.token.substring(0, 20) + '...'
      },
      verification: {
        tenantFound: !!foundTenant,
        clientsCount: foundClients.length,
        clientsInTenant: foundClients.some(c => c.clientId === client.clientId)
      }
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { 
        endpoint: '/api/test/models/full-test',
        body: req.body
      }
    });
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

// Get test data summary
router.get('/summary', async (req, res) => {
  try {
    const [totalTenants, totalClients, testTenants] = await Promise.all([
      Tenant.countDocuments(),
      Client.countDocuments(),
      Tenant.find({ name: { $regex: /^Test Company/ } }).limit(5)
    ]);
    
    res.json({
      success: true,
      summary: {
        totalTenants,
        totalClients,
        testTenants: testTenants.length,
        latestTestTenants: testTenants.map(t => ({
          tenantId: t.tenantId,
          name: t.name,
          slug: t.slug,
          supabaseUserId: t.supabaseUserId,
          createdAt: t.createdAt
        }))
      }
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { endpoint: '/api/test/models/summary' }
    });
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Clean up test data
router.delete('/cleanup', async (req, res) => {
  try {
    // Delete test tenants and their associated clients
    const testTenants = await Tenant.find({ 
      $or: [
        { name: { $regex: /^Test Company/ } },
        { email: { $regex: /^test.*@example\.com$/ } }
      ]
    });
    
    const tenantIds = testTenants.map(t => t.tenantId);
    
    // Delete associated clients
    const deletedClients = await Client.deleteMany({ 
      tenantId: { $in: tenantIds }
    });
    
    // Delete test tenants
    const deletedTenants = await Tenant.deleteMany({
      tenantId: { $in: tenantIds }
    });
    
    res.json({
      success: true,
      cleanup: {
        tenantsDeleted: deletedTenants.deletedCount,
        clientsDeleted: deletedClients.deletedCount,
        tenantIds: tenantIds
      }
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { endpoint: '/api/test/models/cleanup' }
    });
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;