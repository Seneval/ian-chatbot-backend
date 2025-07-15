const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase configuration missing. Some features may not work.');
}

// Create Supabase client
const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false, // Server-side, no session persistence needed
        detectSessionInUrl: false
      }
    })
  : null;

// Helper function to check if Supabase is available
const isSupabaseAvailable = () => {
  return supabase !== null;
};

// Helper function to validate Supabase connection
const validateSupabaseConnection = async () => {
  if (!isSupabaseAvailable()) {
    throw new Error('Supabase not configured');
  }
  
  try {
    // Simple health check - try to get current session (will return null but validates connection)
    const { data, error } = await supabase.auth.getSession();
    
    if (error && error.message !== 'Invalid JWT') {
      throw error;
    }
    
    return { connected: true, data, error: null };
  } catch (error) {
    return { connected: false, data: null, error: error.message };
  }
};

module.exports = {
  supabase,
  isSupabaseAvailable,
  validateSupabaseConnection
};