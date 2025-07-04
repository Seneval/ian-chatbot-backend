// Admin Authentication Handler
const AUTH_TOKEN_KEY = 'ian_admin_token';
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://ian-chatbot-backend-h6zr.vercel.app/api';

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
    
    // If on login page and has token, redirect to dashboard
    if (token && window.location.pathname.includes('index.html')) {
        verifyTokenAndRedirect(token);
    }
    
    // If on dashboard and no token, redirect to login
    if (!token && window.location.pathname.includes('dashboard.html')) {
        window.location.href = 'index.html';
    }
    
    // Setup login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

// Verify token is still valid
async function verifyTokenAndRedirect(token) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/clients`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            window.location.href = 'dashboard.html';
        } else {
            localStorage.removeItem(AUTH_TOKEN_KEY);
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem(AUTH_TOKEN_KEY);
    }
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    
    // Show loading state
    loginBtn.disabled = true;
    loginBtn.querySelector('.btn-text').style.display = 'none';
    loginBtn.querySelector('.btn-loader').style.display = 'flex';
    errorMessage.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token
            if (remember) {
                localStorage.setItem(AUTH_TOKEN_KEY, data.token);
            } else {
                sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
            }
            
            // Show success message briefly
            errorMessage.textContent = '✅ ¡Inicio de sesión exitoso!';
            errorMessage.className = 'success-message';
            errorMessage.style.display = 'block';
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
        } else {
            throw new Error(data.error || 'Error al iniciar sesión');
        }
    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.className = 'error-message';
        errorMessage.style.display = 'block';
        
        // Reset button state
        loginBtn.disabled = false;
        loginBtn.querySelector('.btn-text').style.display = 'inline';
        loginBtn.querySelector('.btn-loader').style.display = 'none';
    }
}

// Logout function (to be used from dashboard)
function logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    window.location.href = 'index.html';
}

// Get stored token
function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
}

// Setup axios-like interceptor for fetch
const authenticatedFetch = (url, options = {}) => {
    const token = getToken();
    
    if (!token) {
        window.location.href = 'index.html';
        return Promise.reject(new Error('No token found'));
    }
    
    // Add auth header
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    
    return fetch(url, options).then(response => {
        // If unauthorized, redirect to login
        if (response.status === 401) {
            logout();
            return Promise.reject(new Error('Unauthorized'));
        }
        return response;
    });
};

// Export for use in other files
window.adminAuth = {
    getToken,
    logout,
    authenticatedFetch,
    API_BASE_URL
};