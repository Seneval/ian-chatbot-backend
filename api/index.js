// Initialize Sentry before loading the app
require('../src/instrument');
const Sentry = require('@sentry/node');

// Export the Express app for Vercel
const app = require('../src/index.js');

// Wrap the Express app with Sentry for serverless
module.exports = Sentry.wrapHttpFunction(app);