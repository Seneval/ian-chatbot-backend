# Vercel Environment Variables Setup

This document lists all environment variables needed for production deployment on Vercel.

## Required Environment Variables

### Core Configuration
```bash
# OpenAI API Key (Required)
OPENAI_API_KEY=sk-proj-...

# JWT Secrets (Required - Generate with: openssl rand -base64 32)
JWT_SECRET=your-secure-jwt-secret
ADMIN_JWT_SECRET=your-secure-admin-jwt-secret

# MongoDB Connection (Required)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name

# Node Environment
NODE_ENV=production
```

### Email Service Configuration (Required for Email Verification)
```bash
# SMTP Configuration - Using Resend
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_2sUsi6tt_BkGbpqsQc9QFTn54oBZMABuS
EMAIL_FROM=onboarding@resend.dev
FRONTEND_URL=https://ian-chatbot-backend-h6zr.vercel.app
```

### Optional Configuration
```bash
# Sentry Error Tracking (Optional)
SENTRY_DSN=https://...@ingest.sentry.io/...

# Additional CORS Origins (Optional)
ALLOWED_ORIGINS=https://example.com,https://app.example.com

# Test API Protection (Optional)
TEST_API_KEY=your-test-api-key
ENABLE_TEST_ENDPOINTS=false

# Rate Limiting (Optional - defaults shown)
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=15
```

## How to Add Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project (`ian-chatbot-backend`)
3. Navigate to Settings → Environment Variables
4. Add each variable:
   - Key: Variable name (e.g., `SMTP_HOST`)
   - Value: Variable value (e.g., `smtp.resend.com`)
   - Environment: Select "Production", "Preview", and "Development"
5. Click "Save"

## Important Notes

1. **MongoDB IP Whitelist**: Make sure your MongoDB Atlas cluster allows connections from `0.0.0.0/0` (all IPs) since Vercel uses dynamic IPs.

2. **Email Verification**: Without SMTP configuration, users won't receive verification emails but can still register and use the system.

3. **JWT Secrets**: Must be strong, random strings. Never use default values in production.

4. **Redeploy Required**: After adding/changing environment variables, you need to redeploy for changes to take effect.

## Verification

After setting up, verify everything works:

1. Check health endpoint: `https://your-domain.vercel.app/api/health`
2. Test registration with email verification
3. Test widget embedding from external domains
4. Monitor Sentry for any errors

## Troubleshooting

- **504 Gateway Timeout**: Usually MongoDB connection issues. Check IP whitelist and connection string.
- **CORS Errors**: Should be resolved with the latest code updates.
- **No Emails Sent**: Verify SMTP credentials are correctly set in Vercel.