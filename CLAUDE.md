# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- **Run development server**: `npm run dev` - Starts server with nodemon on port 3000
- **Start production server**: `npm start` - Runs server without auto-reload
- **Install dependencies**: `npm install` - No build step required

### Deployment
- **Deploy to Vercel**: `vercel` - Deploy directly to production
- **Test deployment**: Visit deployed URL + `/api/health`

## Architecture Overview

### Multi-Tenant Chatbot Platform
This backend provides AI chatbot services for multiple businesses (tenants) using OpenAI's Assistants API.

**Key Components:**
- **Admin System**: Platform administrators manage clients and view analytics
- **Client System**: Each business gets a unique token for their chatbot widget
- **Widget**: Embeddable JavaScript (`/widget.js`) that businesses add to their websites
- **OpenAI Integration**: Each client connects to their own OpenAI Assistant

### Authentication Architecture
```
Admin → POST /api/auth/admin/login → JWT (ADMIN_JWT_SECRET) → Access admin endpoints
Client → Widget with token → JWT (JWT_SECRET) → Access chat endpoints
```

### API Route Structure
- `/api/auth/*` - Admin authentication & client management
- `/api/chat/*` - Client chat functionality (OpenAI integration)
- `/api/analytics/*` - Admin analytics and conversation logs
- `/api/test/*` - Development/debugging endpoints
- `/widget.js` - Static embeddable chat widget

### Database Strategy
- **Current**: In-memory storage (objects in auth.js, chat.js)
- **Prepared**: MongoDB models exist but unused (Client, Session, Message)
- **Migration Path**: Replace in-memory objects with MongoDB calls

## Critical Implementation Details

### Client Token Structure
Tokens include metadata in JWT payload:
```javascript
{
  clientId: 'uuid',
  assistantId: 'asst_xxx',
  businessName: 'Company Name'
}
```

### OpenAI Integration Flow
1. Widget calls `POST /api/chat/session` → creates OpenAI thread
2. Returns `sessionId` linked to `threadId`
3. Messages sent to `POST /api/chat/message` with `sessionId`
4. Backend manages OpenAI runs and polls for completion

### Widget Embedding
Clients receive this code:
```html
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://your-domain/widget.js';
    script.setAttribute('data-client-token', 'TOKEN');
    script.setAttribute('data-position', 'bottom-right');
    script.async = true;
    document.head.appendChild(script);
  })();
</script>
```

### Environment Variables

**Required:**
- `OPENAI_API_KEY` - OpenAI API access
- `JWT_SECRET` - Client token signing
- `ADMIN_JWT_SECRET` - Admin token signing

**Optional:**
- `MONGODB_URI` - MongoDB connection (unused currently)
- `PORT` - Server port (default: 3000)
- `RATE_LIMIT_MAX` - Requests per minute (default: 30)
- `ALLOWED_ORIGINS` - Additional CORS origins
- `WIDGET_URL` - Custom widget URL

### Current Limitations & Workarounds

1. **Admin Authentication**: Hardcoded demo account (username: admin, password: admin123)
2. **Data Persistence**: In-memory storage resets on server restart
3. **MongoDB**: Models exist but connection not implemented
4. **Analytics**: Endpoints return mock data
5. **Rate Limiting**: Per-IP, not per-client

### Testing OpenAI Integration
Use test endpoints to verify assistant configuration:
```bash
# Test assistant exists
GET /api/test/assistant/asst_xxxxx

# Full chat test
POST /api/test/full-test
{
  "assistantId": "asst_xxxxx",
  "message": "Hello"
}
```

### Widget Customization
Data attributes for widget configuration:
- `data-client-token` (required) - Authentication token
- `data-position` - Widget position (bottom-right, bottom-left)
- `data-title` - Custom widget title
- `data-greeting` - Custom greeting message

## Important Notes

- Express v5 is used (beta) - be aware of potential breaking changes
- All routes must handle both in-memory and future MongoDB storage
- Spanish error messages are intentional for Mexican market
- Vercel deployment uses serverless functions with `/api` rewrite
- Test endpoints should be disabled in production