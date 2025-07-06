# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Status

- **Production URL**: https://ian-chatbot-backend-h6zr.vercel.app
- **Admin Dashboard**: https://admin.inteligenciaartificialparanegocios.com
- **Sentry Project**: https://ian-hh.sentry.io (project: ian-chatbot-backend)
- **MongoDB**: Connected with Atlas cluster (IP whitelist required: 0.0.0.0/0 for Vercel)
- **Widget**: Serving from `/widget.js` with personalization support
- **Pricing Model**: Per-chatbot ($200 MXN/month per premium chatbot)
- **Node Version**: >=16.0.0 (package.json requirement)

## Commands

### Development
- **Run development server**: `npm run dev` - Starts server with nodemon on port 3000 (auto-reloads on changes)
- **Start production server**: `npm start` - Runs server without auto-reload
- **Install dependencies**: `npm install` - Installs all packages including mongoose for MongoDB
- **Clean install**: `rm -rf node_modules package-lock.json && npm install` - Resolves dependency issues
- **Kill server**: `pkill -f "node.*ian-chatbot"` - Stops any running Node.js server
- **Check Sentry errors**: Visit https://ian-hh.sentry.io/issues/?project=6805447972626432
- **Run tests**: No automated tests implemented (only manual API testing endpoints)

### Deployment
- **Deploy to Vercel**: `git push origin main` - Auto-deploys on push to main
- **Manual deploy**: `vercel` - Deploys to production manually
- **Preview deployment**: Push to any branch creates preview URL
- **Check deployment**: https://ian-chatbot-backend-h6zr.vercel.app/api/health
- **Function timeout**: 10 seconds (Vercel free tier limit)

### Testing
- **Manual API testing**: Use `/api/test/*` endpoints (protected in production)
- **Test OpenAI assistant**: `GET /api/test/assistant/:assistantId`
- **Full chat flow test**: `POST /api/test/full-test`
- **Test Sentry integration**: 
  - Status: `GET /api/test-sentry/status`
  - Trigger error: `GET /api/test-sentry/error`
  - Custom error: `GET /api/test-sentry/custom-error`

## Complete Project Structure

```
/
├── api/
│   └── index.js                  # Vercel serverless entry point (wraps Express app)
├── src/
│   ├── index.js                  # Express app configuration & route mounting
│   ├── instrument.js             # Sentry initialization (must load before app)
│   ├── api/
│   │   ├── adminSetup.js         # One-time admin setup endpoint
│   │   ├── analytics.js          # Analytics & conversation viewing
│   │   ├── auth.js               # Admin/tenant authentication & client management
│   │   ├── chat.js               # OpenAI chat integration
│   │   ├── health.js             # Health check endpoint
│   │   ├── home.js               # Landing page routes
│   │   ├── register.js           # Tenant registration
│   │   ├── tenant-auth.js        # Tenant user authentication
│   │   ├── tenant.js             # Tenant management
│   │   ├── test-sentry.js        # Sentry error testing
│   │   └── test/
│   │       ├── models.js         # MongoDB model testing
│   │       ├── supabase.js       # Supabase integration testing
│   │       └── index.js          # OpenAI & auth flow testing
│   ├── models/
│   │   ├── AdminUser.js          # Platform super admin users
│   │   ├── Client.js             # Chatbot instances
│   │   ├── Message.js            # Chat messages
│   │   ├── Session.js            # Chat sessions
│   │   ├── Subscription.js       # Stripe subscription tracking
│   │   ├── Tenant.js             # Organizations/companies
│   │   └── User.js               # Tenant users
│   ├── middleware/
│   │   ├── auth.js               # JWT validation middleware
│   │   ├── tenant.js             # Tenant-specific middleware
│   │   └── usageLimit.js         # Per-chatbot usage limiting
│   ├── config/
│   │   └── database.js           # MongoDB connection
│   └── admin.backup/             # Backup of old admin files (not used)
├── public/
│   ├── homepage/                 # Landing page files
│   ├── admin/                    # Admin dashboard files
│   │   ├── css/admin.css         # Admin styles
│   │   ├── dashboard.html        # Main dashboard
│   │   ├── login.html            # Admin login
│   │   ├── register.html         # Tenant registration
│   │   ├── settings.html         # Admin settings
│   │   └── js/
│   │       ├── api.js            # API client utilities
│   │       ├── auth.js           # Authentication handler
│   │       ├── dashboard.js      # Dashboard functionality
│   │       └── settings.js       # Settings page handler
│   └── widget.js                 # Embeddable chat widget
├── vercel.json                   # Vercel configuration
├── package.json                  # Dependencies & scripts
├── .env.example                  # Example environment variables
└── .gitignore                    # Git ignore rules
```

## Multi-Agent Architecture

This backend works in conjunction with another Claude Code agent managing the frontend repository (`ian2` or `ianwebsite`). 

### Agent Responsibilities
- **This agent (Backend)**: 
  - API endpoints and business logic
  - Database models and migrations
  - Authentication and authorization
  - Widget serving (`/widget.js`)
  - OpenAI integration

- **Frontend agent (ian2/ianwebsite)**:
  - Admin dashboard UI
  - Client management interface
  - Analytics visualization
  - Makes API calls to this backend

### Cross-Repository Communication
When the frontend needs changes:
1. Frontend expects specific API endpoints (e.g., `/client` not `/clients`)
2. Frontend sends `x-client-token` header for client auth
3. Frontend sends `Authorization: Bearer` header for admin auth
4. Widget embeds are generated by backend, consumed by frontend

## Architecture Overview

### Core Flow
```
Frontend Dashboard → API Endpoints → MongoDB/In-Memory Storage
         ↓                  ↓
   Widget Embed ← Widget.js ← OpenAI Assistant
```

### Database Strategy
- **MongoDB**: Primary storage when `MONGODB_URI` is set
- **In-Memory Fallback**: Automatic fallback when MongoDB unavailable
- **Dual Support**: All routes check `isMongoDBAvailable()` and handle both cases

### Authentication Architecture
```
Platform Admin → AdminUser model → ADMIN_JWT_SECRET → validateAdmin
Tenant User → User model → ADMIN_JWT_SECRET → validateTenant
Client Widget → Client model → JWT_SECRET → validateClient
```

### API Routes Structure
- `/api/admin/setup` - One-time platform admin creation
- `/api/auth/*` - Admin authentication & client management
- `/api/chat/*` - Client chat functionality (OpenAI integration)
- `/api/analytics/*` - Admin analytics and conversation logs
- `/api/test/*` - Development/debugging endpoints (protected in production)
- `/api/test-sentry/*` - Sentry error tracking tests
- `/api/register/*` - Tenant registration flow
- `/api/tenant/*` - Tenant user authentication
- `/widget.js` - Static embeddable chat widget

### Complete MongoDB Models

```
Platform Level:
AdminUser (Platform super admins)
  ├── adminId (UUID)
  ├── username/email (unique)
  ├── password (bcrypt hashed)
  ├── role (super_admin/admin)
  └── loginHistory[]

Tenant Level:
Tenant (Organizations)
  ├── tenantId (UUID)
  ├── slug (unique URL identifier)
  ├── supabaseUserId (optional)
  └── subscription info

User (Tenant users)
  ├── userId (UUID)
  ├── tenantId (reference)
  ├── email (unique)
  ├── role (owner/admin/member)
  └── supabaseUserId (optional)

Subscription (Stripe integration)
  ├── stripeSubscriptionId (unique)
  ├── tenantId (reference)
  ├── status/plan/pricing
  └── billing details

Client (Chatbots)
  ├── clientId (UUID)
  ├── tenantId (reference)
  ├── assistantId (OpenAI)
  ├── plan (free/paid)
  ├── pricing ($200 MXN/month)
  └── usage limits & tracking

Session (Chat sessions)
  ├── sessionId (UUID)
  ├── clientId (reference)
  ├── threadId (OpenAI)
  └── messageCount

Message (Chat messages)
  ├── sessionId (reference)
  ├── role (user/assistant)
  └── content
```

## Critical Implementation Details

### Per-Chatbot Pricing Model
- **Free Plan**: 10 calls/day per chatbot, unlimited chatbots
- **Premium Plan**: $200 MXN/month per chatbot, 1,000 calls/day
- Client model stores pricing and usage at chatbot level
- `checkUsageLimit` middleware enforces per-chatbot limits
- Usage resets daily (cron-like check on each request)

### Widget Personalization Flow
1. Admin creates client with `widgetTitle` and `widgetGreeting`
2. Backend generates widget code with `data-title` and `data-greeting`
3. Widget.js reads these attributes and displays personalized UI
4. Token includes these values for runtime access

### CORS Configuration
- Hardcoded origins in `src/index.js` include main domains
- `ALLOWED_ORIGINS` env var adds additional origins (comma-separated)
- Widget endpoint uses `Access-Control-Allow-Origin: *` for broad compatibility
- Trust proxy enabled for Vercel deployment

### Session Management
1. Widget calls `POST /api/chat/session` → creates OpenAI thread
2. Returns `sessionId` linked to `threadId`
3. Messages sent to `POST /api/chat/message` with `sessionId`
4. OpenAI maintains conversation context via threads
5. Daily usage limits enforced per chatbot

### Admin Setup Flow (One-time)
1. Set `ADMIN_SETUP_KEY` in environment
2. POST to `/api/admin/setup` with header `x-admin-setup-key`
3. Creates first super_admin user
4. Remove `ADMIN_SETUP_KEY` after setup
5. All future admins created through settings page

### Supabase Integration (Optional)
- Used for tenant authentication if `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set
- Falls back to JWT-only auth if Supabase unavailable
- Tenants can have hybrid auth (some Supabase, some JWT-only)
- `supabaseUserId` field links tenant/user to Supabase auth

### Environment Variables

Required:
- `OPENAI_API_KEY` - OpenAI API access
- `JWT_SECRET` - Client token signing
- `ADMIN_JWT_SECRET` - Admin token signing

Optional but recommended:
- `MONGODB_URI` - MongoDB connection (include database name)
- `SENTRY_DSN` - Error tracking
- `ALLOWED_ORIGINS` - Additional CORS origins
- `WIDGET_URL` - Custom widget URL

Security & Setup:
- `ADMIN_SETUP_KEY` - One-time admin creation key
- `TEST_API_KEY` - Protect test endpoints in production
- `ENABLE_TEST_ENDPOINTS` - Force enable test endpoints

Supabase (optional):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key

Rate Limiting:
- `RATE_LIMIT_MAX` - Max requests per window (default: 100)
- `RATE_LIMIT_WINDOW` - Window in minutes (default: 15)

## Common Issues & Solutions

### Assistant ID Validation
OpenAI assistant IDs must start with 'asst_'. Validation added in:
- `/api/test/assistant/:assistantId`
- `/api/chat/message` 
- `/api/auth/client` (creation)

### Sentry Initialization Order
`require('dotenv').config()` must come before `require('./instrument')` in src/index.js

### MongoDB Duplicate Index Warnings
Remove manual `.index()` calls for fields with `unique: true` - unique constraint creates index automatically

### Route Naming
Frontend expects singular routes (`/client` not `/clients`)

### Token Regeneration
When `widgetTitle` or `widgetGreeting` changes, regenerate token to include new JWT payload values

### Trust Proxy Warning
Express app has `trust proxy: true` for Vercel deployment - required for proper IP detection behind proxy

### Test Endpoint Protection
In production, test endpoints return 404 unless:
- `ENABLE_TEST_ENDPOINTS=true` OR
- Request includes header `x-test-api-key` matching `TEST_API_KEY` env var

### Widget CORS Errors (Jan 2025)
**Problem**: Widget showed CORS errors instead of actual error messages (e.g., "Token inválido")

**Root Cause**: 
- Middleware (`validateClient`, `checkUsageLimit`) runs BEFORE route handlers
- When middleware returns errors (401, 429), no CORS headers were included
- Browser interprets missing CORS headers as CORS error, hiding real error message

**Solution**: Added CORS headers to all middleware error responses in `src/middleware/auth.js`:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-client-token');
```

This ensures browsers can read actual error messages like "Token inválido" or "Límite diario excedido" instead of showing generic CORS errors.

## Version Control & Recovery

**Current Version**: Latest updates include security hardening and admin management

### Creating Stable Version
```bash
git tag -a vX.X-stable -m "Description"
git push origin vX.X-stable
```

### Emergency Recovery
```bash
git checkout v5.0-stable
git push --force origin main
```

## Recent Architecture Decisions

### Security Hardening (Jan 2025)
- Removed all hardcoded credentials
- Added AdminUser model for platform admins
- One-time setup flow for first admin
- No JWT fallback secrets
- Test endpoint protection

### Per-Chatbot Pricing (Jan 2025)
- Switched from tenant to per-chatbot pricing
- $200 MXN/month per premium chatbot
- Daily/monthly usage tracking per chatbot

### Sentry Integration (Jan 2025)
- Early initialization in `instrument.js`
- Captures unhandled errors and console warnings
- Custom test endpoints for verification

### Admin Subdomain (Jan 2025)
- admin.inteligenciaartificialparanegocios.com
- Auto-redirects to /admin
- CNAME to cname.vercel-dns.com

## Important Notes

- Always maintain backward compatibility with deployed widgets
- Spanish error messages are intentional for Mexican market
- Rate limiting is per-IP, not per-client
- OpenAI threads are not reused between sessions
- Never include Co-Authored-By Claude in git commits
- Test endpoints accessible in development, protected in production
- Platform admins (AdminUser) are separate from tenant users
- Widget CORS allows all origins for embed compatibility

## Dependencies & Versions

Production:
- `@sentry/node`: ^9.34.0 - Error tracking
- `@supabase/supabase-js`: ^2.50.3 - Optional tenant auth
- `bcryptjs`: ^2.4.3 - Password hashing (NOT 3.x - breaks on Vercel)
- `cors`: ^2.8.5 - CORS handling
- `express`: ^4.21.2 - Web framework (NOT v5 beta)
- `express-rate-limit`: ^7.5.1 - Rate limiting
- `jsonwebtoken`: ^9.0.2 - JWT tokens
- `mongoose`: ^8.16.1 - MongoDB ODM
- `openai`: ^5.7.0 - OpenAI API client
- `uuid`: ^11.1.0 - UUID generation

Development:
- `nodemon`: ^3.1.0 - Auto-reload in development

## Security Considerations

- All admin operations require valid JWT with proper role
- Client tokens include tenantId for data isolation
- Passwords hashed with bcrypt (10 rounds)
- Rate limiting prevents brute force attacks
- MongoDB connection uses connection string auth
- Supabase provides additional auth layer (optional)
- Test endpoints protected in production
- No hardcoded secrets or credentials
- Environment variables required for all sensitive config
- Trust proxy enabled for Vercel deployment