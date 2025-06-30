// Chatbot demo functionality with GPT-4o-mini integration
document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');

    if (!chatMessages || !userInput || !sendButton) return;

    // Configuration
    const API_ENDPOINT = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api/chat'  // For local development
        : 'https://ianwebsite.vercel.app/api/chat'; // Your Vercel deployment URL

    // Conversation state
    let conversationHistory = [];
    let isWaitingForResponse = false;

    // Fallback responses (used if API fails)
    const fallbackResponses = {
        precio: [
            'Nuestros chatbots tienen precios desde $29,000 hasta $89,000 MXN (pago único). La inversión se recupera rápidamente con 30-50% más conversiones. ¿Qué tipo de negocio tienes?',
            'La inversión va de $29,000 a $89,000 MXN dependiendo de las funcionalidades. Incluye conversaciones ilimitadas y soporte continuo. ¿Te gustaría ver cómo funcionaría en tu sitio?'
        ],
        default: [
            'Gracias por tu interés. Puedo explicarte cómo aumentar tus ventas 30-50% con nuestros chatbots de IA. ¿Qué información te sería más útil?',
            'Excelente pregunta. Nuestros chatbots convierten visitantes en clientes 24/7. ¿Te gustaría saber sobre precios, ver resultados reales o agendar una demo?'
        ]
    };

    // Get fallback response based on keywords
    function getFallbackResponse(input) {
        const lowerInput = input.toLowerCase();
        
        if (lowerInput.includes('precio') || lowerInput.includes('costo') || lowerInput.includes('cuanto')) {
            return fallbackResponses.precio[Math.floor(Math.random() * fallbackResponses.precio.length)];
        }
        
        return fallbackResponses.default[Math.floor(Math.random() * fallbackResponses.default.length)];
    }

    // Add message to chat
    function addMessage(text, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
        
        if (!isUser) {
            // Show typing indicator first
            messageDiv.innerHTML = `
                <div class="message-content typing">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            `;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Replace with actual message after delay
            setTimeout(() => {
                // Process the text to handle line breaks and formatting
                let formattedText = text
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Convert **text** to bold
                
                // First replace markdown links
                formattedText = formattedText.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
                
                // Then replace plain URLs (but not those already in <a> tags)
                formattedText = formattedText.replace(/(^|[^"])(https?:\/\/[^\s<]+)(?![^<]*<\/a>)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
                
                // Finally convert line breaks
                formattedText = formattedText.replace(/\n/g, '<br>').trim();
                
                messageDiv.innerHTML = `
                    <div class="message-content">
                        ${formattedText}
                    </div>
                `;
                messageDiv.classList.add('fade-in');
                
                // Add bounce animation to last message
                const allMessages = chatMessages.querySelectorAll('.message');
                const lastMessage = allMessages[allMessages.length - 1];
                if (lastMessage) {
                    lastMessage.style.animation = 'slideInBottom 0.5s ease';
                }
            }, 1000 + Math.random() * 1000);
        } else {
            messageDiv.innerHTML = `
                <div class="message-content">
                    ${text}
                </div>
            `;
            messageDiv.classList.add('fade-in');
            chatMessages.appendChild(messageDiv);
        }
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Call the API
    async function callChatbotAPI(message) {
        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    conversationHistory: conversationHistory
                })
            });

            if (!response.ok) {
                // Handle rate limiting
                if (response.status === 429) {
                    const errorData = await response.json();
                    return errorData.error || 'Por favor, espera un momento antes de enviar otro mensaje.';
                }
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return data.response;

        } catch (error) {
            console.error('Error calling chatbot API:', error);
            // Return fallback response
            return getFallbackResponse(message);
        }
    }

    // Send message
    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message || isWaitingForResponse) return;
        
        // Set waiting state
        isWaitingForResponse = true;
        sendButton.disabled = true;
        sendButton.textContent = '...';
        
        // Add user message
        addMessage(message, true);
        conversationHistory.push({ role: 'user', content: message });
        
        // Clear input
        userInput.value = '';
        
        // Get bot response
        const response = await callChatbotAPI(message);
        
        // Add bot response
        addMessage(response);
        conversationHistory.push({ role: 'assistant', content: response });
        
        // Keep conversation history manageable (last 20 messages)
        if (conversationHistory.length > 20) {
            conversationHistory = conversationHistory.slice(-20);
        }
        
        // Reset waiting state
        isWaitingForResponse = false;
        sendButton.disabled = false;
        sendButton.textContent = 'Enviar';
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isWaitingForResponse) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Focus effect on input
    userInput.addEventListener('focus', () => {
        userInput.parentElement.style.boxShadow = '0 0 0 3px rgba(107, 70, 193, 0.2)';
    });

    userInput.addEventListener('blur', () => {
        userInput.parentElement.style.boxShadow = 'none';
    });

    // Animate bot avatar
    const botAvatar = document.querySelector('.bot-avatar.animated');
    if (botAvatar) {
        setInterval(() => {
            botAvatar.style.transform = 'scale(1.1)';
            setTimeout(() => {
                botAvatar.style.transform = 'scale(1)';
            }, 500);
        }, 5000);
    }

    // Remove initial greeting - bot will respond when user says hello
});