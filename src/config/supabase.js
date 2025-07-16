const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_ANON_KEY');
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false // We'll handle sessions manually for serverless
  }
});

// Check if Supabase is available
const isSupabaseAvailable = () => {
  return !!(supabaseUrl && supabaseKey);
};

module.exports = {
  supabase,
  isSupabaseAvailable
};