(function() {
  // Widget configuration
  const config = {
    apiUrl: window.CHATBOT_API_URL || 'https://ian-chatbot-backend-h6zr.vercel.app/api',
    token: null,
    position: 'bottom-right',
    primaryColor: '#4F46E5',
    secondaryColor: '#7C3AED'
  };

  // Extract configuration from script tag
  const currentScript = document.currentScript || document.querySelector('script[data-client-token]');
  if (currentScript) {
    config.token = currentScript.getAttribute('data-client-token');
    config.position = currentScript.getAttribute('data-position') || config.position;
  }

  // Widget styles
  const styles = `
    .ian-chatbot-widget {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      position: fixed;
      z-index: 9999;
    }

    .ian-chatbot-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .ian-chatbot-button:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 30px rgba(0, 0, 0, 0.3);
    }

    .ian-chatbot-button svg {
      width: 30px;
      height: 30px;
      fill: white;
    }

    .ian-chatbot-window {
      width: 380px;
      height: 600px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      display: none;
      flex-direction: column;
      overflow: hidden;
    }

    .ian-chatbot-header {
      background: linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%);
      color: white;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ian-chatbot-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .ian-chatbot-close {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s ease;
    }

    .ian-chatbot-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .ian-chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background: #f9fafb;
    }

    .ian-chatbot-message {
      margin-bottom: 16px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .ian-chatbot-message.user {
      flex-direction: row-reverse;
    }

    .ian-chatbot-message-content {
      max-width: 70%;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
    }

    .ian-chatbot-message.assistant .ian-chatbot-message-content {
      background: white;
      color: #111827;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .ian-chatbot-message.user .ian-chatbot-message-content {
      background: ${config.primaryColor};
      color: white;
    }

    .ian-chatbot-input-container {
      padding: 20px;
      background: white;
      border-top: 1px solid #e5e7eb;
    }

    .ian-chatbot-input-wrapper {
      display: flex;
      gap: 10px;
    }

    .ian-chatbot-input {
      flex: 1;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s ease;
    }

    .ian-chatbot-input:focus {
      border-color: ${config.primaryColor};
    }

    .ian-chatbot-send {
      padding: 12px 20px;
      background: ${config.primaryColor};
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s ease;
    }

    .ian-chatbot-send:hover {
      background: ${config.secondaryColor};
    }

    .ian-chatbot-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ian-chatbot-typing {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 12px 16px;
    }

    .ian-chatbot-typing span {
      width: 8px;
      height: 8px;
      background: #6b7280;
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }

    .ian-chatbot-typing span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .ian-chatbot-typing span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing {
      0%, 60%, 100% {
        opacity: 0.3;
        transform: scale(0.8);
      }
      30% {
        opacity: 1;
        transform: scale(1);
      }
    }

    .ian-chatbot-widget.bottom-right {
      bottom: 20px;
      right: 20px;
    }

    .ian-chatbot-widget.bottom-left {
      bottom: 20px;
      left: 20px;
    }

    @media (max-width: 450px) {
      .ian-chatbot-window {
        width: 100vw;
        height: 100vh;
        border-radius: 0;
      }

      .ian-chatbot-widget.bottom-right,
      .ian-chatbot-widget.bottom-left {
        bottom: 0;
        right: 0;
        left: 0;
      }
    }
  `;

  // Chat icon SVG
  const chatIcon = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
  const closeIcon = `<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

  // State
  let isOpen = false;
  let sessionId = null;
  let messages = [];

  // Create widget HTML
  function createWidget() {
    // Add styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Create widget container
    const widget = document.createElement('div');
    widget.className = `ian-chatbot-widget ${config.position}`;
    widget.innerHTML = `
      <div class="ian-chatbot-button" id="ian-chatbot-toggle">
        ${chatIcon}
      </div>
      <div class="ian-chatbot-window" id="ian-chatbot-window">
        <div class="ian-chatbot-header">
          <h3>Asistente Virtual</h3>
          <button class="ian-chatbot-close" id="ian-chatbot-close">
            ${closeIcon}
          </button>
        </div>
        <div class="ian-chatbot-messages" id="ian-chatbot-messages">
          <div class="ian-chatbot-message assistant">
            <div class="ian-chatbot-message-content">
              ¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?
            </div>
          </div>
        </div>
        <div class="ian-chatbot-input-container">
          <div class="ian-chatbot-input-wrapper">
            <input 
              type="text" 
              class="ian-chatbot-input" 
              id="ian-chatbot-input" 
              placeholder="Escribe tu mensaje..."
            />
            <button class="ian-chatbot-send" id="ian-chatbot-send">
              Enviar
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // Add event listeners
    document.getElementById('ian-chatbot-toggle').addEventListener('click', toggleChat);
    document.getElementById('ian-chatbot-close').addEventListener('click', toggleChat);
    document.getElementById('ian-chatbot-send').addEventListener('click', sendMessage);
    document.getElementById('ian-chatbot-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  // Toggle chat window
  function toggleChat() {
    isOpen = !isOpen;
    const window = document.getElementById('ian-chatbot-window');
    const button = document.getElementById('ian-chatbot-toggle');
    
    if (isOpen) {
      window.style.display = 'flex';
      button.style.display = 'none';
      if (!sessionId) initSession();
    } else {
      window.style.display = 'none';
      button.style.display = 'flex';
    }
  }

  // Initialize chat session
  async function initSession() {
    try {
      // Check if we should use demo mode
      const isDemoMode = window.CHATBOT_DEMO_MODE !== undefined ? window.CHATBOT_DEMO_MODE : true;
      const endpoint = isDemoMode ? '/chat-demo/session' : '/chat/session';
      
      const response = await fetch(`${config.apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-token': config.token
        }
      });

      if (response.ok) {
        const data = await response.json();
        sessionId = data.sessionId;
      } else {
        console.error('Error initializing session');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  // Send message
  async function sendMessage() {
    const input = document.getElementById('ian-chatbot-input');
    const message = input.value.trim();
    
    if (!message || !sessionId) return;

    // Add user message
    addMessage('user', message);
    input.value = '';
    
    // Show typing indicator
    showTyping();

    // Disable input
    input.disabled = true;
    document.getElementById('ian-chatbot-send').disabled = true;

    try {
      // Check if we should use demo mode
      const isDemoMode = window.CHATBOT_DEMO_MODE !== undefined ? window.CHATBOT_DEMO_MODE : true;
      const endpoint = isDemoMode ? '/chat-demo/message' : '/chat/message';
      
      const response = await fetch(`${config.apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-token': config.token
        },
        body: JSON.stringify({
          sessionId,
          message
        })
      });

      if (response.ok) {
        const data = await response.json();
        removeTyping();
        addMessage('assistant', data.message);
      } else {
        removeTyping();
        addMessage('assistant', 'Lo siento, hubo un error. Por favor intenta de nuevo.');
      }
    } catch (error) {
      console.error('Error:', error);
      removeTyping();
      addMessage('assistant', 'Lo siento, no pude conectarme al servidor.');
    } finally {
      // Enable input
      input.disabled = false;
      document.getElementById('ian-chatbot-send').disabled = false;
      input.focus();
    }
  }

  // Add message to chat
  function addMessage(role, content) {
    const messagesContainer = document.getElementById('ian-chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `ian-chatbot-message ${role}`;
    messageDiv.innerHTML = `
      <div class="ian-chatbot-message-content">
        ${escapeHtml(content)}
      </div>
    `;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Show typing indicator
  function showTyping() {
    const messagesContainer = document.getElementById('ian-chatbot-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ian-chatbot-message assistant';
    typingDiv.id = 'ian-chatbot-typing';
    typingDiv.innerHTML = `
      <div class="ian-chatbot-typing">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Remove typing indicator
  function removeTyping() {
    const typing = document.getElementById('ian-chatbot-typing');
    if (typing) typing.remove();
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize widget when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();