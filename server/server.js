// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const { setupProxyRoutes, getOpenAIConfig } = require('./proxy');

// Load environment variables
dotenv.config();

const app = express();
// For Cloud Foundry, use the provided port
const PORT = process.env.PORT || 3000;

// Print startup information
console.log('Starting OpenAI Proxy Server');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Check for VCAP_SERVICES (Cloud Foundry)
if (process.env.VCAP_SERVICES) {
  console.log('Running in Cloud Foundry environment');
  try {
    // Log service binding information (without sensitive data)
    const { apiKey, baseUrl } = getOpenAIConfig();
    console.log(`OpenAI Base URL: ${baseUrl}`);
    console.log(`API Key configured: ${!!apiKey}`);
  } catch (error) {
    console.error('Error processing VCAP_SERVICES:', error);
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// Set up OpenAI proxy routes
setupProxyRoutes(app);

// Health check endpoint (required for Cloud Foundry)
app.get('/health', (req, res) => {
  const { apiKey } = getOpenAIConfig();
  // Return 200 even without API key for CF health checks to pass
  // But include warning in the response
  res.status(200).json({ 
    status: 'ok',
    api_configured: !!apiKey,
    timestamp: new Date().toISOString()
  });
});

// Serve static files from the Vue app in production
if (process.env.NODE_ENV === 'production') {
  console.log('Serving static frontend files');
  // Serve any static files
  app.use(express.static(path.join(__dirname, '../client/dist')));

  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    // Exclude API routes
    if (req.path.startsWith('/v1/') || req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
} else {
  // For development - simple welcome page
  app.get('/', (req, res) => {
    res.send('OpenAI Proxy Server - API is running. Frontend is served separately in development.');
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.message || 'Unknown error');
  
  // Send a safe error response
  res.status(500).json({
    error: {
      message: 'An internal server error occurred',
      type: 'server_error'
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log('Production mode: Serving frontend from ./client/dist');
  } else {
    console.log('Development mode: API available at http://localhost:' + PORT);
    console.log('Frontend should be started separately with npm run client');
  }
});
