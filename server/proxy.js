// proxy.js
const axios = require('axios');
const https = require('https');

/**
 * Get OpenAI configuration from environment variables or VCAP_SERVICES
 * @returns {Object} Object containing API key, base URL, and available models
 */

// In your proxy.js file, update the getAllGenAIServices function to include better service names

function getAllGenAIServices() {
  const services = [];
  
  // Check for VCAP_SERVICES (Cloud Foundry)
  if (process.env.VCAP_SERVICES) {
    try {
      const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
      
      // Process each type of GenAI service (genai, genai-service, etc.)
      const serviceTypes = ['genai', 'genai-service', 'generative-ai'];
      
      for (const serviceType of serviceTypes) {
        if (vcapServices[serviceType] && Array.isArray(vcapServices[serviceType])) {
          // Loop through each instance of this service type
          vcapServices[serviceType].forEach((service, index) => {
            if (service.credentials) {
              const credentials = service.credentials;
              const serviceId = service.instance_guid || `${serviceType}-${index}`;
              
              // Use a more user-friendly service name format
              // First try to get the instance name, which is more user-friendly
              let serviceName = service.instance_name || service.name;
              
              // If no name is available, create a formatted name
              if (!serviceName) {
                // For GenAI Tile, use a nicer format
                if (serviceType === 'genai') {
                  serviceName = 'GenAI Tile';
                } else if (serviceType === 'genai-service') {
                  serviceName = 'GenAI Service';
                } else if (serviceType === 'generative-ai') {
                  serviceName = 'Generative AI';
                } else {
                  serviceName = `${serviceType.charAt(0).toUpperCase()}${serviceType.slice(1)}`;
                }
                
                // Add an index if there are multiple of the same type
                if (vcapServices[serviceType].length > 1) {
                  serviceName += ` #${index + 1}`;
                }
              }
              
              // Get base URL
              let baseUrl = null;
              if (credentials.api_base) {
                baseUrl = credentials.api_base;
              } else if (credentials.base_url) {
                baseUrl = credentials.base_url;
              }
              
              // Get available models
              const models = [];
              
              // Primary model from model_name
              if (credentials.model_name) {
                models.push({
                  name: credentials.model_name,
                  display_name: credentials.model_name,
                  is_default: true
                });
              }
              
              // Model aliases if available
              if (credentials.model_aliases && Array.isArray(credentials.model_aliases)) {
                credentials.model_aliases.forEach(alias => {
                  // Check if this alias is already added
                  if (!models.some(m => m.name === alias)) {
                    models.push({
                      name: alias,
                      display_name: alias,
                      is_default: false
                    });
                  }
                });
              }
              
              // Add service info
              services.push({
                id: serviceId,
                name: serviceName,
                type: serviceType,
                plan: service.plan || 'unknown',
                base_url: baseUrl,
                models: models,
                // Do NOT include the API key for security reasons
                has_api_key: !!credentials.api_key
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('Error parsing VCAP_SERVICES for all GenAI services:', error.message);
    }
  }
  
  // If no services found and environment has OPENAI_API_KEY, add a local service
  if (services.length === 0 && process.env.OPENAI_API_KEY) {
    services.push({
      id: 'local-openai',
      name: 'OpenAI API',  // More user-friendly name
      type: 'environment',
      plan: 'default',
      base_url: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
      models: [
        { name: 'gpt-4', display_name: 'GPT-4', is_default: true },
        { name: 'gpt-3.5-turbo', display_name: 'GPT-3.5 Turbo', is_default: false }
      ],
      has_api_key: true
    });
  }
  
  return services;
}


function getOpenAIConfig(serviceId = null) {
  // Default config if direct environment variables are set
  let apiKey = process.env.OPENAI_API_KEY;
  let baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
  let availableModels = ['gpt-4']; // Default model
  let defaultModel = 'gpt-4';

  // Check for VCAP_SERVICES (Cloud Foundry)
  if (process.env.VCAP_SERVICES) {
    try {
      const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
      
      // Find all GenAI services
      const serviceTypes = ['genai', 'genai-service', 'generative-ai'];
      let selectedService = null;
      
      // Search for the specific service if ID is provided
      if (serviceId) {
        for (const serviceType of serviceTypes) {
          if (vcapServices[serviceType] && Array.isArray(vcapServices[serviceType])) {
            const foundService = vcapServices[serviceType].find(
              s => s.instance_guid === serviceId || 
                  (s.instance_name && s.instance_name === serviceId) ||
                  (s.name && s.name === serviceId)
            );
            
            if (foundService) {
              selectedService = foundService;
              break;
            }
          }
        }
      }
      
      // If no specific service found or no ID provided, use the first available
      if (!selectedService) {
        for (const serviceType of serviceTypes) {
          if (vcapServices[serviceType] && 
              Array.isArray(vcapServices[serviceType]) && 
              vcapServices[serviceType].length > 0) {
            selectedService = vcapServices[serviceType][0];
            break;
          }
        }
      }
      
      // Extract credentials from the selected service
      if (selectedService && selectedService.credentials) {
        const credentials = selectedService.credentials;
        
        // Extract API key
        if (credentials.api_key) {
          apiKey = credentials.api_key;
        }
        
        // Extract base URL
        if (credentials.api_base) {
          baseUrl = credentials.api_base;
        } else if (credentials.base_url) {
          baseUrl = credentials.base_url;
        }
        
        // Extract available models
        if (credentials.model_name) {
          defaultModel = credentials.model_name;
          availableModels = [credentials.model_name];
        }
        
        // Add model aliases if available
        if (credentials.model_aliases && Array.isArray(credentials.model_aliases)) {
          availableModels = [...availableModels, ...credentials.model_aliases];
        }
        
        console.log(`Using service: ${selectedService.instance_name || selectedService.name || 'unnamed'}`);
        console.log(`Found GenAI service binding with base URL: ${baseUrl}`);
        console.log(`Available models: ${availableModels.join(', ')}`);
      }
    } catch (error) {
      console.error('Error parsing VCAP_SERVICES:', error.message);
    }
  }
  
  if (!apiKey) {
    console.warn('No OpenAI API key found in environment or VCAP_SERVICES');
  }

  // Ensure the baseUrl doesn't end with a trailing slash
  baseUrl = baseUrl.replace(/\/+$/, '');

  // Only for OpenAI's official API, ensure the v1 path is included
  if (baseUrl === 'https://api.openai.com' && !baseUrl.endsWith('/v1')) {
    baseUrl = `${baseUrl}/v1`;
    console.log('Using OpenAI API with v1 path:', baseUrl);
  }



  
  return { apiKey, baseUrl, availableModels, defaultModel };
}

/**
 * Create an axios instance with appropriate configuration
 * @param {string} apiKey - OpenAI API Key
 * @returns {Object} Configured axios instance
 */
function createAxiosInstance(apiKey) {
  // Create an https agent that doesn't verify SSL certificates
  // This matches the Python code's httpx.Client(verify=False)
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });
  
  // Create an axios instance with the https agent
  return axios.create({
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    httpsAgent: httpsAgent
  });
}

/**
 * Sets up the OpenAI proxy routes on the Express app
 * @param {object} app - Express app instance
 */
function setupProxyRoutes(app) {
  // Get configuration once on startup
  const config = getOpenAIConfig();
  const defaultModel = config.defaultModel;


  app.get('/api/models-config', (req, res) => {
    const services = getAllGenAIServices();
    res.json({
      services: services
    });
  });
  
  // Test endpoint to check API connectivity
  app.get('/api/test-openai', async (req, res) => {
    const { apiKey, baseUrl } = config;
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'OpenAI API key is not configured'
      });
    }
    
    try {
      const client = createAxiosInstance(apiKey);
      
      // Send a simple request to check if the API is working
      const response = await client.get(`${baseUrl}/models`);
      
      return res.json({
        success: true,
        message: 'OpenAI API is working',
        models_count: response.data.data?.length || 0,
        default_model: defaultModel,
        available_models: config.availableModels
      });
    } catch (error) {
      console.error('Test OpenAI error details:', error);
      
      return res.status(500).json({
        success: false,
        message: `OpenAI API test failed: ${error.message || 'Unknown error'}`,
        url_used: baseUrl,
        status: error.response?.status
      });
    }
  });

  // Configuration endpoint to provide API status and model info
  app.get('/api/config', (req, res) => {
    const requestedModel = req.query.model;
    
    // Get all available services
    const services = getAllGenAIServices();
    
    // Default to the first service and model
    let selectedService = services.length > 0 ? services[0] : null;
    let selectedModel = null;
    
    // If a specific model was requested, find the service that provides it
    if (requestedModel && services.length > 0) {
      for (const service of services) {
        const model = service.models.find(m => m.name === requestedModel);
        if (model) {
          selectedService = service;
          selectedModel = model;
          break;
        }
      }
    }
    
    // If no specific model was requested, use the default model from the first service
    if (!selectedModel && selectedService && selectedService.models.length > 0) {
      // Try to find a default model first
      selectedModel = selectedService.models.find(m => m.is_default) || selectedService.models[0];
    }
    
    // Get the configuration for the selected service
    const { apiKey, baseUrl } = getOpenAIConfig(
      selectedService ? selectedService.id : undefined
    );
    
    res.json({
      configured: !!apiKey,
      baseUrl,
      serviceType: process.env.VCAP_SERVICES ? 'cloud-foundry' : 'standalone',
      service: selectedService ? {
        id: selectedService.id,
        name: selectedService.name,
        type: selectedService.type
      } : null,
      model: selectedModel ? {
        name: selectedModel.name,
        display_name: selectedModel.display_name
      } : null
    });
  });

  app.get('/health', (req, res) => {
    const requestedModel = req.query.model;
    
    // Get all available services
    const services = getAllGenAIServices();
    
    // Find the service for the requested model
    let selectedService = services.length > 0 ? services[0] : null;
    
    if (requestedModel && services.length > 0) {
      for (const service of services) {
        const model = service.models.find(m => m.name === requestedModel);
        if (model) {
          selectedService = service;
          break;
        }
      }
    }
    
    // Get API key for the selected service
    const { apiKey } = getOpenAIConfig(
      selectedService ? selectedService.id : undefined
    );
    
    // Return 200 even without API key for CF health checks to pass
    res.status(200).json({ 
      status: 'ok',
      api_configured: !!apiKey,
      timestamp: new Date().toISOString()
    });
  });

  // Main proxy endpoint for OpenAI chat completion
  app.post('/v1/chat/completions', async (req, res) => {
    const { stream = true } = req.body;
  

    // Get the service_id from the request if available
    const serviceId = req.body.service_id;
    
    // Get OpenAI configuration using the service ID if provided
    const { apiKey, baseUrl, availableModels, defaultModel } = getOpenAIConfig(serviceId);
    
    if (!apiKey) {
      return res.status(500).json({
        error: {
          message: 'OpenAI API key is not configured',
          type: 'server_config_error'
        }
      });
    }
    
    // Create the axios client with SSL verification disabled
    const client = createAxiosInstance(apiKey);
    
    try {
      // Replace the requested model with the default/available model
      const requestedModel = req.body.model || 'gpt-4';
      
      // Use the requested model if it's in our available models, otherwise use default
      const modelToUse = availableModels.includes(requestedModel) 
        ? requestedModel 
        : defaultModel;
      
      if (modelToUse !== requestedModel) {
        console.log(`Replacing requested model "${requestedModel}" with available model "${modelToUse}"`);
      }
      
      // Create a minimal request body with just the essential parts
      const minimalBody = {
        model: modelToUse,
        messages: req.body.messages,
        max_tokens: req.body.max_tokens || 1024,
        temperature: req.body.temperature || 0.5
      };
      
      console.log(`Using model: ${modelToUse}`);

      // Chat completions endpoint - properly handle OpenAI specifically
      let chatEndpoint;
      
      // For OpenAI's API, ensure we're using the correct endpoint structure
      if (baseUrl === 'https://api.openai.com/v1') {
        chatEndpoint = `${baseUrl}/chat/completions`;
        console.log('Using OpenAI chat completions endpoint:', chatEndpoint);
      } 
      // For other API providers, use their endpoint structure as is
      else {
        // Check if the baseUrl might already include the full endpoint
        if (baseUrl.endsWith('/chat/completions')) {
          chatEndpoint = baseUrl;
        } else {
          chatEndpoint = `${baseUrl}/chat/completions`;
        }
        console.log('Using provider-specific chat endpoint:', chatEndpoint);
      }

      
      // If streaming is not requested, forward normally
      if (!stream) {
        try {
          console.log('Making non-streaming request');
          
          const response = await client.post(chatEndpoint, minimalBody);
          return res.json(response.data);
        } catch (nonStreamError) {
          console.error('Non-streaming error:', nonStreamError.message);
          if (nonStreamError.response) {
            console.error('Error response:', {
              status: nonStreamError.response.status,
              data: JSON.stringify(nonStreamError.response.data).substring(0, 500)
            });
          }
          
          // Handle non-streaming errors safely
          let errorMessage = 'Error processing request';
          let statusCode = 500;
          
          if (nonStreamError.response) {
            statusCode = nonStreamError.response.status || 500;
            if (nonStreamError.response.data && typeof nonStreamError.response.data === 'object') {
              // Try to extract error message safely
              const errorData = nonStreamError.response.data;
              if (errorData.error && errorData.error.message) {
                errorMessage = errorData.error.message;
              } else if (errorData.message) {
                errorMessage = errorData.message;
              }
            }
          } else if (nonStreamError.message) {
            errorMessage = nonStreamError.message;
          }
          
          return res.status(statusCode).json({
            error: {
              message: errorMessage,
              type: 'api_error'
            }
          });
        }
      }
      
      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      try {
        // Use non-streaming request and simulate streaming for better compatibility
        console.log("Using non-streaming request and simulating streaming response");
        const nonStreamingBody = { ...minimalBody, stream: false };
        
        const response = await client.post(chatEndpoint, nonStreamingBody);
        
        // If we got a response, convert it to a streaming format
        if (response.data && response.data.choices && response.data.choices.length > 0) {
          const content = response.data.choices[0].message.content;
          
          // Simulate streaming by sending chunks of the content
          const chunkSize = 20; // characters per chunk
          for (let i = 0; i < content.length; i += chunkSize) {
            const chunk = content.substring(i, i + chunkSize);
            res.write(`data: ${JSON.stringify({ 
              choices: [{ delta: { content: chunk } }] 
            })}\n\n`);
            
            // Add a small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          
          res.write('data: [DONE]\n\n');
          return res.end();
        } else {
          throw new Error('Invalid response format from API');
        }
      } catch (error) {
        console.error('Error in chat completions:', error.message);
        
        // Create a safe error response in streaming format
        res.write(`data: ${JSON.stringify({ 
          error: { message: 'Error processing request: ' + error.message } 
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
    } catch (error) {
      // Handle any other unexpected errors
      console.error('Unexpected error in proxy:', error.message);
      
      // Create a completely new, safe error response
      let errorMessage = 'An unexpected error occurred';
      let statusCode = 500;
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      // Avoid using res.json() to prevent circular reference issues
      if (!res.headersSent) {
        return res.status(statusCode).send(JSON.stringify({
          error: {
            message: errorMessage,
            type: 'proxy_error'
          }
        }));
      } else {
        return res.end();
      }
    }
  });

  // Models endpoint to provide model information
  app.get('/v1/models', async (req, res) => {
    const { apiKey, baseUrl } = config;
    
    if (!apiKey) {
      return res.status(500).json({
        error: {
          message: 'OpenAI API key is not configured',
          type: 'server_config_error'
        }
      });
    }
    
    const client = createAxiosInstance(apiKey);
    
    try {
      // Try without "/v1" prefix first
      const modelsEndpoint = `${baseUrl}/models`;
      console.log(`Using models endpoint: ${modelsEndpoint}`);
      
      const response = await client.get(modelsEndpoint);
      return res.json(response.data);
    } catch (firstError) {
      console.log('First models endpoint failed, trying alternative:', firstError.message);
      
      try {
        // Try with "/v1" prefix as fallback
        const fallbackEndpoint = `${baseUrl}/v1/models`;
        console.log(`Trying fallback models endpoint: ${fallbackEndpoint}`);
        
        const response = await client.get(fallbackEndpoint);
        return res.json(response.data);
      } catch (error) {
        console.error('Error fetching models:', error.message);
        
        // Create a safe error response
        let errorMessage = 'Failed to fetch models';
        let statusCode = 500;
        
        if (error.response) {
          statusCode = error.response.status || 500;
          if (error.response.data && typeof error.response.data === 'object') {
            if (error.response.data.error && error.response.data.error.message) {
              errorMessage = error.response.data.error.message;
            }
          }
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        return res.status(statusCode).json({
          error: {
            message: errorMessage,
            type: 'proxy_error'
          }
        });
      }
    }
  });
}

module.exports = { setupProxyRoutes, getOpenAIConfig, getAllGenAIServices };