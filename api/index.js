// Initialize Sentry before loading the app
require('../src/instrument');

// Export the Express app for Vercel
const app = require('../src/index.js');

// Export app directly - Sentry middleware is already configured in the app
module.exports = app;