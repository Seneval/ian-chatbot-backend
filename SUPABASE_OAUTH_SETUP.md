# Supabase Google OAuth Setup Instructions

## Step 1: Configure Google OAuth in Supabase Dashboard

1. **Go to Supabase Dashboard**: https://gcuhsqmcsksbpaorcsag.supabase.co
2. **Navigate to Authentication > Providers**
3. **Enable Google Provider**:
   - Toggle "Enable sign-in with Google"
   - You'll need Google OAuth credentials

## Step 2: Create Google OAuth Application

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create new project** or select existing project
3. **Enable Google+ API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Name: "iAN Chatbot SaaS"

## Step 3: Configure Redirect URLs

Add these authorized redirect URIs in Google Cloud Console:

### Production URLs:
```
https://gcuhsqmcsksbpaorcsag.supabase.co/auth/v1/callback
https://ian-chatbot-backend-h6zr.vercel.app/auth/callback
https://app.inteligenciaartificialparanegocios.com/auth/callback
https://admin.inteligenciaartificialparanegocios.com/auth/callback
```

### Development URLs:
```
http://localhost:3000/auth/callback
http://127.0.0.1:3000/auth/callback
```

## Step 4: Configure Supabase with Google Credentials

1. **Copy Client ID and Client Secret** from Google Cloud Console
2. **In Supabase Dashboard** (Authentication > Providers > Google):
   - Paste **Client ID**
   - Paste **Client Secret**
   - Set **Redirect URL**: `https://gcuhsqmcsksbpaorcsag.supabase.co/auth/v1/callback`

## Step 5: Configure Site URL in Supabase

1. **Go to Authentication > URL Configuration**
2. **Set Site URL**: `https://app.inteligenciaartificialparanegocios.com`
3. **Add Redirect URLs**:
   ```
   https://app.inteligenciaartificialparanegocios.com/**
   https://admin.inteligenciaartificialparanegocios.com/**
   https://ian-chatbot-backend-h6zr.vercel.app/**
   http://localhost:3000/**
   ```

## Step 6: Test Configuration

Once configured, test the OAuth flow:

1. Visit the updated registration page
2. Click "Sign up with Google"
3. Complete Google OAuth flow
4. Verify tenant creation in Supabase database

## Environment Variables Needed

Make sure these are set in Vercel:
```
SUPABASE_URL=https://gcuhsqmcsksbpaorcsag.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

## Expected Database Behavior

After successful Google OAuth:
- New entry in `tenants` table for new users
- `patriciohml@gmail.com` gets super admin access
- JWT token returned for frontend authentication