# TPCF GenAI Chat

A modern chat application with OpenAI API integration, designed for deployment to Cloud Foundry or any other platform.


## Features

- Real-time chat interface with streaming responses
- Support for multiple OpenAI models
- Dark/light theme support
- Conversation management (create, save, delete)
- Model-specific conversations (each conversation maintains its own model)
- Response time tracking
- Cloud Foundry deployment ready
- Support for cloud-based GenAI services via service bindings

## Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: Vue 3 with Composition API
- **Bundler**: Vite
- **Language**: TypeScript

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yannicklevederpvtl/genai-chat-tpcf
cd genai-chat-tpcf
npm run install:all
```

## Configuration

Create a `.env` file in the root directory with your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com  # Optional, defaults to OpenAI's API URL
```

For Cloud Foundry deployments, the application will automatically use service bindings with the following types:
- `genai`
- `genai-service`
- `generative-ai`

## Development

To run the application in development mode:

```bash
npm run dev
```

This will start the backend server on port 3000 and the frontend development server on port 5173.

## Building for Production

To build the application for production:

```bash
npm run build
```

This will create a production-ready build in the `client/dist` directory.

## Deployment

### Standalone Deployment

To deploy as a standalone application:

```bash
npm run prod
```

This will build the frontend and start the server, serving the frontend from the `client/dist` directory.

### Cloud Foundry Deployment

To deploy to Cloud Foundry:

1. Modify the `manifest.yml` file to match your environment
2. Push to Cloud Foundry:

```bash
cf push
```

The application will automatically detect and use any bound GenAI services.

## Usage Guide

### Starting a Conversation

1. Select a model from the dropdown at the top
2. Type your message in the input box
3. Press Enter or click the send button

### Managing Conversations

- Click "New Chat" to start a new conversation
- Your conversations are saved automatically
- Click on any conversation in the sidebar to switch between them
- Click the trash icon to delete a conversation

### Model Selection

Each conversation is tied to a specific model. The model can only be selected at the start of a new conversation and cannot be changed afterward.

### Response Time Tracking

The application displays the response time for each API request in the bottom right corner of the chat interface, helping you monitor performance.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.