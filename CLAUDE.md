# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- **Run development server**: `npm run dev` - Starts the server with nodemon for auto-reloading on port 3000
- **Start production server**: `npm start` - Runs the server in production mode
- **Install dependencies**: `npm install` - Installs all required packages

### Deployment
- **Deploy to Vercel**: `vercel` - Deploys the application (requires Vercel CLI)
- **Local testing before deploy**: Test all endpoints locally before deploying

### Testing
Currently no test suite is configured. When implementing tests:
- Consider using Jest or Mocha for unit tests
- Test OpenAI integration with the `/api/test/*` endpoints (no auth required)
- Verify authentication middleware with different token scenarios

## Architecture Overview

### Project Structure
```
ian-chatbot-backend/
├── api/              # Vercel serverless function entry point
├── src/              # Main application code
│   ├── api/          # Route handlers
│   ├── config/       # Database configuration
│   ├── middleware/   # Authentication middleware
│   ├── models/       # MongoDB/Mongoose models
│   └── index.js      # Express app setup
├── public/           # Static files (widget.js)
└── vercel.json       # Vercel deployment configuration
```

### Key Components

1. **Authentication System**
   - Dual JWT system: separate secrets for clients (`JWT_SECRET`) and admins (`ADMIN_JWT_SECRET`)
   - Client tokens embedded in widget code for seamless integration
   - Middleware: `validateClient` for chat/analytics, `validateAdmin` for management

2. **Chat System** 
   - OpenAI Assistants API integration with thread-based conversations
   - Currently uses in-memory storage (transitioning to MongoDB)
   - Session management with unique sessionId per conversation
   - Widget always connects to real OpenAI assistant (demo mode removed)

3. **Multi-tenant Architecture**
   - Each client has unique clientId, token, and assistantId
   - Data isolation enforced at middleware level
   - Plan tiers: basic, pro, enterprise

4. **API Routes**
   - `/api/chat/*` - Main chat functionality (requires client token)
   - `/api/analytics/*` - Usage analytics and insights
   - `/api/auth/*` - Admin authentication and client management
   - `/api/test/*` - OpenAI testing endpoints (no auth)
   - `/widget.js` - Embeddable chat widget

### Environment Variables
Required for production:
- `OPENAI_API_KEY` - OpenAI API access
- `JWT_SECRET` - Client token signing
- `ADMIN_JWT_SECRET` - Admin token signing

Optional:
- `MONGODB_URI` - Database connection (currently using in-memory)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `ALLOWED_ORIGINS` - Additional CORS origins (comma-separated, e.g., `https://example.com,https://app.example.com`)

### Common Development Tasks

1. **Adding a new API endpoint**
   - Create route handler in `src/api/`
   - Import and mount in `src/index.js`
   - Apply appropriate middleware (validateClient/validateAdmin)

2. **Testing OpenAI integration**
   - Use `/api/test/assistant/:assistantId` to verify assistant exists
   - Use `/api/test/full-test` for complete chat flow testing

3. **Debugging authentication issues**
   - Check token in request headers: `x-client-token` for clients, `Authorization: Bearer` for admins
   - Verify JWT secrets match between environment and tokens

4. **Working with the widget**
   - Widget code is in `public/widget.js`
   - Client token is embedded during widget code generation in auth routes
   - Test widget integration on different domains considering CORS settings

### Important Patterns

- **Error Handling**: All routes wrapped in try-catch, consistent Spanish error messages
- **Rate Limiting**: 30 requests/minute per IP on all `/api/` routes
- **CORS**: 
  - Configured for multiple Vercel deployments, includes regex for preview URLs
  - Hardcoded origins include GitHub Pages (`https://seneval.github.io`)
  - Additional origins can be added via `ALLOWED_ORIGINS` environment variable
- **OpenAI Polling**: Chat responses use polling mechanism to check run completion
- **Session Storage**: Currently in-memory, models exist for MongoDB migration

### Deployment Notes

- Deployed as Vercel serverless function via `api/index.js`
- All routes handled by single function with Express routing
- Static files (widget.js) served directly by Express
- Environment variables must be configured in Vercel dashboard
- Changes pushed to GitHub automatically trigger Vercel deployment

### Troubleshooting

1. **CORS Errors When Embedding Widget**
   - **Problem**: "Access to fetch... has been blocked by CORS policy"
   - **Solution**: Add the domain to `allowedOrigins` in `src/index.js` or use `ALLOWED_ORIGINS` env variable
   - **Example**: For GitHub Pages, `https://seneval.github.io` is already included

2. **Widget Using Demo Bot Instead of Real Assistant**
   - **Problem**: Getting generic responses instead of OpenAI assistant
   - **Solution**: Demo mode has been removed from widget.js - ensure you're using the latest version
   - **Note**: Widget now always connects to `/api/chat/*` endpoints (real assistant)

3. **Authentication Failures**
   - **Problem**: 401 Unauthorized errors
   - **Solution**: 
     - Verify client token in widget matches a valid client in the system
     - Check JWT_SECRET environment variable matches between token generation and validation
     - Ensure token is passed in `x-client-token` header or `data-client-token` attribute

4. **OpenAI Integration Issues**
   - **Problem**: Chat not responding or errors from OpenAI
   - **Solution**:
     - Verify `OPENAI_API_KEY` is set and valid
     - Check assistant ID exists using `/api/test/assistant/:assistantId`
     - Monitor OpenAI API status and quotas
     - Use `/api/test/full-test` for debugging

5. **Deployment Issues**
   - **Problem**: Changes not reflecting after push
   - **Solution**:
     - Check Vercel deployment logs
     - Ensure environment variables are set in Vercel dashboard
     - Clear browser cache when testing widget updates

### Version Control & Recovery

**Current Stable Version**: `v1.0-stable` (Dec 2024)

When development issues occur and you need to revert to a known working state:

1. **To revert to "El Bueno" (stable version)**:
   ```bash
   git checkout v1.0-stable
   git push --force origin main
   ```

2. **To create a new stable checkpoint**:
   ```bash
   git tag -a v1.X-stable -m "Description of what works"
   git push origin v1.X-stable
   ```

3. **To view all stable versions**:
   ```bash
   git tag -l "v*-stable"
   ```

### Recent Changes (Dec 2024)

1. **CORS Support Enhanced**
   - Added `https://seneval.github.io` to allowed origins
   - Implemented `ALLOWED_ORIGINS` environment variable for dynamic origin management
   - Fixed preflight request handling for cross-origin widget embedding

2. **Widget Demo Mode Removed**
   - Removed all demo mode logic from `widget.js`
   - Widget now always connects to real OpenAI assistant endpoints
   - Eliminated confusion between demo and production modes

3. **Documentation Improvements**
   - Added this troubleshooting section
   - Updated environment variables documentation
   - Clarified CORS configuration patterns
   - Added version control recovery procedures