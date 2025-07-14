const express = require('express');
const router = express.Router();
const { isSupabaseAvailable } = require('../config/supabase');

// Public config endpoint - returns client-safe configuration
router.get('/public', (req, res) => {
  const config = {
    features: {
      googleAuth: isSupabaseAvailable() && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    }
  };

  // Only include Supabase config if available
  if (config.features.googleAuth) {
    config.supabase = {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY
    };
  }

  res.json(config);
});

module.exports = router;