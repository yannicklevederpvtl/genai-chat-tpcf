<!-- App.vue -->
<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { v4 as uuidv4 } from 'uuid';

// UI state
const userInput = ref('');
const streamingContent = ref('');
const isStreaming = ref(false);
const apiError = ref(null);
const isConnected = ref(false);
const apiConfigured = ref(false);
const isDarkMode = ref(false);
const conversations = ref([]);
const currentConversationId = ref(null);
const isSidebarOpen = ref(false);
const showDeleteModal = ref(false);
const confirmDeleteId = ref(null);

// API configuration
const selectedModelKey = ref('');
const availableModels = ref([]);
const availableServices = ref([]);
const currentServiceConfig = ref(null);
const apiEndpoint = ref('/v1/chat/completions');

// Response time tracking
const requestStartTime = ref(null);
const requestDuration = ref(null);

// References for DOM elements
const messagesContainer = ref(null);
const userInputArea = ref(null);

// Computed properties
const currentConversation = computed(() => 
  conversations.value.find(conv => conv.id === currentConversationId.value)
);

const currentMessages = computed(() => {
  return currentConversation.value?.messages || [];
});

// Disable model selection if conversation has messages
const isModelSelectionDisabled = computed(() => {
  return currentConversation.value && currentConversation.value.messages.length > 0;
});

// Lifecycle hooks
onMounted(() => {
  const theme = localStorage.getItem('theme');
  if (theme) {
    isDarkMode.value = (theme === 'dark');
  } else {
    isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  loadModelsConfig();
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      isDarkMode.value = e.matches;
    }
  });

  const storedConversations = localStorage.getItem('conversations');
  if (storedConversations) {
    try {
      conversations.value = JSON.parse(storedConversations);
      if (conversations.value.length > 0) {
        const recentConversations = [...conversations.value]
          .sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
        currentConversationId.value = recentConversations[0].id;
        
        // Set the model for the current conversation
        if (recentConversations[0].modelKey) {
          selectedModelKey.value = recentConversations[0].modelKey;
        }
      }
    } catch (err) {
      console.error('Failed to parse saved conversations:', err);
      conversations.value = [];
    }
  }

  if (conversations.value.length === 0) {
    createNewConversation();
  }
  
  checkApiConfig();
  
  setTimeout(() => {
    userInputArea.value?.focus();
  });
  
  // Health check polling
  setInterval(checkApiHealth, 10000);
});

// Watchers
watch(conversations, () => {
  localStorage.setItem('conversations', JSON.stringify(conversations.value));
}, { deep: true });

watch(currentMessages, () => {
  setTimeout(() => {
    scrollToBottom();
  });
});

watch(streamingContent, () => {
  setTimeout(() => {
    scrollToBottom();
  });
});

watch(currentConversationId, () => {
  // Update the selected model when switching conversations
  const conversation = conversations.value.find(conv => conv.id === currentConversationId.value);
  if (conversation && conversation.modelKey) {
    selectedModelKey.value = conversation.modelKey;
  }
});

// Methods
const loadModelsConfig = async () => {
  try {
    const response = await fetch('/api/models-config');
    if (response.ok) {
      const data = await response.json();
      availableServices.value = data.services || [];
      
      // Flatten models from all services, but include service information in display name
      availableModels.value = [];
      availableServices.value.forEach(service => {
        if (service.models && service.models.length) {
          service.models.forEach(model => {
            availableModels.value.push({
              name: model.name,
              // Format as "service: model"
              display_name: `${service.name}: ${model.display_name || model.name}`,
              service_id: service.id,
              service_name: service.name
            });
          });
        }
      });
      
      if (availableModels.value.length > 0) {
        // Only set if not already set by a conversation
        if (!selectedModelKey.value) {
          selectedModelKey.value = availableModels.value[0].name;
        }
        handleModelChange();
      }
      
      checkApiConfig();
    } else {
      console.error('Failed to fetch model configurations');
    }
  } catch (err) {
    console.error('Error fetching model configurations:', err);
  }
};

const handleModelChange = () => {
  const selectedModel = availableModels.value.find(model => model.name === selectedModelKey.value);
  if (selectedModel) {
    const serviceId = selectedModel.service_id;
    currentServiceConfig.value = availableServices.value.find(service => service.id === serviceId);
    
    // Update the model in the current conversation
    if (currentConversationId.value) {
      const conversation = conversations.value.find(conv => conv.id === currentConversationId.value);
      if (conversation) {
        conversation.modelKey = selectedModelKey.value;
      }
    }
    
    checkApiConfig();
    console.log(`Switched to model: ${selectedModelKey.value} from service: ${serviceId}`);
  }
};

const checkApiConfig = async () => {
  try {
    const params = new URLSearchParams();
    if (selectedModelKey.value) {
      params.append('model', selectedModelKey.value);
    }
    
    const response = await fetch(`/api/config?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      apiConfigured.value = data.configured;
      
      if (!data.configured) {
        apiError.value = "OpenAI API is not properly configured on the server. Please check server configuration.";
      } else {
        apiError.value = null;
      }
      isConnected.value = true;
    } else {
      isConnected.value = false;
    }
  } catch {
    isConnected.value = false;
  }
};

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
  localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light');
};

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const createNewConversation = () => {
  const newConversation = {
    id: uuidv4(),
    title: "New Conversation",
    messages: [],
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
    modelKey: selectedModelKey.value  // Store the selected model with the conversation
  };
  
  conversations.value.unshift(newConversation);
  currentConversationId.value = newConversation.id;
  isSidebarOpen.value = false;
  userInput.value = '';
  
  setTimeout(() => {
    userInputArea.value?.focus();
  });
};

const selectConversation = (id) => {
  currentConversationId.value = id;
  isSidebarOpen.value = false;
  
  setTimeout(() => {
    userInputArea.value?.focus();
    scrollToBottom();
  });
};

const confirmDeleteConversation = (id) => {
  confirmDeleteId.value = id;
  showDeleteModal.value = true;
};

const deleteConversation = () => {
  if (!confirmDeleteId.value) return;
  
  const index = conversations.value.findIndex(conv => conv.id === confirmDeleteId.value);
  if (index !== -1) {
    conversations.value.splice(index, 1);
    
    if (confirmDeleteId.value === currentConversationId.value) {
      if (conversations.value.length > 0) {
        currentConversationId.value = conversations.value[0].id;
      } else {
        createNewConversation();
      }
    }
  }
  
  showDeleteModal.value = false;
  confirmDeleteId.value = null;
};

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const checkApiHealth = async () => {
  try {
    const params = new URLSearchParams();
    if (selectedModelKey.value) {
      params.append('model', selectedModelKey.value);
    }
    
    const response = await fetch(`/health?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      isConnected.value = true;
      apiConfigured.value = data.api_configured;
      
      if (!data.api_configured) {
        apiError.value = "OpenAI API is not properly configured on the server.";
      }
    } else {
      isConnected.value = false;
    }
  } catch {
    isConnected.value = false;
  }
};

const updateConversationTitle = (firstMessage) => {
  if (!currentConversationId.value) return;
  
  const conversation = conversations.value.find(conv => conv.id === currentConversationId.value);
  if (conversation && conversation.title === "New Conversation") {
    conversation.title = firstMessage.length > 30 
      ? firstMessage.substring(0, 30) + "..."
      : firstMessage;
  }
};

const sendMessage = async () => {
  if (!userInput.value.trim() || isStreaming.value || !currentConversationId.value || 
      !isConnected.value || !apiConfigured.value) {
    return;
  }
  
  const message = userInput.value.trim();
  const conversation = conversations.value.find(conv => conv.id === currentConversationId.value);
  
  if (conversation && conversation.messages.length === 0) {
    updateConversationTitle(message);
  }
  
  if (conversation) {
    conversation.messages.push({
      role: "user",
      content: message
    });
    conversation.lastUpdatedAt = Date.now();
  }
  
  userInput.value = '';
  apiError.value = null;
  isStreaming.value = true;
  streamingContent.value = '';
  
  // Start timing the request
  requestStartTime.value = Date.now();
  requestDuration.value = null;
  
  try {
    // Prepare messages for the API
    const systemMessage = { role: "system", content: "You are a helpful assistant." };
    const contextMessages = [...currentMessages.value.slice(-10)];
    const messages = [systemMessage, ...contextMessages];
    
    const requestBody = {
      model: selectedModelKey.value,
      messages: messages,
      stream: true
    };
    
    // Add service_id if available
    if (currentServiceConfig.value) {
      requestBody.service_id = currentServiceConfig.value.id;
    }
    
    const response = await fetch(apiEndpoint.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Unknown API error");
    }
    
    if (!response.body) {
      throw new Error("Response body is null");
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const content = line.substring(6);
          if (content === '[DONE]') break;
          
          try {
            const chunk = JSON.parse(content).choices?.[0]?.delta?.content || '';
            if (chunk) {
              streamingContent.value += chunk;
            }
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        }
      }
    }
    
    // Calculate request duration when completed
    requestDuration.value = ((Date.now() - requestStartTime.value) / 1000).toFixed(2);
    
    if (streamingContent.value && conversation) {
      conversation.messages.push({
        role: "assistant",
        content: streamingContent.value
      });
      conversation.lastUpdatedAt = Date.now();
    }
  } catch (error) {
    console.error('Error:', error);
    apiError.value = `Error: ${error.message}`;
    
    // Still calculate duration even if there's an error
    requestDuration.value = ((Date.now() - requestStartTime.value) / 1000).toFixed(2);
  } finally {
    isStreaming.value = false;
    streamingContent.value = '';
    
    setTimeout(() => {
      userInputArea.value?.focus();
    });
  }
};

const formatMessage = (text) => {
  if (!text) return '';
  
  // Format code blocks
  text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // Format inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Format line breaks
  text = text.replace(/\n/g, '<br>');
  
  return text;
};

const getModelDisplayName = (modelKey) => {
  const model = availableModels.value.find(m => m.name === modelKey);
  if (model) {
    return model.display_name;
  }
  
  // If model details not found, just return the model key
  return modelKey;
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};
</script>

<template>
  <div class="app-wrapper" :class="{ 'dark-mode': isDarkMode }">
    <div class="chat-container">
      <header>
        <div class="header-left">
          <button @click="toggleSidebar" class="sidebar-toggle">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" />
            </svg>
          </button>
          <h1>TPCF GenAI Chat</h1>
        </div>
        <div class="header-controls">
          <div class="model-selector-wrapper">
            <select 
              id="model-select" 
              v-model="selectedModelKey" 
              @change="handleModelChange"
              class="model-selector"
              :disabled="isModelSelectionDisabled"
            >
              <option 
                v-for="model in availableModels" 
                :key="model.name" 
                :value="model.name"
              >
                {{ model.display_name || model.name }}
              </option>
            </select>
          </div>
          <button @click="toggleDarkMode" class="theme-toggle">
            <svg v-if="isDarkMode" class="theme-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M12,9c1.65,0,3,1.35,3,3s-1.35,3-3,3s-3-1.35-3-3S10.35,9,12,9 M12,7c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5 S14.76,7,12,7L12,7z M2,13h2c0.55,0,1-0.45,1-1s-0.45-1-1-1H2c-0.55,0-1,0.45-1,1S1.45,13,2,13z M20,13h2c0.55,0,1-0.45,1-1 s-0.45-1-1-1h-2c-0.55,0-1,0.45-1,1S19.45,13,20,13z M11,2v2c0,0.55,0.45,1,1,1s1-0.45,1-1V2c0-0.55-0.45-1-1-1S11,1.45,11,2z M11,20v2c0,0.55,0.45,1,1,1s1-0.45,1-1v-2c0-0.55-0.45-1-1-1S11,19.45,11,20z M5.99,4.58c-0.39-0.39-1.03-0.39-1.41,0 c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0s0.39-1.03,0-1.41L5.99,4.58z M18.36,16.95 c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41 L18.36,16.95z M19.42,5.99c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06c-0.39,0.39-0.39,1.03,0,1.41 s1.03,0.39,1.41,0L19.42,5.99z M7.05,18.36c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06 c-0.39,0.39-0.39,1.03,0,1.41s1.03,0.39,1.41,0L7.05,18.36z" />
            </svg>
            <svg v-else class="theme-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M9.37,5.51C9.19,6.15,9.1,6.82,9.1,7.5c0,4.08,3.32,7.4,7.4,7.4c0.68,0,1.35-0.09,1.99-0.27C17.45,17.19,14.93,19,12,19 c-3.86,0-7-3.14-7-7C5,9.07,6.81,6.55,9.37,5.51z M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36 c-0.98,1.37-2.58,2.26-4.4,2.26c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3L12,3z" />
            </svg>
          </button>
        </div>
      </header>
      
      <div class="main-container">
        <div class="sidebar" :class="{ 'sidebar-open': isSidebarOpen }">
          <div class="sidebar-header">
            <button @click="createNewConversation" class="new-chat-btn">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
              </svg>
              New Chat
            </button>
          </div>
          <div class="conversation-list">
            <div v-if="conversations.length === 0" class="no-conversations">
              No conversations yet. Start a new chat!
            </div>
            
             <div 
              v-for="conversation in conversations" 
              :key="conversation.id"
              :class="['conversation-item', { active: currentConversationId === conversation.id }]"
              @click="selectConversation(conversation.id)"
            >
              <div class="conversation-info">
                <div class="conversation-title">{{ conversation.title }}</div>
                <div class="conversation-meta">
                  <span class="conversation-date">{{ formatDate(conversation.lastUpdatedAt) }}</span>
                  <span v-if="conversation.modelKey" class="conversation-model-badge">
                    {{ getModelDisplayName(conversation.modelKey) }}
                  </span>
                </div>
              </div>
              <button 
                @click.stop="confirmDeleteConversation(conversation.id)" 
                class="delete-btn"
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <div class="chat-content">
          <div v-if="!apiConfigured && isConnected" class="api-warning">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
            </svg>
            <span>OpenAI API is not properly configured. Please check server configuration.</span>
          </div>
          
          <div class="messages-container" ref="messagesContainer">
            <div v-if="currentConversation && currentConversation.messages.length === 0" class="empty-chat">
              <div class="empty-chat-icon">
                <svg viewBox="0 0 24 24" width="48" height="48">
                  <path fill="currentColor" d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M6,9H18V11H6M14,14H6V12H14M18,8H6V6H18" />
                </svg>
              </div>
              <h3>Start a new conversation</h3>
              <p>Send a message to start chatting with the AI</p>
            </div>
            
            <template v-else>
              <div 
                v-for="(message, index) in currentMessages" 
                :key="index"
                :class="['message', message.role]"
              >
                <div class="role-badge">{{ message.role === 'user' ? 'You' : 'AI' }}</div>
                <div class="message-content" v-html="formatMessage(message.content)"></div>
              </div>
              
              <div v-if="isStreaming" class="message assistant streaming">
                <div class="role-badge">AI</div>
                <div class="message-content" v-html="formatMessage(streamingContent)"></div>
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </template>
          </div>
          
          <div class="input-container">
            <textarea
              v-model="userInput"
              @keydown.enter.prevent="sendMessage"
              placeholder="Type your message here..."
              :disabled="isStreaming || !isConnected || !apiConfigured"
              ref="userInputArea"
            ></textarea>
            <button 
              @click="sendMessage" 
              :disabled="isStreaming || !userInput.trim() || !isConnected || !apiConfigured"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          
          <div class="status-bar">
            <span v-if="apiError" class="error">{{ apiError }}</span>
            <span v-else-if="isStreaming">Receiving response...</span>
            <span v-else>Ready</span>
            
            <div class="status-info">
              <div v-if="requestDuration" class="request-time">
                {{ requestDuration }}s
              </div>
              <div :class="['connection-status', { connected: isConnected }]">
                {{ isConnected ? 'Connected' : 'Disconnected' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="showDeleteModal" class="modal-overlay">
      <div class="modal-content">
        <h3>Delete Conversation</h3>
        <p>Are you sure you want to delete this conversation? This action cannot be undone.</p>
        <div class="modal-actions">
          <button @click="showDeleteModal = false" class="cancel-btn">Cancel</button>
          <button @click="deleteConversation" class="delete-btn-confirm">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
:root {
  /* Light Mode Variables */
  --primary-color: #5762D5;
  --bg-color: #f5f7fb;
  --card-bg: #ffffff;
  --user-msg-bg: #5762D5;
  --user-text-color: white;
  --ai-msg-bg: #f0f2f5;
  --ai-text-color: #333;
  --border-radius: 12px;
  --text-color: #333;
  --secondary-text-color: #666;
  --error-color: #e53935;
  --button-hover: #4650b8;
  --border-color: #ddd;
  --shadow-color: rgba(0, 0, 0, 0.05);
  --code-bg: rgba(0, 0, 0, 0.1);
  --theme-toggle-bg: #eaeaea;
  --input-bg: #ffffff;
  --success-color: #4caf50;
  --warning-color: #ff5252;
  --warning-bg: #fff8e1;
}

.dark-mode {
  /* Dark Mode Variables */
  --primary-color: #6D74E4;
  --bg-color: #121212;
  --card-bg: #1e1e1e;
  --user-msg-bg: #6D74E4;
  --user-text-color: #ffffff;
  --ai-msg-bg: #2d2d2d;
  --ai-text-color: #e0e0e0;
  --text-color: #e0e0e0;
  --secondary-text-color: #aaaaaa;
  --error-color: #ff5252;
  --button-hover: #7D83E8;
  --border-color: #444;
  --shadow-color: rgba(0, 0, 0, 0.2);
  --code-bg: rgba(255, 255, 255, 0.1);
  --theme-toggle-bg: #333;
  --input-bg: #2d2d2d;
  --success-color: #66bb6a;
  --warning-color: #ff5252;
  --warning-bg: #3a2f22;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  transition: background-color 0.3s, color 0.3s, border-color 0.3s;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, 
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  margin: 0;
  padding: 0;
  line-height: 1.6;
}

.app-wrapper {
  min-height: 100vh;
  width: 100%;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.model-selector-wrapper {
  position: relative;
}

.model-selector {
  padding: 0.6rem 2rem 0.6rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-color);
  font-size: 0.9rem;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem top 50%;
  background-size: 0.65rem auto;
  cursor: pointer;
  min-width: 180px;
}


.chat-container {
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.main-container {
  display: flex;
  flex: 1;
  position: relative;
  min-height: 0;
  height: calc(100vh - 80px - 2rem);
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
}

h1 {
  font-size: 1.5rem;
  color: var(--primary-color);
  margin: 0 0 0 1rem;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.model-selector {
  padding: 0.6rem 2rem 0.6rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-color);
  font-size: 0.9rem;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem top 50%;
  background-size: 0.65rem auto;
  cursor: pointer;
}

.theme-icon {
  width: 18px;
  height: 18px;
}

.theme-toggle {
  display: flex;
  align-items: center;
  background-color: var(--theme-toggle-bg);
  color: var(--text-color);
  padding: 0.6rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.9rem;
  border: none;
}

.sidebar-toggle {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-color);
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Sidebar styles */
.sidebar {
  width: 280px;
  background-color: var(--card-bg);
  border-radius: var(--border-radius);
  box-shadow: 0 2px 10px var(--shadow-color);
  margin-right: 1rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.3s ease;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.8rem 1rem;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.new-chat-btn:hover {
  background-color: var(--button-hover);
  transform: translateY(-1px);
}

.new-chat-btn:active {
  transform: translateY(1px);
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.conversation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  background-color: var(--card-bg);
  border: 1px solid transparent;
}

.conversation-item:hover {
  background-color: var(--code-bg);
}

.conversation-item.active {
  border-color: var(--primary-color);
  background-color: var(--code-bg);
}

.conversation-info {
  flex: 1;
  overflow: hidden;
}

.conversation-title {
  font-weight: 500;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-color);
}

.conversation-date {
  font-size: 0.75rem;
  color: var(--secondary-text-color);
}

.delete-btn {
  background: none;
  border: none;
  color: var(--secondary-text-color);
  cursor: pointer;
  padding: 0.25rem;
  opacity: 0.6;
  transition: opacity 0.2s, color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  opacity: 1;
  color: var(--error-color);
}

.no-conversations {
  padding: 1rem;
  text-align: center;
  color: var(--secondary-text-color);
  font-size: 0.9rem;
}

/* On mobile, sidebar becomes a drawer */
@media (max-width: 768px) {
  .sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 10;
    transform: translateX(-100%);
  }
  
  .sidebar-open {
    transform: translateX(0);
  }
  
  .main-container {
    flex-direction: column;
  }
}

/* Chat content */
.chat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* API warning */
.api-warning {
  background-color: var(--warning-bg);
  color: var(--warning-color);
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: var(--border-radius);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

/* Empty chat state */
.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--secondary-text-color);
  text-align: center;
  padding: 2rem;
}

.empty-chat-icon {
  margin-bottom: 1rem;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--code-bg);
  border-radius: 50%;
}

.empty-chat h3 {
  margin-bottom: 0.5rem;
  font-size: 1.2rem;
  color: var(--text-color);
}

.empty-chat p {
  max-width: 400px;
  font-size: 0.9rem;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background-color: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 1.5rem;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 10px 25px var(--shadow-color);
}

.modal-content h3 {
  margin-bottom: 1rem;
  font-size: 1.2rem;
  color: var(--text-color);
}

.modal-content p {
  margin-bottom: 1.5rem;
  color: var(--secondary-text-color);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.cancel-btn {
  background-color: var(--theme-toggle-bg);
  color: var(--text-color);
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.delete-btn-confirm {
  background-color: var(--error-color);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

/* Message styles */
.messages-container {
  flex-grow: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: var(--card-bg);
  border-radius: var(--border-radius);
  box-shadow: 0 2px 10px var(--shadow-color);
}

.message {
  display: flex;
  flex-direction: column;
  max-width: 85%;
  padding: 0.8rem 1rem;
  border-radius: var(--border-radius);
  position: relative;
}

.message.user {
  align-self: flex-end;
  background-color: var(--user-msg-bg);
  color: var(--user-text-color);
}

.message.assistant {
  align-self: flex-start;
  background-color: var(--ai-msg-bg);
  color: var(--ai-text-color);
}

.role-badge {
  font-size: 0.75rem;
  font-weight: bold;
  margin-bottom: 0.3rem;
  opacity: 0.7;
}

.message-content {
  font-size: 0.95rem;
  line-height: 1.5;
}

.message-content pre {
  background-color: var(--code-bg);
  border-radius: 4px;
  padding: 0.5rem;
  margin: 0.5rem 0;
  overflow-x: auto;
}

.message-content code {
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
  background-color: var(--code-bg);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}

.message.user .message-content code {
  background-color: rgba(255, 255, 255, 0.2);
}

.input-container {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}

textarea {
  flex-grow: 1;
  padding: 0.8rem 1rem;
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-color);
  font-family: inherit;
  font-size: 0.95rem;
  resize: none;
  height: 60px;
  outline: none;
  transition: border-color 0.2s;
}

textarea:focus {
  border-color: var(--primary-color);
}

button {
  padding: 0 1rem;
  border-radius: var(--border-radius);
  border: none;
  background-color: var(--primary-color);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

button:hover {
  background-color: var(--button-hover);
}

button:disabled {
  background-color: #a0a0a0;
  cursor: not-allowed;
}

.status-bar {
  margin-top: 0.5rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--secondary-text-color);
}

.error {
  color: var(--error-color);
}

.connection-status {
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  background-color: var(--warning-color);
  color: white;
}

.connection-status.connected {
  background-color: var(--success-color);
}

.typing-indicator {
  display: flex;
  padding: 6px 0 0;
}

.typing-indicator span {
  height: 8px;
  width: 8px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  display: inline-block;
  margin-right: 5px;
  animation: bounce 1.3s linear infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes bounce {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-4px);
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .chat-container {
    padding: 0.5rem;
  }
  
  .message {
    max-width: 90%;
  }
  
  .modal-content {
    width: 95%;
  }
  
  header {
    padding: 0.5rem 0;
  }
  
  h1 {
    font-size: 1.2rem;
  }
  
  .model-selector, .theme-toggle {
    font-size: 0.8rem;
  }
}

.status-bar {
  margin-top: 0.5rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--secondary-text-color);
  align-items: center;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.request-time {
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background-color: var(--code-bg);
  color: var(--text-color);
}

/* Styling for the disabled model selector */
.model-selector:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  background-color: var(--ai-msg-bg);
}

/* Styling for the model badge in the conversation item */
.conversation-model-badge {
  font-size: 0.65rem;
  padding: 0.15rem 0.3rem;
  background-color: var(--primary-color);
  color: white;
  border-radius: 3px;
  margin-left: 0.5rem;
  opacity: 0.8;
}

.conversation-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--secondary-text-color);
}

.conversation-model-badge {
  font-size: 0.65rem;
  padding: 0.15rem 0.3rem;
  background-color: var(--primary-color);
  color: white;
  border-radius: 3px;
  margin-left: 0.5rem;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}
</style>