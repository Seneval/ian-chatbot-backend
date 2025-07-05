// API Wrapper for Admin Dashboard
class AdminAPI {
    constructor() {
        this.baseURL = window.adminAuth.API_BASE_URL;
        this.fetch = window.adminAuth.authenticatedFetch;
    }
    
    // Helper method to handle JSON responses
    async handleResponse(response) {
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Error: ${response.status}`);
        }
        
        return data;
    }
    
    // ===== Client Management =====
    
    // Get all clients
    async getClients() {
        const response = await this.fetch(`${this.baseURL}/auth/clients`);
        return this.handleResponse(response);
    }
    
    // Get single client
    async getClient(clientId) {
        const response = await this.fetch(`${this.baseURL}/auth/client/${clientId}`);
        return this.handleResponse(response);
    }
    
    // Create new client
    async createClient(clientData) {
        const response = await this.fetch(`${this.baseURL}/auth/client`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(clientData)
        });
        return this.handleResponse(response);
    }
    
    // Update client
    async updateClient(clientId, updates) {
        const response = await this.fetch(`${this.baseURL}/auth/clients/${clientId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        return this.handleResponse(response);
    }
    
    // Delete client
    async deleteClient(clientId) {
        const response = await this.fetch(`${this.baseURL}/auth/clients/${clientId}`, {
            method: 'DELETE'
        });
        return this.handleResponse(response);
    }
    
    // Regenerate client token
    async regenerateToken(clientId) {
        const response = await this.fetch(`${this.baseURL}/auth/clients/${clientId}/regenerate-token`, {
            method: 'POST'
        });
        return this.handleResponse(response);
    }
    
    // ===== Analytics =====
    
    // Get analytics overview
    async getAnalytics(clientId, startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        const response = await this.fetch(`${this.baseURL}/analytics/overview/${clientId}?${params}`);
        return this.handleResponse(response);
    }
    
    // Get conversations
    async getConversations(clientId, limit = 50, offset = 0) {
        const params = new URLSearchParams({ limit, offset });
        const response = await this.fetch(`${this.baseURL}/analytics/conversations/${clientId}?${params}`);
        return this.handleResponse(response);
    }
    
    // Get conversation details
    async getConversation(conversationId) {
        const response = await this.fetch(`${this.baseURL}/analytics/conversations/${conversationId}`);
        return this.handleResponse(response);
    }
    
    // Export data
    async exportData(clientId, format = 'json', startDate, endDate) {
        const params = new URLSearchParams({ format });
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        const response = await this.fetch(`${this.baseURL}/analytics/export/${clientId}?${params}`);
        
        if (format === 'csv') {
            return response.text();
        }
        return this.handleResponse(response);
    }
    
    // Get insights
    async getInsights(clientId) {
        const response = await this.fetch(`${this.baseURL}/analytics/insights/${clientId}`);
        return this.handleResponse(response);
    }
    
    // ===== Test Endpoints =====
    
    // Test assistant
    async testAssistant(assistantId) {
        const response = await this.fetch(`${this.baseURL}/chat/test-assistant/${assistantId}`);
        return this.handleResponse(response);
    }
}

// Create and export singleton instance
window.adminAPI = new AdminAPI();

// ===== Utility Functions =====

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('es-MX', options);
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (err) {
            document.body.removeChild(textArea);
            return false;
        }
    }
}

// Show toast notification
function showToast(message, type = 'success', duration = 3000) {
    // Create container if it doesn't exist
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? '✅' : '❌';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Remove toast after duration
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, duration);
}

// Confirm dialog
function confirmDialog(message) {
    return confirm(message);
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export utilities
window.adminUtils = {
    formatDate,
    formatNumber,
    copyToClipboard,
    showToast,
    confirmDialog,
    debounce
};